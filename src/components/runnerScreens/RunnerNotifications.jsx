import React, { useEffect, useState, useRef, useCallback } from "react";
import { Card, CardBody } from "@material-tailwind/react";
import { MapPin, ShoppingBag, Package, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import BarLoader from "../common/BarLoader";
import { computeDeliveryFee, formatNaira, RUNNER_SHARE } from "../../utils/pricing";

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
  reconnect
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [processingUserId, setProcessingUserId] = useState(null);
  const [, setSocketError] = useState(false);
  const [specialInstructions, setSpecialInstructions] = useState(null); // eslint-disable-line no-unused-vars


  const isAcceptingRef = useRef(false);
  const hasOpenedRef = useRef(false);
  const mountedRef = useRef(true);
  const processingRef = useRef(false);
  const timeoutRef = useRef(null);
  const requestsRef = useRef(requests)

  const PAGE_SIZE = 2;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);


  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Store requests in ref to avoid unnecessary re-renders
  useEffect(() => {
    requestsRef.current = requests;
  }, [requests]);

  // Only open when requests have data and we're not already open
  useEffect(() => {
    if (requests && requests.length > 0 && !hasOpenedRef.current) {
      hasOpenedRef.current = true;
      setIsOpen(true);
      setSocketError(false);
      setVisibleCount(PAGE_SIZE);
    } else if ((!requests || requests.length === 0) && hasOpenedRef.current) {
      hasOpenedRef.current = false;
      setIsOpen(false);
    }
  }, [requests, isOpen]);

  // Socket connection handler
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleReconnect = () => {
      setProcessingUserId(null);
      setSocketError(false);
      if (requestsRef.current?.length > 0 && !hasOpenedRef.current) {
        hasOpenedRef.current = true;
        setIsOpen(true);
      }
    };

    socket.on('connect', handleReconnect);
    return () => socket.off('connect', handleReconnect);
  }, [socket, isConnected]);


  const handlePickService = useCallback((user) => {
    // Prevent multiple accepts
    if (processingRef.current) return;
    if (!socket || !isConnected) {
      setSocketError(true);
      return;
    }

    processingRef.current = true;
    setProcessingUserId(user._id);

    const chatId = `user-${user._id}-runner-${runnerId}`;
    const serviceType = user.currentRequest?.serviceType || user.serviceType;

    // Clean up previous timeout
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    const handleProceedToChat = (data) => {
      if (data.chatId === chatId && data.chatReady && mountedRef.current) {
        // Clean up listeners
        socket.off("proceedToChat", handleProceedToChat);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);

        // Close modal and reset state BEFORE calling parent
        setIsOpen(false);
        setProcessingUserId(null);
        processingRef.current = false;

        // Call parent callback
        if (onPickService) {
          onPickService(user, data.specialInstructions, currentOrder);
        }
      }
    };

    socket.on("proceedToChat", handleProceedToChat);
    socket.emit("acceptRunnerRequest", {
      runnerId,
      userId: user._id,
      chatId,
      serviceType
    });

    // Timeout
    timeoutRef.current = setTimeout(() => {
      if (mountedRef.current && processingRef.current) {
        socket.off("proceedToChat", handleProceedToChat);
        setProcessingUserId(null);
        processingRef.current = false;
      }
    }, 30000);
  }, [socket, isConnected, runnerId, onPickService, currentOrder]);

  const handleDecline = useCallback((user) => {
    if (isAcceptingRef.current) return;
    if (!socket || !isConnected) {
      setSocketError(true);
      return;
    }

    socket.emit("declineRunnerRequest", { runnerId, userId: user._id });
    setIsOpen(false);
    hasOpenedRef.current = false;
    setProcessingUserId(null);
  }, [socket, isConnected, runnerId]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    hasOpenedRef.current = false;
    setProcessingUserId(null);
    if (onClose) onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    if (isConnected) return;

    // Modal opened but not connected — trigger immediate reconnect
    if (reconnect) {
      reconnect();
    }
  }, [isOpen, isConnected, reconnect]);

  // Don't render if not open or no requests
  if (!isOpen || !requests || requests.length === 0) return null;

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
          style={{ maxHeight: 'min(80vh, 600px)', paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="flex justify-center items-center p-3">
            <h2 className="text-xl text-center max-w-lg font-bold text-black dark:text-white">
              You have received an order
            </h2>
            <button
              onClick={handleClose}
              className="absolute lg:right-60 right-3 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-black-200 transition"
            >
              <X className="h-5 w-5 text-gray-600 dark:text-gray-300" />
            </button>
          </div>



          <div className="flex-1 overflow-y-auto p-3">
            <div className="max-w-lg mx-auto">
              <AnimatePresence>
                {requests.slice(0, visibleCount).map((user) => {
                  const req = user.currentRequest || {};
                  const isRunErrand = req.serviceType === 'run-errand';

                  const midCoords = isRunErrand
                    ? req.marketCoordinates
                    : req.pickupCoordinates;

                  const deliveryCoords = req.deliveryCoordinates
                    ?? req.deliveryLocation?.coordinates
                    ?? req.deliveryLocation?.coords
                    ?? (req.deliveryLocation?.lat ? req.deliveryLocation : null);

                  const { deliveryFee } = computeDeliveryFee(
                    req.serviceType,
                    midCoords,
                    deliveryCoords
                  );

                  const runnerFee = Math.round(deliveryFee * RUNNER_SHARE);

                  const itemBudget = req.itemBudget ?? req.budget ?? null;
                  const marketLocation = req.marketLocation?.address ?? req.marketLocation ?? null;
                  const deliveryAddress = req.deliveryLocation?.address ?? req.deliveryLocation ?? null;
                  const pickupAddress = req.pickupLocation?.address ?? req.pickupLocation ?? null;

                  return (
                    <motion.div
                      key={user._id || user.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.2 }}
                    >
                      {isRunErrand && (
                        <p className="text-sm text-primary">
                          ⚠️ Only accept this order if you can confirm the items will be available at the market. If items are unavailable after payment, the order will be flagged for admin review
                        </p>
                      )}
                      <Card className="dark:text-gray-300 dark:bg-black-100 shadow-none">
                        <CardBody className="p-4 text-black dark:text-gray-100">

                          {/* Service badge */}
                          <div className="flex items-center gap-2 mb-4">
                            <div className={`p-2 rounded-full ${isRunErrand ? 'bg-orange-100 dark:bg-orange-900/30' : 'bg-blue-100 dark:bg-blue-900/30'}`}>
                              {isRunErrand
                                ? <ShoppingBag className="h-5 w-5 text-orange-500" />
                                : <Package className="h-5 w-5 text-blue-500" />
                              }
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Service Type</p>
                              <p className="font-semibold capitalize">
                                {req.serviceType?.replace('-', ' ') || 'Pickup / Dropoff'}
                              </p>
                            </div>
                          </div>

                          {/* Sender name */}
                          <div className="mb-4">
                            <p className="text-sm text-gray-500 dark:text-gray-400">Sender's Name</p>
                            <p className="text-2xl font-bold">{user.firstName} {user.lastName || ""}</p>
                          </div>

                          {/* Run Errand Details */}
                          {isRunErrand && (
                            <div className="flex flex-col gap-3">
                              <div>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Market Location</p>
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 border-2 rounded-md border-gray-300 dark:border-gray-600 p-2 text-sm text-orange-400">
                                    {marketLocation || "No market location provided"}
                                  </div>
                                  <MapPin className="h-4 w-4 text-orange-400 flex-shrink-0" />
                                </div>
                              </div>

                              <div>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Delivery Location</p>
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 border-2 rounded-md border-gray-300 dark:border-gray-600 p-2 text-sm text-red-400">
                                    {deliveryAddress || "No delivery address provided"}
                                  </div>
                                  <MapPin className="h-4 w-4 text-red-400 flex-shrink-0" />
                                </div>
                              </div>

                              {req.marketItems && (
                                <div>
                                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Market Items</p>
                                  <div className="border-2 rounded-md border-gray-300 dark:border-gray-600 p-2 text-sm text-gray-700 dark:text-gray-300">
                                    {req.marketItems}
                                  </div>
                                </div>
                              )}

                              {req.marketItems && (
                                <p className="text-xs text-primary dark:text-primary-200 italic px-1">
                                  Please ensure your fleet can handle these items. By accepting, you take full responsibility for any complications arising from fleet limitations.
                                </p>
                              )}

                              <div className="flex gap-3">
                                <div className="flex-1">
                                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Item Budget</p>
                                  <div className="border-2 rounded-md border-gray-300 dark:border-gray-600 p-2 text-sm font-semibold text-green-500">
                                    {itemBudget != null
                                      ? formatNaira(itemBudget)
                                      : "Not specified"
                                    }
                                  </div>
                                </div>
                                <div className="flex-1">
                                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Your Fee</p>
                                  <div className="border-2 rounded-md border-gray-300 dark:border-gray-600 p-2 text-sm font-semibold text-primary">
                                    {runnerFee != null
                                      ? formatNaira(runnerFee)
                                      : "Calculating..."
                                    }
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Pickup/Dropoff Details */}
                          {!isRunErrand && (
                            <div className="flex flex-col gap-3">
                              <div>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Pickup Location</p>
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 border-2 rounded-md border-gray-300 dark:border-gray-600 p-2 text-sm text-blue-400">
                                    {pickupAddress || "No pickup address provided"}
                                  </div>
                                  <MapPin className="h-4 w-4 text-blue-400 flex-shrink-0" />
                                </div>
                              </div>

                              <div>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Delivery Location</p>
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 border-2 rounded-md border-gray-300 dark:border-gray-600 p-2 text-sm text-red-400">
                                    {deliveryAddress || "No delivery address provided"}
                                  </div>
                                  <MapPin className="h-4 w-4 text-red-400 flex-shrink-0" />
                                </div>
                              </div>

                              {req.pickupItems && (
                                <div>
                                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Items to Pick Up</p>
                                  <div className="border-2 rounded-md border-gray-300 dark:border-gray-600 p-2 text-sm text-gray-700 dark:text-gray-300">
                                    {req.pickupItems}
                                  </div>
                                </div>
                              )}

                              {req.pickupItems && (
                                <p className="text-xs text-primary dark:text-primary-200 italic px-1">
                                  Please ensure your fleet can handle these items. By accepting, you take full responsibility for any complications arising from fleet limitations.
                                </p>
                              )}

                              <div>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Your Fee</p>
                                <div className="border-2 rounded-md border-gray-300 dark:border-gray-600 p-2 text-sm font-semibold text-primary">
                                  {runnerFee != null
                                    ? formatNaira(runnerFee)
                                    : "Calculating..."
                                  }
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Action buttons */}
                          <div className="flex gap-3 px-2 mt-5">
                            <button
                              className={`flex-1 cursor-pointer font-medium text-lg text-white border rounded-md px-6 py-2 flex justify-center gap-2 items-center min-w-[100px] ${!isConnected || processingUserId === user._id || isAcceptingRef.current
                                ? 'bg-primary/20 cursor-not-allowed'
                                : 'bg-primary hover:bg-primary/70'
                                }`}
                              onClick={() => processingUserId === user._id ? null : handlePickService(user)}
                              disabled={!isConnected || processingUserId === user._id || isAcceptingRef.current}
                            >
                              {processingUserId === user._id ? (
                                <>
                                  <span>Accepting</span>
                                  <BarLoader size="small" />
                                </>
                              ) : !isConnected ? "Waiting.." : "Accept"}
                            </button>

                            <button
                              className={`flex-1 cursor-pointer font-medium text-lg border rounded-md px-6 py-2 flex justify-center gap-2 items-center min-w-[100px] ${!isConnected || processingUserId === user._id || isAcceptingRef.current
                                ? 'bg-secondary text-gray-500 border-gray-300 cursor-not-allowed'
                                : 'bg-secondary text-gray-700 border-gray-300 hover:bg-secondary/50'
                                }`}
                              onClick={() => processingUserId === user._id ? null : handleDecline(user)}
                              disabled={!isConnected || processingUserId === user._id || isAcceptingRef.current}
                            >
                              {processingUserId === user._id ? (
                                <>
                                  <span>Declining</span>
                                  <BarLoader size="small" />
                                </>
                              ) : "Decline"}
                            </button>
                          </div>

                        </CardBody>
                      </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
}

export default React.memo(RunnerNotifications);