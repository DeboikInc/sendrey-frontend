import React, { useEffect, useState } from "react";
import { Card, CardBody, Chip } from "@material-tailwind/react";
import { X, Bell } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function RunnerNotifications({
  socket,
  runnerId,
  serviceType,
  darkMode,
  onPickService
}) {
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!socket) return;

    // Listen for existing requests
    socket.on("existingRequests", (requests) => {
      setNotifications(requests);
      if (requests.length > 0) setIsOpen(true);
    });

    // Listen for new service requests
    socket.on("newServiceRequest", (request) => {
      setNotifications(prev => [...prev, request]);
      setIsOpen(true);
    });

    // Listen for picked services
    socket.on("servicePicked", ({ requestId, runnerName }) => {
      setNotifications(prev => 
        prev.filter(n => n.requestId !== requestId)
      );
    });

    // Listen if service was already taken
    socket.on("serviceTaken", ({ requestId }) => {
      setNotifications(prev => 
        prev.filter(n => n.requestId !== requestId)
      );
    });

    return () => {
      socket.off("existingRequests");
      socket.off("newServiceRequest");
      socket.off("servicePicked");
      socket.off("serviceTaken");
    };
  }, [socket]);

  const handlePickService = (request) => {
    if (socket) {
      socket.emit("pickService", {
        requestId: request.requestId,
        runnerId,
        runnerName: "Runner Name" // Replace with actual runner name
      });
    }
    
    if (onPickService) {
      onPickService(request);
    }
  };

  if (!isOpen || notifications.length === 0) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
        onClick={() => setIsOpen(false)}
      />

      {/* Bottom Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center px-4">
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 25 }}
          className={`${
            darkMode ? "dark:bg-black-100" : "bg-white"
          } rounded-t-3xl shadow-2xl max-h-[80vh] w-full max-w-4xl flex flex-col`}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold text-black dark:text-white">
                You have received an order ({notifications.length})
              </h2>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            >
              <X className="h-5 w-5 text-gray-600 dark:text-gray-300" />
            </button>
          </div>

          {/* Notifications List */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="max-w-md mx-auto space-y-3">
              <AnimatePresence>
                {notifications.map((notification) => (
                  <motion.div
                    key={notification.requestId}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Card
                      className="cursor-pointer hover:shadow-lg transition-shadow border-2 border-primary"
                      onClick={() => handlePickService(notification)}
                    >
                      <CardBody className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h4 className="font-bold text-lg text-black dark:text-white">
                              {notification.userName}
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              Requested: {new Date(notification.createdAt).toLocaleTimeString()}
                            </p>
                          </div>
                          <Chip
                            value="NEW"
                            size="sm"
                            color="green"
                            className="animate-pulse"
                          />
                        </div>

                        <div className="flex gap-2 mt-3">
                          <Chip
                            value={notification.serviceType === "pick-up" ? "Pick Up" : "Run Errand"}
                            size="sm"
                            color="blue"
                            className="capitalize"
                          />
                          <Chip
                            value={notification.fleetType}
                            size="sm"
                            color="gray"
                            className="capitalize"
                          />
                        </div>

                        <div className="mt-3 text-center">
                          <p className="text-sm font-medium text-primary">
                            Tap to accept this service →
                          </p>
                        </div>
                      </CardBody>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
}