// components/runnerScreens/OrderStatusFlow.jsx
import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { LiveTrackingMap } from '../tracking/LiveTrackingMap';

const OrderStatusFlow = ({
  isOpen,
  onClose,
  orderData,
  darkMode,
  onStatusClick,
  completedStatuses = [],
  setCompletedStatuses,
  socket,
  taskType = orderData?.taskType,
  runnerFleetType = 'car',
  onStatusMessage = [],
  messagesRef,
  deliveryMarked,
  userConfirmedDelivery

}) => {
  const [showFullView, setShowFullView] = useState(false);

  // Runner's own GPS position
  const [runnerLocation, setRunnerLocation] = useState(null);
  const watchIdRef = useRef(null);

  useEffect(() => {
    if (!showFullView) return;
    if (!navigator.geolocation) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setRunnerLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          heading: pos.coords.heading || 0,
        });
      },
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

  const getFilteredStatuses = (type) => {
    const shoppingStatuses = [
      { id: 1, label: 'Arrived at market', key: 'arrived_at_market' },
      { id: 2, label: 'Purchase in progress', key: 'purchase_in_progress' },
      { id: 3, label: 'Purchase completed', key: 'purchase_completed' },
      { id: 4, label: 'En route to delivery', key: 'en_route_to_delivery' },
      { id: 5, label: 'Arrived at delivery location', key: 'arrived_at_delivery_location' },
      { id: 6, label: 'Task completed', key: 'task_completed' },
    ];

    const pickupStatuses = [
      { id: 1, label: 'Arrived at pickup location', key: 'arrived_at_pickup_location' },
      { id: 2, label: 'Item collected', key: 'item_collected' },
      { id: 3, label: 'En route to delivery', key: 'en_route_to_delivery' },
      { id: 4, label: 'Arrived at delivery location', key: 'arrived_at_delivery_location' },
      { id: 5, label: 'Task completed', key: 'task_completed' },
    ];

    return type === 'pickup_delivery' ? pickupStatuses : shoppingStatuses;
  };

  const statuses = getFilteredStatuses(taskType);

  const isRunErrand = taskType === 'run-errand' || taskType === 'run_errand';
  const isPickup = taskType === 'pick-up';
  const isEnRoute = completedStatuses.includes('en_route_to_delivery');

  // ── Map destination logic ────────────────────────────────────────────────
  const destinationCoordinates = isEnRoute
    ? orderData?.deliveryCoordinates
    : isRunErrand
      ? orderData?.marketCoordinates
      : orderData?.pickupCoordinates;

  const getAddress = (field) =>
    typeof field === 'string' ? field : field?.address || null;

  const destinationLabel = isEnRoute
    ? orderData?.deliveryLocation
    : isRunErrand
      ? orderData?.marketLocation
      : orderData?.pickupLocation;

  const hasCoords = !!destinationCoordinates?.lat && !!destinationCoordinates?.lng;

  const completionPercentage = Math.round(
    (completedStatuses.length / statuses.length) * 100
  );

  const isClickable = (statusKey) => {
    const idx = statuses.findIndex(s => s.key === statusKey);
    if (completedStatuses.includes(statusKey)) return false;
    if (idx === 0) return true;
    return completedStatuses.includes(statuses[idx - 1].key);
  };

  const handleStatusClick = (statusKey) => {
    if (completedStatuses.includes(statusKey)) {
      alert("You already marked this status, you can't mark it again.");
      return;
    }

    const idx = statuses.findIndex(s => s.key === statusKey);
    if (idx > 0) {
      const prevKey = statuses[idx - 1].key;
      if (!completedStatuses.includes(prevKey)) {
        const prevLabel = statuses[idx - 1].label;
        alert(`You can't skip an update. Please mark "${prevLabel}" first.`);
        return;
      }
    }

    // ── Proof required check ───────────────────────────────────────────────
    // run-errand: proof needed before 'purchase_completed'
    // pickup: proof needed before 'item_collected'
    // pickup: photo proof required before 'item_collected'
    if (!isPickup && statusKey === 'purchase_completed') {
      const itemsApproved = messagesRef?.current?.some(m => m.itemsApproved === true);
      if (!itemsApproved) {
        alert('Items must be submitted and approved by the user before marking purchase as completed.');
        return;
      }
    }

    if (isPickup && statusKey === 'item_collected') {
      const hasProof = messagesRef?.current?.some(
        m => m.from === 'me' && (m.type === 'image' || m.type === 'media') && m.fileUrl
      );
      if (!hasProof) {
        alert('You must send a photo proof of the item(s) before marking as collected.');
        return;
      }
    }

    if (isRunErrand && statusKey === 'en_route_to_delivery') {
      const payoutUsed = orderData?.usedPayoutSystem ?? orderData?.payout?.usedPayoutSystem;
      if (!payoutUsed) {
        alert('You must complete payment to your vendor before marking en route to delivery.');
        return;
      }
    }

    if (statusKey === 'task_completed') {
      if (!deliveryMarked && !userConfirmedDelivery) {
        alert('You must click "Mark as Delivered" in the attachment options and the user must confirm delivery before this task can be marked as completed.');
        return;
      }
      if (deliveryMarked && !userConfirmedDelivery) {
        alert('Waiting for the user to confirm delivery. Task cannot be marked as completed until they confirm.');
        return;
      }
    }

    if (socket) {
      socket.emit('updateStatus', { chatId: orderData?.chatId, status: statusKey });

      if (statusKey === 'task_completed') {
        socket.emit('taskCompleted', {
          chatId: orderData?.chatId,
          orderId: orderData?.orderId,
          runnerId: orderData?.runnerId,
          userId: orderData?.userId,
        });
      }
    }

    setCompletedStatuses(prev => [...prev, statusKey]);
    onStatusClick?.(statusKey, taskType);
    setTimeout(() => onClose(), 800);
  };

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
                <h3 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-black-200'}`}>Options</h3>
                <p className="border-b border-gray-600 p-2" />
              </div>
              <button
                onClick={() => setShowFullView(true)}
                className={`w-full text-center p-4 rounded-xl ${darkMode ? 'bg-black-200' : 'bg-gray-100'} transition-colors`}
              >
                <p className="text-lg text-primary">
                  {isEnRoute
                    ? getAddress(orderData?.deliveryLocation)
                    : isRunErrand
                      ? getAddress(orderData?.marketLocation)
                      : getAddress(orderData?.pickupLocation) || 'Select location'}
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
          {/* Header */}
          <div className="sticky top-0 bg-primary text-white p-4 z-10">
            <div className="flex items-center gap-3">
              <button onClick={() => setShowFullView(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <ArrowLeft className="h-5 w-5" />
              </button>
              <span className="font-semibold text-lg ml-auto mr-auto">{destinationLabel}</span>
            </div>
          </div>

          <div className="marketSelection p-4 space-y-6 overflow-y-auto pb-20" style={{ height: 'calc(100dvh - 64px)' }}>
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
                      {destinationLabel} coordinates not available
                    </p>
                    <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                      Please contact the sender to get the exact {isRunErrand ? 'market' : 'pickup'} location
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Progress */}
            <div className="space-y-3">
              <h2 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-black-200'}`}>{completionPercentage}%</h2>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                <div
                  className="h-3 rounded-full transition-all duration-500"
                  style={{ width: `${completionPercentage}%`, backgroundColor: '#F47C20' }}
                />
              </div>
            </div>

            {/* Status list */}
            <div className="space-y-3">
              <h3 className={`font-semibold ${darkMode ? 'text-white' : 'text-black-200'}`}>Send updates to Sender:</h3>
              <div className={`rounded-2xl ${darkMode ? 'bg-black-200' : 'bg-gray-50'}`}>
                {statuses.map((item) => {
                  const isCompleted = completedStatuses.includes(item.key);
                  const canClick = isClickable(item.key);
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleStatusClick(item.key)}
                      className={`w-full p-4 flex items-center justify-between transition-colors border-b border-gray-200 dark:border-gray-700 last:border-0
                        ${isCompleted ? 'bg-black-200 dark:bg-green-900/20' : ''}
                        ${canClick && !isCompleted ? 'hover:bg-gray-100 dark:hover:bg-primary/20 cursor-pointer' : ''}
                        ${!canClick && !isCompleted ? 'opacity-40 cursor-not-allowed' : ''}
                      `}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center
                          ${isCompleted ? 'bg-green-500 border-green-500' : canClick ? 'border-primary' : 'border-gray-300 dark:border-gray-600'}`}
                        >
                          {isCompleted && (
                            <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <span className={`font-medium
                          ${isCompleted ? 'text-green-600 dark:text-green-400' : ''}
                          ${canClick && !isCompleted ? darkMode ? 'text-white' : 'text-black-200' : ''}
                          ${!canClick && !isCompleted ? 'text-gray-400 dark:text-gray-500' : ''}
                        `}>
                          {item.label}
                        </span>
                      </div>
                      <ChevronRight className={`h-5 w-5 ${isCompleted ? 'text-green-500' : 'text-gray-400'}`} />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default OrderStatusFlow;