import React, { useEffect, useState } from "react";
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
  userData
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [isWaitingForRunner, setIsWaitingForRunner] = useState(false);
  const [selectedRunnerId, setSelectedRunnerId] = useState(null);
  const [requestSent, setRequestSent] = useState(false);

  const dispatch = useDispatch();
  const { nearbyRunners, loading, error } = useSelector((state) => state.runners);


  const SOCKET_URL = "http://localhost:4001";
  const { socket, isConnected, onRunnerAccepted } = useSocket(SOCKET_URL);

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
    }
  }, [isOpen, dispatch, selectedService, selectedVehicle, userLocation]);


  // Listen for runner acceptance
  useEffect(() => {
    if (!socket || !isWaitingForRunner || !selectedRunnerId) return;

    const handleRunnerAccepted = (data) => {
      console.log('Runner accepted:', data);
      if (data.runnerId === selectedRunnerId) {
        // Runner accepted! Navigate to chat
        const runner = nearbyRunners.find(r => (r._id || r.id) === data.runnerId);
        if (runner) {
          setIsWaitingForRunner(false);
          setRequestSent(false);
          if (onSelectRunner) {
            onSelectRunner(runner);
          }
          handleClose();
        }
      }
    };
    onRunnerAccepted(handleRunnerAccepted);

    return () => {
      if (socket && socket.off) {
        socket.off('runnerAccepted', handleRunnerAccepted);
      }
    };
  }, [socket, isWaitingForRunner, selectedRunnerId, nearbyRunners, onSelectRunner, onRunnerAccepted]);

  const handleClose = () => {
    setIsVisible(false);
    setIsWaitingForRunner(false);
    setSelectedRunnerId(null);
    setTimeout(() => {
      if (typeof onClose === "function") onClose();
    }, 200);
  };

  const handleRunnerClick = (runner) => {
    if (isWaitingForRunner) return; // Prevent clicking while waiting

    const runnerId = runner._id || runner.id;
    const userId = userData?._id;

    if (!socket || !isConnected || !userId) return;

    setSelectedRunnerId(runnerId);
    setIsWaitingForRunner(true);
    setRequestSent(false);

    // Build chatId and emit request to backend
    if (socket && isConnected && userData?._id) {
      const chatId = `user-${userData._id}-runner-${runnerId}`;

      socket.emit('requestRunner', {
        runnerId,
        userId: userData._id,
        chatId,
        serviceType: selectedService
      });

      console.log('Sent runner request:', { runnerId, userId: userData._id, chatId });
    } else {
      console.error('Cannot request runner: missing socket, userData, or not connected');
      setIsWaitingForRunner(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-300 ${isVisible ? "opacity-100" : "opacity-0"}`}
        onClick={handleClose}
      />

      <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center px-4">
        <div
          className={`${darkMode ? "dark:bg-black-100" : "bg-white"} rounded-t-3xl shadow-2xl max-h-[80vh] w-full max-w-4xl flex flex-col transition-transform duration-300 ease-out ${isVisible ? "translate-y-0" : "translate-y-full"}`}
        >
          <div className="flex items-center justify-between p-4">
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

          <div className="flex-1 overflow-y-auto p-4">

            {/* Runners List */}
            {!loading && !locationError && nearbyRunners.length > 0 && (
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
                        onClick={() => handleRunnerClick(runner)}
                        style={isThisRunnerWaiting ? { pointerEvents: 'none' } : {}}
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

                          {/* Show BarLoader ONLY on clicked runner at flex-end */}
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

            {/* No Runners Found */}
            {!loading && !locationError && nearbyRunners.length === 0 && userLocation && (
              <div className="text-center py-8">
                <p className="text-gray-600 dark:text-gray-400 text-lg mb-2">
                  No available runners nearby
                </p>
                <p className="text-gray-500 dark:text-gray-500 text-sm">
                  Try again in a few moments or adjust your service type
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}