import React, { useEffect, useState, useCallback, useRef } from "react";
import { Card, CardBody, Chip, } from "@material-tailwind/react";
import { Star, X } from "lucide-react";
import BarLoader from "../common/BarLoader";
import { useSocket } from "../../hooks/useSocket";

export default function RunnerSelectionScreen({
  selectedVehicle,
  selectedService,
  onSelectRunner,
  darkMode,
  isOpen,
  onClose,
  userData,
  className = "",
  runnerResponseData,
  specialInstructions = null,
  onFindMore
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [isWaitingForRunner, setIsWaitingForRunner] = useState(false);
  const [selectedRunnerId, setSelectedRunnerId] = useState(null);
  const [isMobile, setIsMobile] = useState(false); // eslint-disable-line no-unused-vars

  const PAGE_SIZE = 2;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const { socket, isConnected } = useSocket();

  const timeoutRef = useRef(null);
  const pendingRequestRef = useRef(null);
  const [currentOrder, setCurrentOrder] = useState(null);

  // Use runnerResponseData directly
  const runners = runnerResponseData?.runners || [];
  const count = runnerResponseData?.count || runners.length;
  const error = runnerResponseData?.error;

  const handleClose = useCallback(() => {
    setIsVisible(false);
    setIsWaitingForRunner(false);
    setSelectedRunnerId(null);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    pendingRequestRef.current = null;

    setTimeout(() => {
      if (typeof onClose === "function") onClose();
    }, 200);
  }, [onClose]);

  // mobile ?
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setTimeout(() => setIsVisible(true), 50);
    } else {
      document.body.style.overflow = '';
      setIsVisible(false);
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Setup socket event listeners
  useEffect(() => {
    if (!socket || !isConnected) return;

    const userId = userData?._id;
    if (!userId) return;

    // Listen for enterPreRoom
    const handleEnterPreRoom = (data) => {
      // console.log(' enterPreRoom event received:', data);
    };

    // Listen for proceedToChat (when both are ready)
    const handleProceedToChat = (data) => {
      // console.log(' proceedToChat event received:', data);

      const pending = pendingRequestRef.current;
      if (!pending) return;

      const matchesChat = data.chatId === pending.chatId;

      if (matchesChat && data.chatReady) {
        // console.log('✅ Chat ready! Proceeding to chat screen...');

        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }

        pendingRequestRef.current = null;

        // Join actual chat room
        socket.emit('userJoinChat', {
          userId,
          runnerId: data.runnerId,
          chatId: data.chatId,
          serviceType: selectedService
        });

        setIsWaitingForRunner(false);
        setSelectedRunnerId(null);

        const runnerData = runners.find(r =>
          (r._id || r.id) === data.runnerId
        );

        if (onSelectRunner) {
          onSelectRunner(runnerData || {
            _id: data.runnerId,
            id: data.runnerId,
          }, currentOrder);
        }
      }
    };

    socket.on('enterPreRoom', handleEnterPreRoom);
    socket.on('proceedToChat', handleProceedToChat);

    // console.log('Socket event listeners registered for user:', userId);

    return () => {
      socket.off('enterPreRoom', handleEnterPreRoom);
      socket.off('proceedToChat', handleProceedToChat);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, isConnected, userData, selectedService, onSelectRunner, runners]);


  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleReconnect = () => {
      const pending = pendingRequestRef.current;
      if (!pending) return;

      // Re-emit the original request — server may have lost the pre-room state
      socket.emit('requestRunner', {
        runnerId: pending.runnerId,
        userId: pending.userId,
        chatId: pending.chatId,
        serviceType: selectedService,
        specialInstructions: specialInstructions || null,
      });

      // Also rejoin user room in case it was lost
      socket.emit('rejoinUserRoom', {
        userId: pending.userId,
        userType: 'user',
      });
    };

    socket.on('connect', handleReconnect);
    return () => socket.off('connect', handleReconnect);
  }, [socket, isConnected, selectedService, specialInstructions]);

  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleOrderCreated = (data) => {
      // console.log('RunnerSelectionScreen received orderCreated:', data);
      const order = data.order || data;
      setCurrentOrder(order);
    };

    socket.on('orderCreated', handleOrderCreated);

    return () => {
      socket.off('orderCreated', handleOrderCreated);
    };
  }, [socket, isConnected]);

  const handleRunnerClick = (runner) => {
    const runnerId = runner._id || runner.id;
    const userId = userData?._id;

    if (!socket || !userId) {
      alert('Connection issue. Please try again.');
      return;
    }

    // if disconnected, try to reconnect and wait
    if (!isConnected) {
      socket.connect();
      const waitForConnection = (attempts = 0) => {
        if (socket.connected) {
          doRequest(runnerId, userId);
        } else if (attempts < 10) {
          setTimeout(() => waitForConnection(attempts + 1), 500);
        } else {
          alert('Could not reconnect. Please check your connection and try again.');
        }
      };
      waitForConnection();
      return;
    }

    doRequest(runnerId, userId);
  };

  const doRequest = (runnerId, userId) => {
    if (isWaitingForRunner || pendingRequestRef.current) return;

    const chatId = `user-${userId}-runner-${runnerId}`;

    pendingRequestRef.current = {
      runnerId, userId, chatId,
      serviceType: selectedService,
      timestamp: Date.now()
    };

    setSelectedRunnerId(runnerId);
    setIsWaitingForRunner(true);

    socket.emit('requestRunner', {
      runnerId, userId, chatId,
      serviceType: selectedService,
      specialInstructions: specialInstructions || null
    });

    timeoutRef.current = setTimeout(() => {
      if (pendingRequestRef.current?.runnerId === runnerId) {
        pendingRequestRef.current = null;
        setIsWaitingForRunner(false);
        setSelectedRunnerId(null);
        timeoutRef.current = null;
        alert('Runner did not respond. Please try another runner.');
      }
    }, 35000);
  };

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [runnerResponseData]);

  if (!isOpen) return null;

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] transition-opacity duration-300 ${isVisible ? "opacity-100" : "opacity-0"}`}
        onClick={handleClose}
        onTouchStart={(e) => e.preventDefault()}
      />

      <div className="fixed bottom-0 left-0 right-0 z-[10000] flex justify-center px-4">
        <div
          className={`${darkMode ? "dark:bg-black-100" : "bg-white"} 
            rounded-t-3xl shadow-2xl 
            lg:h-full
            h-[85vh]
            w-full max-w-4xl mx-auto
            flex flex-col 
            transition-transform duration-300 ease-out 
            ${isVisible ? "translate-y-0" : "translate-y-full"}`}
        >
          {/* Header - Fixed */}
          <div className="flex items-center justify-between p-4 flex-shrink-0 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold text-black dark:text-white">
              Available Runners Nearby
            </h2>
            <button
              onClick={handleClose}
              aria-label="Close runner selection"
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            >
              <X className="h-5 w-5 text-gray-600 dark:text-gray-300" />
            </button>
          </div>

          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto p-4 pb-8 min-h-0">
            {/* Any Error or No Runners Available */}
            {error || runners.length === 0 ? (
              <div className="text-center py-12 px-4">
                <p className="text-gray-600 dark:text-gray-400 text-lg mb-2">
                  {error || "No available runners nearby"}
                </p>
                <p className="text-gray-500 dark:text-gray-500 text-sm">
                  Try again in a few moments or adjust your service type
                </p>
              </div>
            ) : (
              <div className="max-w-md mx-auto">
                <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl p-4 mb-4">
                  <p className="text-gray-700 dark:text-gray-300">
                    Found {count} available runner{count !== 1 ? 's' : ''} nearby. Who would you like?
                  </p>
                </div>

                <div className="space-y-3">
                  {runners.slice(0, visibleCount).map((runner) => {
                    const isThisRunnerWaiting = isWaitingForRunner && selectedRunnerId === (runner._id || runner.id);
                    return (
                      <Card
                        key={runner._id || runner.id}
                        className={`transition-all ${isThisRunnerWaiting ? 'opacity-70' : 'cursor-pointer hover:shadow-lg'} ${isWaitingForRunner && !isThisRunnerWaiting ? 'opacity-50 pointer-events-none' : ''}`}
                        onClick={() => !isWaitingForRunner && handleRunnerClick(runner)}
                      >
                        <CardBody className="flex flex-row items-center p-3">
                          <img
                            src={runner.avatar || "https://cdn-icons-png.flaticon.com/512/149/149071.png"}
                            alt={runner.firstName + " " + (runner.lastName || "")}
                            className="w-12 h-12 rounded-full mr-3 object-cover"
                          />
                          <div className="flex-1">
                            <div className="flex justify-between items-center">
                              <h4 className="font-bold text-black dark:text-gray-800">
                                {runner.firstName} {runner.lastName || ""}
                              </h4>
                              <div className="flex items-center gap-0.5">
                                {[1, 2, 3, 4, 5].map((star) => {
                                  const full = runner.rating >= star;
                                  const half = !full && runner.rating >= star - 0.5;
                                  return (
                                    <div key={star} className="relative h-4 w-4 flex-shrink-0">
                                      <Star className="absolute h-4 w-4" style={{ fill: 'none', color: '#c0c4ca' }} />
                                      {full && (
                                        <Star className="absolute h-4 w-4" style={{ fill: '#facc15', color: '#facc15' }} />
                                      )}
                                      {half && (
                                        <div className="absolute overflow-hidden" style={{ width: '50%' }}>
                                          <Star className="h-4 w-4" style={{ fill: '#facc15', color: '#facc15' }} />
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                                <span className="text-sm ml-1" style={{ color: '#6b7280' }}>
                                  {runner.rating > 0 ? Number(runner.rating).toFixed(1) : 'New'}
                                </span>
                              </div>
                              
                            </div>
                            <div className="flex justify-between items-center text-sm text-gray-600 dark:text-gray-400 mt-1">
                              <span>{runner.totalRuns || 0} deliveries</span>
                              <div className="flex items-center gap-2">
                                <Chip
                                  value={runner.fleetType || "N/A"}
                                  size="sm"
                                  className="capitalize"
                                  color="blue"
                                />
                                {runner.isOnline && (
                                  <Chip
                                    value="Online"
                                    size="sm"
                                    color="green"
                                  />
                                )}
                              </div>
                            </div>
                          </div>

                          {isThisRunnerWaiting && (
                            <div className="ml-3 w-4 h-4 flex-shrink-0">
                              <BarLoader size="small" />
                            </div>
                          )}
                        </CardBody>
                      </Card>
                    );
                  })}
                </div>

                {runners.length > PAGE_SIZE && (
                  <div className="flex justify-center pt-3">
                    <button
                      onClick={() => visibleCount < runners.length
                        ? setVisibleCount(prev => prev + PAGE_SIZE)
                        : onFindMore?.()
                      }
                      className="text-sm font-semibold text-primary border border-primary rounded-lg px-5 py-2 hover:bg-primary/30 transition">
                      {visibleCount < runners.length
                        ? `Find More Runners`
                        : 'Find More Runners' // get top runners too
                      }
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}