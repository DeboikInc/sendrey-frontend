import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
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
  onFindMore, onFetchTopRated
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [isWaitingForRunner, setIsWaitingForRunner] = useState(false);
  const [selectedRunnerId, setSelectedRunnerId] = useState(null);
  const [isMobile, setIsMobile] = useState(false); // eslint-disable-line no-unused-vars

  const { socket, isConnected } = useSocket();
  const [currentOrder, setCurrentOrder] = useState(null);

  const [topRatedLoading, setTopRatedLoading] = useState(false);
  const [topRatedStatus, setTopRatedStatus] = useState(null);

  const timeoutRef = useRef(null);
  const pendingRequestRef = useRef(null);
  const selectedRunnerIdRef = useRef(null);

  // Use runnerResponseData directly
  const runners = useMemo(() => runnerResponseData?.runners || [], [runnerResponseData]);
  const count = runnerResponseData?.count || runners.length;
  const error = runnerResponseData?.error;
  const runnersRef = useRef(runners);
  const userIdRef = useRef(userData?._id);
  const proceedBufferRef = useRef(null);

  useEffect(() => { userIdRef.current = userData?._id; }, [userData]);
  useEffect(() => { runnersRef.current = runners; }, [runners]);

  const handleClose = useCallback(() => {
    setIsVisible(false);
    setIsWaitingForRunner(false);
    setSelectedRunnerId(null);
    selectedRunnerIdRef.current = null;
    pendingRequestRef.current = null;

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
    return () => {
      pendingRequestRef.current = null;
      selectedRunnerIdRef.current = null;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
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

    // Listen for enterPreRoom
    const handleEnterPreRoom = (data) => {
      // console.log(' enterPreRoom event received:', data);
    };

    // Listen for proceedToChat (when both are ready)
    const handleProceedToChat = (data) => {
      console.log('[proceedToChat] received:', data);
      console.log('[proceedToChat] pendingRequestRef.current:', pendingRequestRef.current);
      console.log('[proceedToChat] selectedRunnerIdRef.current:', selectedRunnerIdRef.current);
      console.log('[proceedToChat] socket rooms (client cannot see, but log socket.id):', socket?.id);
      console.log('[RSS] proceedToChat received:', data.chatId, 'pending:', pendingRequestRef.current);

      const userId = userIdRef.current;
      const pending = pendingRequestRef.current;
      // Use data.runnerId directly as the most reliable source
      const expectedChatId = `user-${userId}-runner-${data.runnerId}`;
      const matchesChat = data.chatId === pending?.chatId || data.chatId === expectedChatId;

      console.log('[proceedToChat] expectedChatId:', expectedChatId);
      console.log('[proceedToChat] matchesChat:', matchesChat);
      console.log('[proceedToChat] data.chatReady:', data.chatReady)

      if (!data.chatReady) return;

      if (!matchesChat) {
        // Buffer it — pendingRequestRef may not be set yet
        console.log('[RSS] buffering proceedToChat, no pending match yet');
        proceedBufferRef.current = data;
        return;
      }



      // console.log('✅ Chat ready! Proceeding to chat screen...');
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      pendingRequestRef.current = null;

      setIsWaitingForRunner(false);
      setSelectedRunnerId(null);

      const runnerData = runnersRef.current.find(r =>
        (r._id || r.id) === data.runnerId
      );

      if (onSelectRunner) {
        onSelectRunner(runnerData || {
          _id: data.runnerId,
          id: data.runnerId,
        }, currentOrder);
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
  }, [socket, isConnected, userData, selectedService, onSelectRunner]);


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

    const handleChatReset = (data) => {
      console.log('[chatReset] received:', data);
      console.log('[chatReset] pendingRequestRef.current:', pendingRequestRef.current);


      // Server reset the session (e.g. cancelled order archived)
      if (pendingRequestRef.current?.chatId === data.chatId) {
        console.log('[chatReset] ✅ matched — clearing pending state');
        pendingRequestRef.current = null;
        setIsWaitingForRunner(false);
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      }
    };

    socket.on('chatReset', handleChatReset);
    socket.on('orderCreated', handleOrderCreated);

    return () => {
      socket.off('orderCreated', handleOrderCreated);
      socket.off('chatReset', handleChatReset);
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
    console.log('[doRequest] called with runnerId:', runnerId, 'userId:', userId);

    if (pendingRequestRef.current) {
      const isSameRunner = pendingRequestRef.current.runnerId === runnerId;
      const isRecent = Date.now() - pendingRequestRef.current.timestamp < 15000;
      if (isSameRunner && isRecent) {
        console.warn('[doRequest] BLOCKED — already waiting for this runner');
        return;
      }
      if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
      pendingRequestRef.current = null;
      setIsWaitingForRunner(false);
      setSelectedRunnerId(null);
      selectedRunnerIdRef.current = null;
    }

    const chatId = `user-${userId}-runner-${runnerId}`;

    pendingRequestRef.current = { runnerId, userId, chatId, serviceType: selectedService, timestamp: Date.now() };
    setSelectedRunnerId(runnerId);
    selectedRunnerIdRef.current = runnerId;
    setIsWaitingForRunner(true);

    // ── Check if proceedToChat already arrived before we set pendingRef ──
    if (proceedBufferRef.current?.chatId === chatId) {
      console.log('[doRequest] consuming buffered proceedToChat');
      // const buffered = proceedBufferRef.current;
      proceedBufferRef.current = null;
      pendingRequestRef.current = null;
      setIsWaitingForRunner(false);
      setSelectedRunnerId(null);
      selectedRunnerIdRef.current = null;
      const runnerData = runnersRef.current.find(r => (r._id || r.id) === runnerId);
      onSelectRunner?.(runnerData || { _id: runnerId, id: runnerId }, currentOrder);
      return;
    }

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
        selectedRunnerIdRef.current = null;
        timeoutRef.current = null;
        alert('Runner did not respond. Please try another runner.');
      }
    }, 15000);
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] transition-opacity duration-300 ${isVisible ? "opacity-100" : "opacity-0"}`}
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
                  {runners.map((runner) => {
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

                <div className="flex flex-col items-center gap-2 pt-3">
                  <button
                    onClick={async () => {
                      setTopRatedLoading(true);
                      setTopRatedStatus(null);
                      try {
                        await onFetchTopRated();
                        setTopRatedStatus('success');
                      } catch {
                        setTopRatedStatus('error');
                      } finally {
                        setTopRatedLoading(false);
                        setTimeout(() => setTopRatedStatus(null), 3000);
                      }
                    }}
                    disabled={topRatedLoading}
                    className={`text-sm font-semibold border rounded-lg px-5 py-2 transition flex items-center gap-2
      ${topRatedLoading
                        ? 'text-yellow-300 border-yellow-300 opacity-60 cursor-not-allowed'
                        : 'text-yellow-500 border-yellow-500 hover:bg-yellow-500/10'
                      }`}
                  >
                    {topRatedLoading ? (
                      <>
                        <BarLoader size="small" />
                        <span>Fetching...</span>
                      </>
                    ) : (
                      '⭐ Show Top Rated Runner'
                    )}
                  </button>

                  {topRatedStatus === 'success' && (
                    <p className="text-xs text-green-500 font-medium">✓ Top rated runners loaded</p>
                  )}
                  {topRatedStatus === 'error' && (
                    <p className="text-xs text-red-400 font-medium">✗ Failed to fetch. Try again.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}