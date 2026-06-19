import React, { useEffect, useState, useRef, useCallback } from "react";
import { Card, CardBody } from "@material-tailwind/react";
import { MapPin, ShoppingBag, Package, X, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import BarLoader from "../common/BarLoader";
import { computeDeliveryFee, formatNaira, RUNNER_SHARE } from "../../utils/pricing";
import useOrderStore from "../../store/orderStore";

function RunnerNotifications({
  requests,
  runnerId,
  darkMode,
  onPickService,
  socket,
  isConnected,
  onClose,
  currentOrder,
  runnerLocation,
  onFindMore,
  reconnect,
  isOpen: isOpenProp,
}) {
  const isOpen = isOpenProp;
  const [processingUserId, setProcessingUserId] = useState(null);
  const [, setSocketError] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState('left');
  const [localRequests, setLocalRequests] = useState([]);
  const [errorMessage, setErrorMessage] = useState(null);

  const isAcceptingRef = useRef(false);
  const hasOpenedRef = useRef(false);
  const mountedRef = useRef(true);
  const processingRef = useRef(false);
  const timeoutRef = useRef(null);
  const requestsRef = useRef(requests);
  const dragStartX = useRef(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    requestsRef.current = requests;
  }, [requests]);

  useEffect(() => {
    if (requests && requests.length > 0) {
      setLocalRequests(requests);
      setCurrentIndex(0);
      setSocketError(false);
    }
  }, [requests]);

  useEffect(() => {
    if (!socket || !socket.connected) return;
    const handleReconnect = () => {
      setProcessingUserId(null);
      setSocketError(false);

      if (socket.emit) {
        socket.emit('runnerReconnect', { runnerId });
      }

      if (requestsRef.current?.length > 0 && !hasOpenedRef.current) {
        hasOpenedRef.current = true;
      }
    };

    const handleChatError = (data) => {
      console.error('[RN] chatError:', data);
      // Reset accepting state so runner can retry or decline
      setProcessingUserId(null);
      processingRef.current = false;
      if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }

      setErrorMessage(data.message || 'Failed to connect. Please try again.');
    };

    const handlePreRoomTimeout = (data) => {
      console.warn('[RN] preRoomTimeout:', data);
      setProcessingUserId(null);
      processingRef.current = false;
      if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
      // Put the request back so runner can retry
      setErrorMessage('Connection timed out — the user may have left.');
    };

    socket.on('connect', handleReconnect);
    socket.on('chatError', handleChatError);
    socket.on('preRoomTimeout', handlePreRoomTimeout);
    return () => {
      if (!socket) return;
      socket.off('connect', handleReconnect)
      socket.off('chatError', handleChatError);
      socket.off('preRoomTimeout', handlePreRoomTimeout);
    };
  }, [socket, runnerId]);

  useEffect(() => {
    if (!isOpen || socket?.connected) return;
    if (reconnect) reconnect();
  }, [isOpen, socket, reconnect]);

  const goNext = () => {
    if (currentIndex < localRequests.length - 1) {
      setSwipeDirection('left');
      setCurrentIndex(i => i + 1);
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setSwipeDirection('right');
      setCurrentIndex(i => i - 1);
    }
  };

  const handleDragStart = (e) => {
    dragStartX.current = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
  };

  const handleDragEnd = (e) => {
    if (dragStartX.current === null) return;
    const endX = e.type === 'touchend' ? e.changedTouches[0].clientX : e.clientX;
    const diff = dragStartX.current - endX;
    dragStartX.current = null;
    if (Math.abs(diff) < 50) return;
    if (diff > 0) goNext();
    else goPrev();
  };

  const doAcceptRequest = useCallback((user) => {
    console.log('[RN] doAcceptRequest starting...');
    processingRef.current = true;
    setProcessingUserId(user._id);

    const chatId = `user-${user._id}-runner-${runnerId}`;
    const serviceType = user.currentRequest?.serviceType || user.serviceType;

    useOrderStore.getState().clearPersistedChat(chatId);
    try {
      const stored = JSON.parse(localStorage.getItem('sendrey-order-store') || '{}');
      if (stored?.state?._chats?.[chatId]) {
        delete stored.state._chats[chatId];
        localStorage.setItem('sendrey-order-store', JSON.stringify(stored));
      }
    } catch (_) { }

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    const handleProceedToChat = (data) => {
      if (data.chatId === chatId && data.chatReady && mountedRef.current) {
        socket.off("proceedToChat", handleProceedToChat);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setProcessingUserId(null);
        processingRef.current = false;
        if (onPickService) onPickService(user, data.specialInstructions, currentOrder);
      }
    };

    socket.on("proceedToChat", handleProceedToChat);
    console.log('[RN doAcceptRequest] emitting acceptRunnerRequest', { runnerId, userId: user._id, chatId, socketId: socket.id });
    socket.emit("acceptRunnerRequest", { runnerId, userId: user._id, chatId, serviceType });

    timeoutRef.current = setTimeout(() => {
      if (mountedRef.current && processingRef.current) {
        socket.off("proceedToChat", handleProceedToChat);
        setProcessingUserId(null);
        processingRef.current = false;
      }
    }, 60000);
  }, [socket, runnerId, onPickService, currentOrder]);

  const handlePickService = useCallback((user) => {
    setErrorMessage(null);
    if (processingRef.current) return;
    if (!socket) return;
    if (!socket.connected) {
      socket.connect();
      if (reconnect) reconnect();
    }
    doAcceptRequest(user);
  }, [socket, doAcceptRequest, reconnect]);

  const handleDecline = useCallback((user) => {
    setErrorMessage(null);
    if (isAcceptingRef.current) return;
    if (socket && socket.connected) {
      socket.emit("declineRunnerRequest", { runnerId, userId: user._id });
    }
    setLocalRequests(prev => {
      const updated = prev.filter(r => r._id !== user._id);
      if (updated.length === 0) {
        hasOpenedRef.current = false;
        if (onClose) onClose();
      } else {
        setCurrentIndex(i => Math.min(i, updated.length - 1));
      }
      return updated;
    });
  }, [socket, runnerId, onClose]);

  const handleClose = useCallback(() => {

    hasOpenedRef.current = false;
    setProcessingUserId(null);
    if (onClose) onClose();
  }, [onClose]);

  if (!isOpen || localRequests.length === 0) return null;

  const user = localRequests[currentIndex];
  if (!user) return null;

  const req = user.currentRequest || {};
  const isRunErrand = req.serviceType === 'run-errand';
  const fleetType = req.fleetType;
  const midCoords = isRunErrand ? req.marketCoordinates : req.pickupCoordinates;
  const deliveryCoords = req.deliveryCoordinates
    ?? req.deliveryLocation?.coordinates
    ?? req.deliveryLocation?.coords
    ?? (req.deliveryLocation?.lat ? req.deliveryLocation : null);

  const { deliveryFee } = computeDeliveryFee(req.serviceType, midCoords, deliveryCoords, fleetType);
  const runnerFee = Math.round(deliveryFee * RUNNER_SHARE);
  const itemBudget = req.itemBudget ?? req.budget ?? null;
  const marketLocation = req.marketLocation?.address ?? req.marketLocation ?? null;
  const deliveryAddress = req.deliveryLocation?.address ?? req.deliveryLocation ?? null;
  const pickupAddress = req.pickupLocation?.address ?? req.pickupLocation ?? null;

  const slideVariants = {
    enter: (dir) => ({ x: dir === 'left' ? 300 : -300, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir) => ({ x: dir === 'left' ? -300 : 300, opacity: 0 }),
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={handleClose} />

      <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center">
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 25 }}
          className={`${darkMode ? "dark:bg-black-100" : "bg-white"} rounded-t-3xl shadow-2xl w-full max-w-4xl flex flex-col`}
          style={{ maxHeight: 'min(85vh, 660px)', paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-3 flex-shrink-0">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-black dark:text-white">New Request</h2>
              {localRequests.length > 1 && (
                <div className="flex gap-1">
                  {localRequests.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => { setSwipeDirection(i > currentIndex ? 'left' : 'right'); setCurrentIndex(i); }}
                      className={`h-2 rounded-full transition-all duration-300 ${i === currentIndex ? 'w-5 bg-primary' : 'w-2 bg-black-100/20 dark:bg-gray-600'}`}
                    />
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {localRequests.length > 1 && (
                <span className="text-xs text-black-100/80 dark:text-gray-500">
                  {currentIndex + 1} / {localRequests.length}
                </span>
              )}
              <button onClick={handleClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-black-200 transition">
                <X className="h-5 w-5 text-black-100/80 dark:text-gray-300" />
              </button>
            </div>
          </div>

          <div className="h-px bg-gray-200 dark:bg-white/10 mx-4 flex-shrink-0" />

          {errorMessage && (
            <div className={`mx-4 mb-3 rounded-2xl p-4 border flex items-start justify-between gap-2 flex-shrink-0 ${darkMode ? "bg-red-950/40 border-red-800/40" : "bg-red-50 border-red-200"
              }`}>
              <p className={`text-sm font-semibold ${darkMode ? "text-red-300" : "text-red-700"}`}>
                {errorMessage}
              </p>
              <button onClick={() => setErrorMessage(null)} className="flex-shrink-0">
                <X className={`h-4 w-4 ${darkMode ? "text-red-400" : "text-red-500"}`} />
              </button>
            </div>
          )}

          {/* Sliding card area */}
          <div
            className="flex-1 overflow-hidden"
            onMouseDown={handleDragStart}
            onMouseUp={handleDragEnd}
            onTouchStart={handleDragStart}
            onTouchEnd={handleDragEnd}
          >
            <AnimatePresence custom={swipeDirection} mode="wait">
              <motion.div
                key={user._id + currentIndex}
                custom={swipeDirection}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: "spring", stiffness: 280, damping: 28 }}
                className="h-full overflow-y-auto px-4 py-3"
              >
                <div className="max-w-lg mx-auto">

                  {isRunErrand && (
                    <p className="text-xs text-primary mb-3">
                      ⚠️ Only accept if you can confirm items will be available at the market.
                    </p>
                  )}

                  <Card className="dark:bg-black-100 shadow-none border border-gray-200 dark:border-white/10 rounded-2xl">
                    <CardBody className="p-4 text-black dark:text-gray-100">

                      {/* Top: service type + sender */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <div className={`p-2 rounded-full ${isRunErrand ? 'bg-orange-100 dark:bg-orange-900/30' : 'bg-blue-100 dark:bg-blue-900/30'}`}>
                            {isRunErrand
                              ? <ShoppingBag className="h-4 w-4 text-orange-500" />
                              : <Package className="h-4 w-4 text-blue-500" />
                            }
                          </div>
                          <div>
                            <p className="text-xs text-black-100/80 dark:text-gray-400">Service</p>
                            <p className="text-sm font-semibold capitalize">
                              {req.serviceType?.replace('-', ' ') || 'Pickup / Dropoff'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-black-100/80 dark:text-gray-400">Sender</p>
                          <p className="text-lg font-bold">{user.firstName} {user.lastName || ""}</p>
                        </div>
                      </div>

                      <div className="h-px bg-gray-100 dark:bg-white/10 mb-4" />

                      {/* Run Errand fields */}
                      {isRunErrand && (
                        <div className="flex flex-col gap-0">
                          <LocationRow label="Market" address={marketLocation} color="text-orange-400" icon={<MapPin className="h-3.5 w-3.5 text-orange-400 flex-shrink-0 mt-0.5" />} />
                          <div className="h-px bg-gray-100 dark:bg-white/10 my-3" />
                          <LocationRow label="Delivery" address={deliveryAddress} color="text-red-400" icon={<MapPin className="h-3.5 w-3.5 text-red-400 flex-shrink-0 mt-0.5" />} />

                          {req.marketItems && (
                            <>
                              <div className="h-px bg-gray-100 dark:bg-white/10 my-3" />
                              <div>
                                <p className="text-xs text-black-100/80 dark:text-gray-400 mb-1">Market Items</p>
                                <p className="text-sm text-black-100/80 dark:text-gray-300">{req.marketItems}</p>
                                <p className="text-xs text-primary italic mt-1">
                                  Ensure your fleet can handle these items.
                                </p>
                              </div>
                            </>
                          )}

                          {req.canAdjustSlightly && (
                            <div className="flex items-center gap-2 mt-3 px-3 py-2">
                              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
                              <p className="text-xs text-amber-400 font-medium">
                                The budget for these items can be adjust slightly below the total price indicated below
                              </p>
                            </div>
                          )}

                          <div className="h-px bg-gray-100 dark:bg-white/10 my-3" />
                          <div className="flex gap-3">
                            <FeeBox label="Item Budget" value={itemBudget != null ? formatNaira(itemBudget) : "Not specified"} color="text-green-500" />
                            <FeeBox label="Your Fee" value={runnerFee ? formatNaira(runnerFee) : "Calculating..."} color="text-primary" />
                          </div>
                        </div>
                      )}

                      {/* Pickup fields */}
                      {!isRunErrand && (
                        <div className="flex flex-col gap-0">
                          <LocationRow label="Pickup" address={pickupAddress} color="text-blue-400" icon={<MapPin className="h-3.5 w-3.5 text-blue-400 flex-shrink-0 mt-0.5" />} />
                          <div className="h-px bg-gray-100 dark:bg-white/10 my-3" />
                          <LocationRow label="Delivery" address={deliveryAddress} color="text-red-400" icon={<MapPin className="h-3.5 w-3.5 text-red-400 flex-shrink-0 mt-0.5" />} />

                          {req.pickupItems && (
                            <>
                              <div className="h-px bg-gray-100 dark:bg-white/10 my-3" />
                              <div>
                                <p className="text-xs text-black-100/80 dark:text-gray-400 mb-1">Items to Pick Up</p>
                                <p className="text-sm text-black-100/80 dark:text-gray-300">{req.pickupItems}</p>
                                <p className="text-xs text-primary italic mt-1">
                                  Ensure your fleet can handle these items.
                                </p>
                              </div>
                            </>
                          )}

                          <div className="h-px bg-gray-100 dark:bg-white/10 my-3" />
                          <FeeBox label="Your Fee" value={runnerFee ? formatNaira(runnerFee) : "Calculating..."} color="text-primary" />
                        </div>
                      )}

                    </CardBody>
                  </Card>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="h-px bg-gray-200 dark:bg-white/10 mx-4 flex-shrink-0" />

          {/* Bottom: nav arrows + action buttons */}
          <div className="px-4 py-3 flex-shrink-0">
            <div className="max-w-lg mx-auto flex items-center gap-2">

              <button
                onClick={goPrev}
                disabled={currentIndex === 0}
                className="p-2.5 rounded-full border border-gray-200 dark:border-white/10 disabled:opacity-25 hover:bg-gray-50 dark:hover:bg-black-200 transition flex-shrink-0"
              >
                <ChevronLeft className="h-5 w-5 text-black-100/80 dark:text-gray-300" />
              </button>

              <button
                className={`flex-1 font-semibold text-base text-white rounded-xl py-3 flex justify-center gap-2 items-center transition ${processingUserId === user._id
                  ? 'bg-primary/50 cursor-not-allowed'
                  : 'bg-primary hover:bg-primary/80 cursor-pointer'
                  }`}
                onClick={() => { if (processingUserId === user._id) return; handlePickService(user); }}
                disabled={processingUserId === user._id}
              >
                {processingUserId === user._id
                  ? <><span>Accepting</span><BarLoader size="small" /></>
                  : 'Accept'
                }
              </button>

              <button
                className={`flex-1 font-semibold text-base rounded-xl py-3 flex justify-center items-center border border-gray-200 dark:border-white/10 transition ${processingUserId === user._id
                  ? 'opacity-30 cursor-not-allowed text-black-100/80'
                  : 'cursor-pointer text-black-100/80 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-black-200'
                  }`}
                onClick={() => { if (processingUserId === user._id) return; handleDecline(user); }}
                disabled={processingUserId === user._id}
              >
                Decline
              </button>

              <button
                onClick={goNext}
                disabled={currentIndex === localRequests.length - 1}
                className="p-2.5 rounded-full border border-gray-200 dark:border-white/10 disabled:opacity-25 hover:bg-gray-50 dark:hover:bg-black-200 transition flex-shrink-0"
              >
                <ChevronRight className="h-5 w-5 text-black-100/80 dark:text-gray-300" />
              </button>

            </div>
          </div>

        </motion.div>
      </div>
    </>
  );
}

function LocationRow({ label, address, color, icon }) {
  return (
    <div className="flex items-start gap-2">
      {icon}
      <div className="min-w-0 flex-1">
        <p className="text-xs text-black-100/80 dark:text-gray-400">{label}</p>
        <p className={`text-sm font-medium leading-snug ${color}`}>{address || "Not provided"}</p>
      </div>
    </div>
  );
}

function FeeBox({ label, value, color }) {
  return (
    <div className="flex-1 bg-gray-50 dark:bg-black-200 rounded-xl p-3">
      <p className="text-xs text-black-100/80 dark:text-gray-400 mb-0.5">{label}</p>
      <p className={`text-sm font-bold ${color}`}>{value}</p>
    </div>
  );
}

export default React.memo(RunnerNotifications);