import React, { useEffect, useState } from "react";
import { Card, CardBody } from "@material-tailwind/react";
import { MapPin } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useDispatch } from "react-redux";
import { setRunnerOnlineStatus } from "../../Redux/runnerSlice";
import BarLoader from "../common/BarLoader";

export default function RunnerNotifications({
  requests,
  runnerId,
  darkMode,
  onPickService,
  socket,
  isConnected,
  onClose,
}) {
  const dispatch = useDispatch();
  const [isOpen, setIsOpen] = useState(false);
  const [processingUserId, setProcessingUserId] = useState(null);
  const [socketError, setSocketError] = useState(false);

  useEffect(() => {
    // Open notifications when there are requests
    if (requests && requests.length > 0) {
      console.log("RunnerNotifications - Requests received:", requests);
      console.log("Socket connection status:", isConnected);
      setIsOpen(true);
      setSocketError(false);
    } else {
      setIsOpen(false);
    }
  }, [requests, isConnected]);

  const handlePickService = async (user) => {
    // Check socket connection FIRST
    if (!socket || !isConnected) {
      console.error("Socket not connected, cannot accept request");
      setSocketError(true);
      return;
    }

    setProcessingUserId(user._id);
    console.log("🏃 Runner accepting user:", user._id);

    const chatId = `user-${user._id}-runner-${runnerId}`;
    const serviceType = user.currentRequest?.serviceType || user.serviceType;
    console.log("Chat ID:", chatId);

    // Double check socket is still connected
    if (!socket.connected) {
      setProcessingUserId(null);
      setSocketError(true);
      return;
    }

    // ✅ Listen for enterPreRoom event
    const handleEnterPreRoom = (data) => {
      if (data.chatId === chatId) {
        console.log("✅ Received enterPreRoom, runner waiting in pre-room...");
        // Keep loading, don't stop yet
        socket.off("enterPreRoom", handleEnterPreRoom);
      }
    };

    // ✅ Listen for proceedToChat event (when both are in pre-room)
    const handleProceedToChat = (data) => {
      if (data.chatId === chatId && data.chatReady) {
        console.log("✅ Both parties in pre-room! Chat ready, proceeding...");

        // Clean up listeners
        socket.off("proceedToChat", handleProceedToChat);
        socket.off("enterPreRoom", handleEnterPreRoom);

        // Join actual chat room
        socket.emit("runnerJoinChat", {
          runnerId,
          userId: user._id,
          chatId,
          serviceType
        });

        // ✅ Stop loading and close notification
        setIsOpen(false);
        setProcessingUserId(null);

        // Navigate to chat
        if (onPickService) {
          onPickService(user);
        }
      }
    };

    // Register listeners BEFORE emitting
    socket.on("enterPreRoom", handleEnterPreRoom);
    socket.on("proceedToChat", handleProceedToChat);

    // Emit acceptRunnerRequest to socket server
    console.log("Emitting acceptRunnerRequest to server...");
    socket.emit("acceptRunnerRequest", {
      runnerId,
      userId: user._id,
      chatId,
      serviceType
    });

    console.log(" acceptRunnerRequest event emitted - Waiting for both parties...");

    // Timeout fallback - increased to account for waiting time
    setTimeout(() => {
      socket.off("proceedToChat", handleProceedToChat);
      socket.off("enterPreRoom", handleEnterPreRoom);

      if (processingUserId === user._id) {
        console.log("Timeout waiting for both parties in pre-room");
        setProcessingUserId(null);
        setSocketError(true);

        // Show error message
        alert("User did not respond in time. Please try again.");
      }
    }, 30000); // 30 second timeout - gives user time to accept
  };

  const handleDecline = (user) => {
    // Check socket connection for decline
    if (!socket || !isConnected) {
      console.error("Socket not connected, cannot decline");
      setSocketError(true);
      return;
    }

    setProcessingUserId(user._id);

    // Emit decline event to server
    socket.emit("declineRunnerRequest", {
      runnerId,
      userId: user._id,
    });

    setIsOpen(false);
    setProcessingUserId(null);
  };

  const handleClose = () => {
    setIsOpen(false);
    if (onClose) {
      onClose();
    }
  };

  if (!isOpen || !requests || requests.length === 0) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
        onClick={handleClose}
      />

      {/* Bottom Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center">
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 25 }}
          className={`${darkMode ? "dark:bg-black-100" : "bg-white"
            } rounded-t-3xl shadow-2xl max-h-[80vh] w-full max-w-4xl flex flex-col`}
        >
          {/* Header */}
          <div className="flex justify-center p-3">
            <h2 className="text-xl text-center max-w-lg font-bold text-black dark:text-white">
              You have received an order
            </h2>
          </div>

          {/* Socket Connection Status */}
          {socketError && (
            <div className="mx-4 p-3 bg-red-100 dark:bg-red-900 rounded-lg">
              <p className="text-red-600 dark:text-red-300 text-center">
                Connection issue detected. Please close the card and try again.
              </p>
            </div>
          )}

          {/* Notifications List */}
          <div className="flex-1 overflow-y-auto p-3">
            <div className="max-w-lg mx-auto">
              <AnimatePresence>
                {requests.map((user) => {
                  return (
                    <motion.div
                      key={user._id || user.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Card className="dark:text-gray-300 dark:bg-black-100 shadow-none">
                        <CardBody className="p-4 text-black dark:text-gray-100">
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex gap-2 flex-col">
                              <div>
                                <p className="text-lg">Sender's Name</p>
                                <p className="text-2xl font-bold">{user.firstName} {user.lastName || ""}</p>
                              </div>
                              <div>
                                <p className="text-lg">Service Type</p>
                                <p className="capitalize">{user.currentRequest?.serviceType?.replace('-', ' ') || "Pickup/Dropoff"}</p>
                              </div>
                              <div>
                                <p className="text-lg">Pickup Location</p>
                                <div className="border border-2 rounded-md border-gray-300 h-10 w-100 p-2 text-start text-sm text-blue-400">
                                  {user.currentRequest?.pickupLocation || "No pickup address provided"}
                                </div>
                              </div>
                              <div>
                                <p className="text-lg">Delivery Location</p>
                                <div className="flex items-center gap-2">
                                  <div className="border border-2 rounded-md border-gray-300 h-10 w-100 p-2 text-start text-sm text-red-400">
                                    {user.currentRequest?.deliveryLocation || "No delivery address provided"}
                                  </div>
                                  <MapPin className="h-4 w-4" />
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-10 px-5 mt-5">
                            <button
                              className={`cursor-pointer font-medium text-lg text-white border rounded-md px-6 py-2 flex justify-between items-center min-w-[100px] ${!isConnected || processingUserId === user._id
                                ? 'bg-primary/20 cursor-not-allowed'
                                : 'bg-primary hover:bg-primary/70'
                                }`}
                              onClick={() => processingUserId === user._id ? null : handlePickService(user)}
                              disabled={!isConnected || processingUserId === user._id}
                            >
                              {/* Left side: Text */}
                              <span className="flex-1 text-center">
                                {processingUserId === user._id
                                  ? "Accepting"
                                  : !isConnected
                                    ? "Waiting.."
                                    : "Accept"
                                }
                              </span>

                              {/* Right side: Loader (only shows when processing) */}
                              {processingUserId === user._id && (
                                <div className="ml-2">
                                  <BarLoader
                                  />
                                </div>
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
                              {/* Text on left */}
                              <span>Decline</span>

                              {/* Loader on right when processing */}
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
        </motion.div>
      </div>
    </>
  );
}