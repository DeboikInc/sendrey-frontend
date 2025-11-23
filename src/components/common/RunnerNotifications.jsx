import React, { useEffect, useState } from "react";
import { Card, CardBody, Chip } from "@material-tailwind/react";
import { X, Bell } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function RunnerNotifications({
  requests,
  runnerId,
  darkMode,
  onPickService
}) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Open notifications when there are requests
    if (requests && requests.length > 0) {
      console.log("RunnerNotifications - Requests received:", requests);
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [requests]);

  const handlePickService = (user) => {
    // console.log("🎯 Runner picked service:", request);
    setIsOpen(false);
    if (onPickService) {
      onPickService(user);
    }
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
      <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center px-4">
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 25 }}
          className={`${darkMode ? "dark:bg-black-100" : "bg-white"
            } rounded-t-3xl shadow-2xl max-h-[80vh] w-full max-w-4xl flex flex-col`}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold text-black dark:text-white">
                Available Service Requests ({requests.length})
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
                {requests.map((user) => (
                  <motion.div
                    key={user._id || user.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Card
                      className="cursor-pointer hover:shadow-lg transition-shadow border-2 border-primary"
                    >
                      <CardBody className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h4 className="font-bold text-lg text-black">
                              {user.firstName} {user.lastName || ""}
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              Phone: {user.phone}
                            </p>
                          </div>
                          <Chip
                            value="AVAILABLE"
                            size="sm"
                            color="green"
                            className="animate-pulse"
                          />
                        </div>

                        <div className="flex gap-2 mt-3">
                          <Chip
                            value={user.serviceType === "pick-up" ? "Pick Up" : "Run Errand"}
                            size="sm"
                            color="blue"
                            className="capitalize"
                          />
                          <Chip
                            value={user.fleetType}
                            size="sm"
                            color="gray"
                            className="capitalize"
                          />
                        </div>

                        <div className="mt-3 flex justify-between items-center text-sm">
                          <span className="text-gray-600 dark:text-gray-400">
                            Distance: ~{user.distance || "Nearby"}
                          </span>
                        </div>
                        <div className="flex justify-between px-5">
                          <p className="font-medium text-green-400"
                            onClick={() => handlePickService(user)}
                          >
                            Accept
                          </p>
                          <p className="font-medium text-red-400"
                            onClick={() => setIsOpen(false)}
                          >
                            Reject
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