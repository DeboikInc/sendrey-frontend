// components/runnerScreens/OrderStatusFlow.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { LiveTrackingMap } from '../tracking/LiveTrackingMap';

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


const OrderStatusFlow = ({
  isOpen,
  onClose,
  orderData,
  darkMode,
  onStatusClick,
  completedStatuses = [],
  setCompletedStatuses,
  socket,
  taskType,                 // normalised, comes straight from RunnerChatScreen
  onStatusMessage,
  messagesRef,
  deliveryMarked,
  userConfirmedDelivery,
  runnerFleetType = 'pedestrian',
}) => {
  const [showFullView, setShowFullView] = useState(false);
  const [runnerLocation, setRunnerLocation] = useState(null);

  // Stable refs — always mirror the latest prop values without re-subscribing
  const completedStatusesRef = useRef(completedStatuses);
  const orderDataRef = useRef(orderData);
  const deliveryMarkedRef = useRef(deliveryMarked);
  const userConfirmedRef = useRef(userConfirmedDelivery);
  const watchIdRef = useRef(null);
  const [forceUpdate, setForceUpdate] = useState(0);

  useEffect(() => { completedStatusesRef.current = completedStatuses; }, [completedStatuses]);
  useEffect(() => { orderDataRef.current = orderData; }, [orderData]);
  useEffect(() => { deliveryMarkedRef.current = deliveryMarked; }, [deliveryMarked]);
  useEffect(() => { userConfirmedRef.current = userConfirmedDelivery; }, [userConfirmedDelivery]);

  // Reset panel to mini-view when flow closes or order completes
  useEffect(() => {
    if (!isOpen || completedStatuses.includes('task_completed')) {
      setShowFullView(false);
    }
  }, [isOpen, completedStatuses]);

  useEffect(() => {
    if (!socket) return;

    const handleUpdate = (data) => {
      console.log('pickupItemUpdated received:', data);
      setForceUpdate(prev => prev + 1);
    };

    socket.on('pickupItemUpdated', handleUpdate);
    socket.on('itemSubmissionUpdated', handleUpdate);

    return () => {
      socket.off('pickupItemUpdated', handleUpdate);
      socket.off('itemSubmissionUpdated', handleUpdate);
    };
  }, [socket]);

  // ── GPS watch (only while full map view is open) ───────────────────────────
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

  // ── Derive display values purely from props ────────────────────────────────
  const isRunErrand = taskType === 'run-errand';
  const isPickUp = taskType === 'pick-up';
  const isEnRoute = completedStatuses.includes('en_route_to_delivery');

  const toAddress = (field) =>
    !field ? null : typeof field === 'string' ? field : field.address ?? null;

  const {
    chatId, orderId, runnerId,
    deliveryLocation, deliveryCoordinates,
    marketLocation, marketCoordinates,
    pickupLocation, pickupCoordinates,
    usedPayoutSystem,
  } = orderData ?? {};

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

  const miniLabel = isEnRoute
    ? toAddress(deliveryLocation)
    : isRunErrand
      ? (toAddress(marketLocation) || 'Market location')
      : (toAddress(pickupLocation) || 'Pickup location');

  const hasCoords = !!(destinationCoordinates?.lat && destinationCoordinates?.lng);

  const statuses = isRunErrand ? RUN_ERRAND_STATUSES : PICK_UP_STATUSES;

  const completionPercentage = statuses.length > 0
    ? Math.round(
      (completedStatuses.filter(k => statuses.some(s => s.key === k)).length / statuses.length) * 100
    )
    : 0;

  // ── Click logic ────────────────────────────────────────────────────────────
  const isClickable = useCallback((statusKey) => {
    const done = completedStatusesRef.current;
    if (done.includes(statusKey)) return false;
    const idx = statuses.findIndex(s => s.key === statusKey);
    if (idx === 0) return true;
    return done.includes(statuses[idx - 1].key);
  }, [statuses]);

  const handleStatusClick = useCallback((statusKey) => {
    const _ = forceUpdate; // eslint-disable-line no-unused-vars

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

    if (isPickUp && isRunErrand && statusKey === 'item_delivered') {
      if (!deliveryMarkedRef.current && !userConfirmedRef.current) {
        alert('You must click "Mark as Delivered" and the user must confirm delivery before this item(s) can be marked as delivered.');
        return;
      }
      if (deliveryMarkedRef.current && !userConfirmedRef.current) {
        alert('Waiting for the user to confirm delivery. Task cannot be marked as delivered until they confirm.');
        return;
      }
    }

    if (isPickUp && statusKey === 'item_collected') {
      // Log for debugging
      console.log('Checking for approved pickup item in messages:', messagesRef?.current);
      const approvedMessages = messagesRef?.current?.filter(
        m => (m.type === 'pickup_item_submission' || m.messageType === 'pickup_item_submission')
      );
      console.log('Pickup submission messages:', approvedMessages);

      const hasApprovedPickupItem = approvedMessages?.some(m => m.status === 'approved');
      console.log('Has approved pickup item:', hasApprovedPickupItem);

      if (!hasApprovedPickupItem) {
        alert('You must submit a pickup item and wait for user approval before marking as collected.');
        return;
      }
    }

    if (isRunErrand && statusKey === 'en_route_to_delivery') {
      // usedPayoutSystem comes directly from RunnerChatScreen's currentOrder — always fresh
      if ((!orderDataRef.current?.usedPayoutSystem)) {
        alert('You must complete payment to your vendor before marking en route to delivery.');
        return;
      }
    }

    if (statusKey === 'task_completed') {

    }

    if (socket) {
      socket.emit('updateStatus', { chatId, status: statusKey });

      if (statusKey === 'task_completed') {
        socket.emit('taskCompleted', { chatId, orderId, runnerId, userId: orderData?.userId });
      }
    }

    setCompletedStatuses(prev => [...prev, statusKey]);
    onStatusClick?.(statusKey, taskType);
    setTimeout(() => onClose(), 800);
  }, [
    statuses, isRunErrand, isPickUp,
    socket, chatId, orderId, runnerId, orderData?.userId, taskType,
    setCompletedStatuses, onStatusClick, onClose, messagesRef, 
    // eslint-disable-next-line react-hooks/exhaustive-deps
    forceUpdate
  ]);

  if (!isOpen) return null;

  return (
    <AnimatePresence mode="wait">
      {!showFullView ? (
        // ── Mini sheet
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
                  {miniLabel || 'Address'}
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
        // ── Full status view ───────────────────────────────────────────────
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
            {/* Map */}
            <div className="h-48 sm:h-80 rounded-2xl overflow-hidden relative">
              {hasCoords ? (
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

            {/* Progress */}
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

            {/* Status list */}
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

            {/* Dev panel */}
            {process.env.NODE_ENV === 'development' && (
              <div className="rounded-xl p-3 bg-gray-800 text-gray-300 text-xs font-mono space-y-1">
                <p>taskType (prop):      <span className="text-yellow-400">{taskType ?? '(none)'}</span></p>
                <p>usedPayoutSystem:     <span className="text-green-400">{String(!!usedPayoutSystem)}</span></p>
                <p>hasCoords:            <span className={hasCoords ? 'text-green-400' : 'text-red-400'}>{String(hasCoords)}</span></p>
                <p>fleetType (used):     <span className="text-yellow-400">{runnerFleetType}</span></p>
                <p>orderId:              <span className="text-blue-400">{orderId ?? '—'}</span></p>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default OrderStatusFlow;