// runner component
import React, { useEffect, useState } from "react";
import { Card, CardBody, Chip } from "@material-tailwind/react";
import { X, MapPin } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useSocket } from "../../hooks/useSocket"

export default function RunnerNotifications({
  requests,
  runnerId,
  darkMode,
  onPickService
}) {
  const [isOpen, setIsOpen] = useState(false);
  const SOCKET_URL = "http://localhost:4001";
  const { socket, isConnected } = useSocket(SOCKET_URL);

  useEffect(() => {
    // Open notifications when there are requests
    if (requests && requests.length > 0) {
      console.log("RunnerNotifications - Requests received:", requests);
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [requests]);

  const handlePickService = async (user) => {
    console.log("🎯 Runner accepting user:", user._id);
    // console.log("🎯 Runner picked service:", request);

    const chatId = `user-${user._id}-runner-${runnerId}`;
    console.log("🎯 Chat ID:", chatId);

    if (socket && isConnected) {
      try {
        console.log("📤 Emitting acceptRunnerRequest to server...");
        socket.emit("acceptRunnerRequest", {
          runnerId,
          userId: user._id,
          chatId,
          serviceType: user.serviceType
        });

        console.log("✅ acceptRunnerRequest event emitted");
      } catch (error) {
        console.error("❌ Error emitting acceptRunnerRequest:", error);
      }
    } else {
      console.error("❌ Socket not connected or not available");
    }

    setIsOpen(false);

    if (onPickService) {
      onPickService(user);
    }
  };

  const handleDecline = (user) => {
    // Emit decline event to server
    if (socket && isConnected) {
      socket.emit("declineRunnerRequest", {
        runnerId,
        userId: user._id,
      });
    }

    setIsOpen(false);
  };


  if (!isOpen || !requests || requests.length === 0) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
        onClick={() => setIsOpen(false)}
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
              {/* ({requests.length}) */}
            </h2>
          </div>

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
                      <Card
                        className="dark:text-gray-300 dark:bg-black-100 shadow-none"
                      >
                        <CardBody className="p-4 text-black dark:text-gray-100">
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex gap-2 flex-col">
                              <div>
                                <p className="text-lg">Sender's Name</p>
                                <p className="text-2xl font-bold ">{user.firstName} {user.lastName || ""}</p>
                              </div>
                              <div>
                                <p className="text-lg">Pickup/Dropoff</p>
                                <p>delivery in 20 mins. </p>
                              </div>
                              <div>
                                <p className="text-lg">Location: </p>
                                <div className="border border-2 rounded-md border-gray-300 h-10 w-100 p-2 text-start text-sm text-blue-400"> No 12 dele, Town Square Lagos</div> {/* logo */}
                              </div>
                              <div>
                                <p className="text-lg">Delivery Location: </p>
                                <div className="flex items-center gap-2">
                                  <div className="border border-2 rounded-md border-gray-300 h-10 w-100 p-2 text-start text-sm text-red-400"> No 40 dele, Allen Square-Otawu Lagos</div> <span><MapPin /></span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-10 px-5 mt-5">
                            <p className="cursor-pointer font-medium text-lg text-white bg-blue-400 border rounded-md px-3 p-1"
                              onClick={() => handlePickService(user)}
                            >
                              Accept
                            </p>
                            <p className="cursor-pointer font-medium text-lg text-gray-400 border border-gray-300 rounded-md px-3 p-1"
                              onClick={() => handleDecline(user)}
                            >
                              Decline

                            </p>
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