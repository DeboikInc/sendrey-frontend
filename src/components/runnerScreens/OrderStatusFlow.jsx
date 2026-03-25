// components/runnerScreens/OrderStatusFlow.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { LiveTrackingMap } from '../tracking/LiveTrackingMap';
import BarLoader from '../common/BarLoader';

const RUN_ERRAND_STATUSES = [
  { id: 1, label: 'Arrived at market', key: 'arrived_at_market' },
  { id: 2, label: 'Purchase in progress', key: 'purchase_in_progress' },
  { id: 3, label: 'Purchase completed', key: 'purchase_completed' },
  { id: 4, label: 'En route to delivery', key: 'en_route_to_delivery' },
  { id: 5, label: 'Arrived at delivery location', key: 'arrived_at_delivery_location' },
  { id: 6, label: 'Item delivered', key: 'item_delivered' },
  { id: 7, label: 'Task completed', key: 'task_completed' },
];

const PICK_UP_STATUSES = [
  { id: 1, label: 'Arrived at pickup location', key: 'arrived_at_pickup_location' },
  { id: 2, label: 'Item collected', key: 'item_collected' },
  { id: 3, label: 'En route to delivery', key: 'en_route_to_delivery' },
  { id: 4, label: 'Arrived at delivery location', key: 'arrived_at_delivery_location' },
  { id: 5, label: 'Item delivered', key: 'item_delivered' },
  { id: 6, label: 'Task completed', key: 'task_completed' },
];

// Normalise any service-type string → 'run-errand' | 'pick-up'
const normaliseTaskType = (raw) => {
  if (!raw) return null;
  const s = String(raw).toLowerCase().replace(/_/g, '-');
  if (s === 'run-errand' || s === 'run_errand') return 'run-errand';
  if (s === 'pick-up' || s === 'pickup') return 'pick-up';
  return null;
};

// ─── Component 
const OrderStatusFlow = ({
  isOpen,
  onClose,
  orderData,
  darkMode,
  onStatusClick,
  completedStatuses = [],
  setCompletedStatuses,
  socket,
  taskType: taskTypeProp,
  onStatusMessage,
  messagesRef,
  deliveryMarked,
  userConfirmedDelivery,
}) => {
  const [showFullView, setShowFullView] = useState(false);
  const [runnerLocation, setRunnerLocation] = useState(null);

  const [serverOrder, setServerOrder] = useState(null);
  const [isFetchingOrder, setIsFetchingOrder] = useState(false);

  const lockedTaskTypeRef = useRef(null);
  const [lockedTaskType, setLockedTaskType] = useState(null);

  const completedStatusesRef = useRef(completedStatuses);
  const orderDataRef = useRef(orderData);
  const deliveryMarkedRef = useRef(deliveryMarked);
  const userConfirmedRef = useRef(userConfirmedDelivery);
  const watchIdRef = useRef(null);
  const serverOrderRef = useRef(null);
  const hasFetchedForOrderRef = useRef(null);

  useEffect(() => { completedStatusesRef.current = completedStatuses; }, [completedStatuses]);
  useEffect(() => { orderDataRef.current = orderData; }, [orderData]);
  useEffect(() => { deliveryMarkedRef.current = deliveryMarked; }, [deliveryMarked]);
  useEffect(() => { userConfirmedRef.current = userConfirmedDelivery; }, [userConfirmedDelivery]);
  useEffect(() => {
    serverOrderRef.current = serverOrder;
  }, [serverOrder]);

  // ── Fetch order from server whenever the flow opens ────────────────────────
  const fetchOrderFromServer = useCallback(() => {
    const { chatId, orderId, runnerId } = orderDataRef.current || {};
    if (!socket || !chatId) return;

    if (serverOrderRef.current?.orderId === orderId) {
      return;
    }

    // If we've already fetched this specific order before, don't show loading
    if (hasFetchedForOrderRef.current === orderId && serverOrderRef.current) {
      return;
    }


    setIsFetchingOrder(true);

    const handleOrderData = (data) => {
      console.log('orderByChatId response received:', data);
      if (!data) { setIsFetchingOrder(false); return; }

      if (data.chatId && data.chatId !== chatId) return;
      if (data.orderId && orderId && data.orderId !== orderId) return;

      const order = data.order ?? data;
      setServerOrder(order);

      const resolved = normaliseTaskType(
        order.serviceType ?? order.taskType ?? order.type
      ) ?? normaliseTaskType(taskTypeProp) ?? 'pick-up';

      if (!lockedTaskTypeRef.current) {
        lockedTaskTypeRef.current = resolved;
        setLockedTaskType(resolved);
      }

      setIsFetchingOrder(false);
    };

    socket.emit('getOrderByChatId', { chatId, runnerId });
    socket.once('orderByChatId', handleOrderData);
    socket.once('orderData', handleOrderData);

    const timeout = setTimeout(() => {
      socket.off('orderByChatId', handleOrderData);
      socket.off('orderData', handleOrderData);

      if (!lockedTaskTypeRef.current) {
        const fallback = normaliseTaskType(
          orderDataRef.current?.serviceType ??
          orderDataRef.current?.userData?.serviceType ??
          orderDataRef.current?.userData?.currentRequest?.serviceType ??
          taskTypeProp
        ) ?? 'pick-up';
        lockedTaskTypeRef.current = fallback;
        setLockedTaskType(fallback);
      }
      setIsFetchingOrder(false);
    }, 4000);

    return () => {
      clearTimeout(timeout);
      socket.off('orderByChatId', handleOrderData);
      socket.off('orderData', handleOrderData);
    };
  }, [socket, taskTypeProp,]);

  // Cleanup when order completes
  useEffect(() => {
    if (completedStatuses.includes('task_completed')) {
      // Reset internal state
      setShowFullView(false);
      setServerOrder(null);
      setLockedTaskType(null);
      lockedTaskTypeRef.current = null;
      hasFetchedForOrderRef.current = null;
    }
  }, [completedStatuses]);

  useEffect(() => {
    if (!isOpen) return;

    const incomingOrderId = orderDataRef.current?.orderId;
    if (lockedTaskTypeRef.current && serverOrder?.orderId && serverOrder.orderId !== incomingOrderId) {
      lockedTaskTypeRef.current = null;
      setLockedTaskType(null);
      setServerOrder(null);
      hasFetchedForOrderRef.current = null;
    }

    const cleanup = fetchOrderFromServer();
    return cleanup;
  }, [isOpen, fetchOrderFromServer, serverOrder?.orderId]);

  // ── GPS watch (only while full view is open) ───────────────────────────────
  useEffect(() => {
    if (!showFullView || !navigator.geolocation) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => setRunnerLocation({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        heading: pos.coords.heading || 0,
      }),
      (err) => console.warn('OrderStatusFlow geolocation error:', err),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    );

    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [showFullView]);

  // ── Derive display data ────────────────────────────────────────────────────
  const resolvedOrder = serverOrder ?? orderDataRef.current ?? {};
  const runnerFleetType = resolvedOrder.runnerData?.fleetType ?? resolvedOrder.runnerId?.fleetType ?? 'pedestrian';
  const userData = resolvedOrder.userData ?? orderDataRef.current?.userData ?? {};
  const currentRequest = userData.currentRequest ?? {};

  const effectiveTaskType = lockedTaskType
    ?? normaliseTaskType(taskTypeProp)
    ?? 'pick-up';

  const isRunErrand = effectiveTaskType === 'run-errand';
  const isPickUp = effectiveTaskType === 'pick-up';
  const isEnRoute = completedStatuses.includes('en_route_to_delivery');

  const toAddress = (field) =>
    !field ? null : typeof field === 'string' ? field : field.address ?? null;

  const deliveryLocation = resolvedOrder.deliveryLocation ?? currentRequest.deliveryLocation ?? null;
  const deliveryCoordinates = resolvedOrder.deliveryCoordinates ?? currentRequest.deliveryCoordinates ?? null;
  const marketLocation = resolvedOrder.marketLocation ?? currentRequest.marketLocation ?? null;
  const marketCoordinates = resolvedOrder.marketCoordinates ?? currentRequest.marketCoordinates ?? null;
  const pickupLocation = resolvedOrder.pickupLocation ?? currentRequest.pickupLocation ?? null;
  const pickupCoordinates = resolvedOrder.pickupCoordinates ?? currentRequest.pickupCoordinates ?? null;

  const destinationCoordinates = isEnRoute
    ? deliveryCoordinates
    : isRunErrand
      ? marketCoordinates
      : pickupCoordinates;

  const destinationLabel = isEnRoute
    ? toAddress(deliveryLocation)
    : isRunErrand
      ? toAddress(marketLocation)
      : toAddress(pickupLocation);

  const hasCoords = !!(destinationCoordinates?.lat && destinationCoordinates?.lng);

  const miniLabel = isEnRoute
    ? toAddress(deliveryLocation)
    : isRunErrand
      ? (toAddress(marketLocation) || 'Market location')
      : (toAddress(pickupLocation) || 'Pickup location');

  const statuses = isRunErrand ? RUN_ERRAND_STATUSES : PICK_UP_STATUSES;

  const completionPercentage = statuses.length > 0
    ? Math.round((completedStatuses.filter(k => statuses.some(s => s.key === k)).length / statuses.length) * 100)
    : 0;

  const isClickable = useCallback((statusKey) => {
    const done = completedStatusesRef.current;
    if (done.includes(statusKey)) return false;
    const idx = statuses.findIndex(s => s.key === statusKey);
    if (idx === 0) return true;
    return done.includes(statuses[idx - 1].key);
  }, [statuses]);

  const handleStatusClick = useCallback((statusKey) => {
    const done = completedStatusesRef.current;

    if (done.includes(statusKey)) {
      alert("You already marked this status, you can't mark it again.");
      return;
    }

    const idx = statuses.findIndex(s => s.key === statusKey);
    if (idx > 0) {
      const prevKey = statuses[idx - 1].key;
      if (!done.includes(prevKey)) {
        alert(`You can't skip an update. Please mark "${statuses[idx - 1].label}" first.`);
        return;
      }
    }

    if (isRunErrand && statusKey === 'purchase_completed') {
      const itemsApproved = messagesRef?.current?.some(m => m.itemsApproved === true);
      if (!itemsApproved) {
        alert('Items must be submitted and approved by the user before marking purchase as completed.');
        return;
      }
    }

    if (isPickUp && statusKey === 'item_collected') {
      // Check if there's an approved pickup item submission in the messages
      const hasApprovedPickupItem = messagesRef?.current?.some(
        m => (m.type === 'pickup_item_submission' || m.messageType === 'pickup_item_submission') &&
          m.status === 'approved'
      );

      if (!hasApprovedPickupItem) {
        alert('You must submit a pickup item and wait for user approval before marking as collected.');
        return;
      }
    }

    if (isRunErrand && statusKey === 'en_route_to_delivery') {
      const eff = serverOrder ?? orderDataRef.current;
      const payoutUsed = eff?.usedPayoutSystem ?? eff?.payout?.usedPayoutSystem ?? false;
      if (!payoutUsed) {
        alert('You must complete payment to your vendor before marking en route to delivery.');
        return;
      }
    }

    if (statusKey === 'task_completed') {
      if (!deliveryMarkedRef.current && !userConfirmedRef.current) {
        alert('You must click "Mark as Delivered" and the user must confirm delivery before this task can be marked as completed.');
        return;
      }
      if (deliveryMarkedRef.current && !userConfirmedRef.current) {
        alert('Waiting for the user to confirm delivery. Task cannot be marked as completed until they confirm.');
        return;
      }
    }

    const eff = serverOrder ?? orderDataRef.current;
    if (socket) {
      socket.emit('updateStatus', { chatId: eff?.chatId, status: statusKey });

      if (statusKey === 'task_completed') {
        socket.emit('taskCompleted', {
          chatId: eff?.chatId,
          orderId: eff?.orderId,
          runnerId: eff?.runnerId,
          userId: eff?.userId,
        });
      }
    }

    setCompletedStatuses(prev => [...prev, statusKey]);
    onStatusClick?.(statusKey, effectiveTaskType);
    setTimeout(() => onClose(), 800);
  }, [statuses, isRunErrand, isPickUp, socket, serverOrder,
    effectiveTaskType, setCompletedStatuses, onStatusClick, onClose, messagesRef]);

  if (!isOpen) return null;

  return (
    <AnimatePresence mode="wait">
      {!showFullView ? (
        <motion.div
          key="mini"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50 z-50 flex items-end"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 40, stiffness: 400 }}
            onClick={e => e.stopPropagation()}
            className="w-full rounded-t-3xl p-6"
          >
            <div className={`${darkMode ? 'bg-black-100' : 'bg-white'} rounded-2xl p-4`}>
              <div className="text-center mb-6">
                <h3 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-black-200'}`}>
                  Options
                </h3>
                <p className="border-b border-gray-600 p-2" />
              </div>

              <button
                onClick={() => setShowFullView(true)}
                className={`w-full text-center p-4 rounded-xl ${darkMode ? 'bg-black-200' : 'bg-gray-100'} transition-colors`}
              >
                <p className="text-lg text-primary">
                  {miniLabel || "Address"}
                </p>
              </button>

            </div>

            <div className="h-8 backdrop-blur-sm" />

            <button
              onClick={onClose}
              className={`w-full text-center p-4 rounded-xl border border-primary ${darkMode ? 'bg-black-100' : 'bg-white'}`}
            >
              <p className="font-medium text-red-600 dark:text-primary">Cancel</p>
            </button>
          </motion.div>
        </motion.div>
      ) : (
        <motion.div
          key="full"
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 35, stiffness: 380 }}
          className={`absolute inset-0 z-50 ${darkMode ? 'bg-black-100' : 'bg-white'}`}
        >
          <div className="sticky top-0 bg-primary text-white p-4 z-10">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowFullView(false)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <span className="font-semibold text-lg ml-auto mr-auto truncate max-w-[60vw]">
                {destinationLabel || (isRunErrand ? 'Market location' : 'Pickup location')}
              </span>
            </div>
          </div>

          <div
            className="marketSelection p-4 space-y-6 overflow-y-auto pb-20"
            style={{ height: 'calc(100dvh - 64px)' }}
          >
            <div className="h-48 sm:h-80 rounded-2xl overflow-hidden relative">
              {isFetchingOrder ? (
                <div className={`w-full h-full flex items-center justify-center ${darkMode ? 'bg-black-200' : 'bg-gray-100'}`}>
                  <BarLoader size="default" />
                </div>
              ) : hasCoords ? (
                <LiveTrackingMap
                  runnerLocation={runnerLocation}
                  deliveryLocation={destinationCoordinates}
                  runnerFleetType={runnerFleetType}
                  runnerHeading={runnerLocation?.heading || 0}
                  darkMode={darkMode}
                  className="w-full h-full"
                  showPath={true}
                />
              ) : (
                <div className={`w-full h-full flex items-center justify-center p-6 text-center ${darkMode ? 'bg-black-200' : 'bg-gray-100'}`}>
                  <div>
                    <p className={`text-[16px] mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      {destinationLabel || 'Location'} coordinates not available
                    </p>
                    <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                      Please contact the sender to get the exact{' '}
                      {isRunErrand ? 'market' : 'pickup'} location
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {isFetchingOrder && (
                <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                  Refreshing order…
                </span>
              )}
            </div>

            <div className="space-y-3">
              <h2 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-black-200'}`}>
                {completionPercentage}%
              </h2>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                <div
                  className="h-3 rounded-full transition-all duration-500"
                  style={{ width: `${completionPercentage}%`, backgroundColor: '#F47C20' }}
                />
              </div>
            </div>

            <div className="space-y-3">
              <h3 className={`font-semibold ${darkMode ? 'text-white' : 'text-black-200'}`}>
                Send updates to Sender:
              </h3>
              <div className={`rounded-2xl ${darkMode ? 'bg-black-200' : 'bg-gray-50'}`}>
                {statuses.map((item) => {
                  const isCompleted = completedStatuses.includes(item.key);
                  const canClick = isClickable(item.key);

                  return (
                    <button
                      key={item.id}
                      onClick={() => handleStatusClick(item.key)}
                      className={[
                        'w-full p-4 flex items-center justify-between transition-colors',
                        'border-b border-gray-200 dark:border-gray-700 last:border-0',
                        isCompleted ? 'bg-black-200 dark:bg-green-900/20' : '',
                        canClick && !isCompleted ? 'hover:bg-gray-100 dark:hover:bg-primary/20 cursor-pointer' : '',
                        !canClick && !isCompleted ? 'opacity-40 cursor-not-allowed' : '',
                      ].join(' ')}
                    >
                      <div className="flex items-center gap-3">
                        <div className={[
                          'w-6 h-6 rounded-full border-2 flex items-center justify-center',
                          isCompleted
                            ? 'bg-green-500 border-green-500'
                            : canClick
                              ? 'border-primary'
                              : 'border-gray-300 dark:border-gray-600',
                        ].join(' ')}>
                          {isCompleted && (
                            <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <span className={[
                          'font-medium',
                          isCompleted ? 'text-green-600 dark:text-green-400' : '',
                          canClick && !isCompleted ? (darkMode ? 'text-white' : 'text-black-200') : '',
                          !canClick && !isCompleted ? 'text-gray-400 dark:text-gray-500' : '',
                        ].join(' ')}>
                          {item.label}
                        </span>
                      </div>
                      <ChevronRight className={`h-5 w-5 flex-shrink-0 ${isCompleted ? 'text-green-500' : 'text-gray-400'}`} />
                    </button>
                  );
                })}
              </div>
            </div>

            {process.env.NODE_ENV === 'development' && (
              <div className="rounded-xl p-3 bg-gray-800 text-gray-300 text-xs font-mono space-y-1">
                <p>taskType (locked): <span className="text-yellow-400">{lockedTaskType ?? '(pending)'}</span></p>
                <p>taskType (prop):   <span className="text-blue-400">{taskTypeProp ?? 'none'}</span></p>
                <p>server order id:   <span className="text-green-400">{serverOrder?.orderId ?? 'not yet fetched'}</span></p>
                <p>server serviceType:<span className="text-green-400">{serverOrder?.serviceType ?? '—'}</span></p>
                <p>hasCoords:         <span className={hasCoords ? 'text-green-400' : 'text-red-400'}>{String(hasCoords)}</span></p>
                <p>fleetType <span>{serverOrder?.fleetType ?? '—'}</span></p>
                <p>fleetType (used):  <span className="text-yellow-400">{runnerFleetType}</span></p>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default OrderStatusFlow;