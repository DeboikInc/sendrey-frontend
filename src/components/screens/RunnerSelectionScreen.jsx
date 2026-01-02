import React, { useEffect, useState, useCallback } from "react";
import { Card, CardBody, Chip } from "@material-tailwind/react";
import { useDispatch, useSelector } from "react-redux";
import { Star, X } from "lucide-react";
import { fetchNearbyRunners } from "../../Redux/runnerSlice";
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
  className = ""
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [isWaitingForRunner, setIsWaitingForRunner] = useState(false);
  const [selectedRunnerId, setSelectedRunnerId] = useState(null);
  const [isMobile, setIsMobile] = useState(false);

  const dispatch = useDispatch();
  const { nearbyRunners, loading, error } = useSelector((state) => state.runners);

  const { socket, joinChat, sendMessage, isConnected } = useSocket();

  const handleClose = useCallback(() => {
    setIsVisible(false);
    setIsWaitingForRunner(false);
    setSelectedRunnerId(null);
    setTimeout(() => {
      if (typeof onClose === "function") onClose();
    }, 200);
  }, [onClose]);

  // Get user's current location
  useEffect(() => {
    if (isOpen && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
          setLocationError(null);
        },
        (error) => {
          console.error('Error getting location:', error);
          setLocationError('Unable to get your location. Please enable location services.');
        }
      );
    }
  }, [isOpen]);

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
      // Prevent body scroll on mobile when sheet is open
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

  // Fetch nearby runners when location is available
  useEffect(() => {
    if (isOpen && selectedService && userLocation) {
      dispatch(fetchNearbyRunners({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        serviceType: selectedService,
        fleetType: selectedVehicle
      }));
      setTimeout(() => setIsVisible(true), 10);
    } else if (!isOpen) {
      setIsVisible(false);
      setIsWaitingForRunner(false);
      setSelectedRunnerId(null);
    }
  }, [isOpen, dispatch, selectedService, selectedVehicle, userLocation]);

  // Listen for runner events
  useEffect(() => {
    if (!socket || !isWaitingForRunner || !selectedRunnerId) return;

    const proceedToChat = (runnerId) => {
      const runner = nearbyRunners.find(r => (r._id || r.id) === runnerId);
      if (runner) {
        setIsWaitingForRunner(false);
        setSelectedRunnerId(null);
        if (onSelectRunner) onSelectRunner(runner);
        setTimeout(() => handleClose(), 100);
      }
    };

    const handleRunnerAccepted = (data) => {
      console.log('runnerAccepted event received:', data);
      if (data.runnerId === selectedRunnerId) {
        proceedToChat(data.runnerId);
      }
    };

    const handleChatJoinSuccess = (data) => {
      console.log('chatJoinSuccess event received:', data);
      if (data.runnerId === selectedRunnerId) {
        proceedToChat(data.runnerId);
      }
    };

    const handleWaitingForRunner = (data) => {
      console.log('waitingForRunner event received:', data);
    };

    socket.on('runnerAccepted', handleRunnerAccepted);
    socket.on('chatJoinSuccess', handleChatJoinSuccess);
    socket.on('waitingForRunner', handleWaitingForRunner);

    return () => {
      socket.off('runnerAccepted', handleRunnerAccepted);
      socket.off('chatJoinSuccess', handleChatJoinSuccess);
      socket.off('waitingForRunner', handleWaitingForRunner);
    };
  }, [socket, isWaitingForRunner, selectedRunnerId, nearbyRunners, onSelectRunner, handleClose]);

  const handleRunnerClick = (runner) => {
    const runnerId = runner._id || runner.id;
    const userId = userData?._id;

    setSelectedRunnerId(runnerId);
    setIsWaitingForRunner(true);

    if (!socket || !isConnected || !userId) {
      console.error('Socket not connected or userId missing');
      return;
    }

    const chatId = `user-${userId}-runner-${runnerId}`;

    socket.emit('requestRunner', {
      runnerId,
      userId,
      chatId,
      serviceType: selectedService
    });

    console.log('Sent runner request:', { runnerId, userId, chatId });

    socket.emit('userJoinChat', {
      userId,
      runnerId,
      chatId
    });

    console.log('Sent userJoinChat:', { userId, runnerId, chatId });
  };

  useEffect(() => {
    if (!socket || !isConnected) return;
    if (!isWaitingForRunner || !selectedRunnerId || !userData?._id) return;

    console.log("Socket reconnected — resuming runner request");

    const runnerId = selectedRunnerId;
    const userId = userData._id;
    const chatId = `user-${userId}-runner-${runnerId}`;

    socket.emit('requestRunner', {
      runnerId,
      userId,
      chatId,
      serviceType: selectedService
    });

    socket.emit('userJoinChat', {
      userId,
      runnerId,
      chatId
    });

  }, [isConnected, socket, isWaitingForRunner, selectedRunnerId, userData, selectedService]);

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
            {/* Loading State */}
            {loading && (
              <div className="flex justify-center items-center py-12">
                <BarLoader />
              </div>
            )}

            {/* Any Error or No Runners Available */}
            {!loading && (locationError || error || nearbyRunners.length === 0) && (
              <div className="text-center py-12 px-4">
                <p className="text-gray-600 dark:text-gray-400 text-lg mb-2">
                  No available runners nearby
                </p>
                <p className="text-gray-500 dark:text-gray-500 text-sm">
                  Try again in a few moments or adjust your service type
                </p>
              </div>
            )}

            {/* Runners List */}
            {!loading && !locationError && !error && nearbyRunners.length > 0 && (
              <div className="max-w-md mx-auto">
                <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl p-4 mb-4">
                  <p className="text-gray-700 dark:text-gray-300">
                    Found {nearbyRunners.length} available runner{nearbyRunners.length !== 1 ? 's' : ''} nearby. Who would you like?
                  </p>
                </div>

                <div className="space-y-3">
                  {nearbyRunners.map((runner) => {
                    const isThisRunnerWaiting = isWaitingForRunner && selectedRunnerId === (runner._id || runner.id);
                    return (
                      <Card
                        key={runner._id || runner.id}
                        className={`transition-all ${isThisRunnerWaiting ? 'opacity-70' : 'cursor-pointer hover:shadow-lg'}`}
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