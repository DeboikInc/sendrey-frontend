import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { Card, CardBody, Chip, Button } from "@material-tailwind/react";
import { useDispatch, useSelector } from "react-redux";
import { Star, X ,Clock, MapPin, ChevronRight} from "lucide-react";
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
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [isWaitingForRunner, setIsWaitingForRunner] = useState(false);
  const [selectedRunnerId, setSelectedRunnerId] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0); // For "Show More" logic
  const [isMobile, setIsMobile] = useState(false);

  const dispatch = useDispatch();

  const { socket, isConnected } = useSocket();

  const timeoutRef = useRef(null);
  const pendingRequestRef = useRef(null);

  // Use runnerResponseData directly
  const runners = runnerResponseData?.runners || [];
  const count = runnerResponseData?.count || runners.length;
  const error = runnerResponseData?.error;

// 1. AI-Assisted Ranking Logic (PRD 5.1)
const sortedRunners = useMemo(() => {
    if (!runnerResponseData?.runners) return [];
    return [...runnerResponseData.runners].sort((a, b) => {
      // Priority: Proximity (if available) > Completion Rate > Rating
      if (a.distance !== b.distance) return a.distance - b.distance;
      if (b.totalRuns !== a.totalRuns) return b.totalRuns - a.totalRuns;
      return (b.rating || 0) - (a.rating || 0);
    });
  }, [runnerResponseData]);

const currentRunner = sortedRunners[currentIndex]

// 2. Automated Reassignment Flow 
  const handleAutoReassign = useCallback(() => {
    console.log("Runner timed out or rejected. Attempting auto-reassign...");
    
    if (currentIndex < sortedRunners.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      // Trigger request for the next runner automatically
      handleRunnerClick(sortedRunners[nextIndex], true);
    } else {
      alert("No more runners available nearby. Please try again later.");
      handleClose();
    }
  }, [currentIndex, sortedRunners]);

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
    if (!socket || !isConnected || !userData?._id) return;

    const handleProceedToChat = (data) => {
      if (data.chatReady && data.chatId === pendingRequestRef.current?.chatId) {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setIsWaitingForRunner(false);
        onSelectRunner(sortedRunners.find(r => (r._id || r.id) === data.runnerId));
      }
    };

    // PRD 5.3: Handle explicit Rejection
    const handleRunnerRejected = (data) => {
       if (data.runnerId === selectedRunnerId) {
          handleAutoReassign();
       }
    };

    socket.on('proceedToChat', handleProceedToChat);
    socket.on('runnerRejectedTask', handleRunnerRejected);

    return () => {
      socket.off('proceedToChat', handleProceedToChat);
      socket.off('runnerRejectedTask', handleRunnerRejected);
    };
  }, [socket, isConnected, userData, selectedRunnerId, handleAutoReassign]);

  const handleRunnerClick = (runner, isAuto = false) => {
    const runnerId = runner._id || runner.id;
    const userId = userData?._id;
    const chatId = `task-${Date.now()}-u${userId}-r${runnerId}`;

    pendingRequestRef.current = { runnerId, userId, chatId };
    setSelectedRunnerId(runnerId);
    setIsWaitingForRunner(true);

    socket.emit('requestRunner', {
      runnerId,
      userId,
      chatId,
      serviceType: selectedService,
      vehicleType: selectedVehicle // Vehicle matching
    });

    //  Timeout Logic (35s)
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      handleAutoReassign();
    }, 35000);
  };

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
                              <div className="flex items-center">
                                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                                <span className="text-sm ml-1 text-black dark:text-white">
                                  {runner.rating?.toFixed(1) || "5.0"}
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
                            <div className="ml-auto pl-3">
                              <BarLoader />
                            </div>
                          )}
                        </CardBody>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}