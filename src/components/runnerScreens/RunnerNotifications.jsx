import React, { useEffect, useState } from "react";
import { Card, CardBody } from "@material-tailwind/react";
import { MapPin, ShoppingBag, Package } from "lucide-react";
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
  currentOrder,   // ← comes directly from parent, no useState needed
  runnerLocation
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [processingUserId, setProcessingUserId] = useState(null);
  const [socketError, setSocketError] = useState(false);
  const [specialInstructions, setSpecialInstructions] = useState(null); // eslint-disable-line no-unused-vars
  const PAYMENT_WARNING = "Once an order has been funded by the customer, you are committed to completing it. Backing out at this stage may affect your rating and standing on the platform."; // eslint-disable-line no-unused-vars

  useEffect(() => {
    if (requests && requests.length > 0) {
      // console.log("RunnerNotifications - Requests received:", requests);
      setIsOpen(true);
      setSocketError(false);
    } else {
      setIsOpen(false);
    }
  }, [requests, isConnected]);

  // silently ask for connection
  useEffect(() => {
    if (requests?.length > 0 && !isConnected && socket) {
      socket.connect();
    }
  })

  // Add this useEffect inside RunnerNotifications
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleReconnect = () => {
      // If we were mid-acceptance flow, reset so runner can try again
      setProcessingUserId(null);
      setSocketError(false);

      if (requests?.length > 0) setIsOpen(true);
    };

    socket.on('connect', handleReconnect);
    return () => socket.off('connect', handleReconnect);
  }, [socket, isConnected, requests]);

  const handlePickService = async (user) => {
    if (!socket || !isConnected) {
      setSocketError(true);
      return;
    }

    setProcessingUserId(user._id);
    const chatId = `user-${user._id}-runner-${runnerId}`;
    const serviceType = user.currentRequest?.serviceType || user.serviceType;

    if (!socket.connected) {
      setProcessingUserId(null);
      setSocketError(true);
      return;
    }

    const handleEnterPreRoom = (data) => {
      if (data.chatId === chatId) {
        socket.off("enterPreRoom", handleEnterPreRoom);
      }
    };

    const handleProceedToChat = (data) => {
      if (data.chatId === chatId && data.chatReady) {
        if (data.specialInstructions) setSpecialInstructions(data.specialInstructions);

        socket.off("proceedToChat", handleProceedToChat);
        socket.off("enterPreRoom", handleEnterPreRoom);

        socket.emit("runnerJoinChat", { runnerId, userId: user._id, chatId, serviceType });

        setIsOpen(false);
        setProcessingUserId(null);

        if (onPickService) onPickService(user, data.specialInstructions, currentOrder);
      }
    };

    socket.on("enterPreRoom", handleEnterPreRoom);
    socket.on("proceedToChat", handleProceedToChat);
    socket.emit("acceptRunnerRequest", { runnerId, userId: user._id, chatId, serviceType });

    setTimeout(() => {
      socket.off("proceedToChat", handleProceedToChat);
      socket.off("enterPreRoom", handleEnterPreRoom);
      if (processingUserId === user._id) {
        setProcessingUserId(null);
        setSocketError(true);
        alert("User did not respond in time. Please try again.");
      }
    }, 30000);
  };

  const handleDecline = (user) => {
    if (!socket || !isConnected) {
      setSocketError(true);
      return;
    }
    socket.emit("declineRunnerRequest", { runnerId, userId: user._id });
    setIsOpen(false);
    setProcessingUserId(null);
  };

  const handleClose = () => {
    setIsOpen(false);
    if (onClose) onClose();
  };

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
          className={`${darkMode ? "dark:bg-black-100" : "bg-white"} rounded-t-3xl shadow-2xl max-h-[80vh] w-full max-w-4xl flex flex-col`}
        >
          <div className="flex justify-center p-3">
            <h2 className="text-xl text-center max-w-lg font-bold text-black dark:text-white">
              You have received an order
            </h2>
          </div>

          {socketError && (
            <div className="mx-4 p-3 bg-red-100 dark:bg-red-900 rounded-lg">
              <p className="text-red-600 dark:text-red-300 text-center">
                Connection issue detected. Please close and try again.
              </p>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-3">
            <div className="max-w-lg mx-auto">
              <AnimatePresence>
                {requests.map((user) => {
                  const req = user.currentRequest || {};
                  const isRunErrand = req.serviceType === 'run-errand';

                  const midCoords = isRunErrand
                    ? req.marketCoordinates
                    : req.pickupCoordinates;

                  const deliveryCoords = req.deliveryCoordinates;

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
                      {isRunErrand &&
                        < p className="text-sm text-primary">
                          ⚠️ Only accept this order if you can confirm the items will be available at the market. If items are unavailable after payment, the order will be flagged for admin review
                        </p>
                      }
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

                          {/* ── Run Errand ── */}
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

                          {/* ── Pickup / Dropoff ── */}
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
                          <div className="flex gap-10 px-5 mt-5">
                            <button
                              className={`cursor-pointer font-medium text-lg text-white border rounded-md px-6 py-2 flex justify-between items-center min-w-[100px] ${!isConnected || processingUserId === user._id
                                ? 'bg-primary/20 cursor-not-allowed'
                                : 'bg-primary hover:bg-primary/70'
                                }`}
                              onClick={() => processingUserId === user._id ? null : handlePickService(user)}
                              disabled={!isConnected || processingUserId === user._id}
                            >
                              <span className="flex-1 text-center">
                                {processingUserId === user._id ? "Accepting" : !isConnected ? "Waiting.." : "Accept"}
                              </span>
                              {processingUserId === user._id && (
                                <div className="ml-2"><BarLoader /></div>
                              )}
                            </button>

                            <button
                              className={`cursor-pointer font-medium text-lg border rounded-md px-6 py-2 flex justify-between items-center min-w-[100px] ${!isConnected || processingUserId === user._id
                                ? 'bg-secondary text-gray-500 border-gray-300 cursor-not-allowed'
                                : 'bg-secondary text-gray-700 border-gray-300 hover:bg-secondary/50'
                                }`}
                              onClick={() => processingUserId === user._id ? null : handleDecline(user)}
                              disabled={!isConnected || processingUserId === user._id}
                            >
                              <span>Decline</span>
                              {processingUserId === user._id && <BarLoader />}
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
        </motion.div >
      </div >
    </>
  );
}

export default React.memo(RunnerNotifications);