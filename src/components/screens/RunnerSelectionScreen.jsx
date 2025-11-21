import React, { useEffect, useState } from "react";
import { Card, CardBody, Chip } from "@material-tailwind/react";
import { useDispatch, useSelector } from "react-redux";
import { Star, X } from "lucide-react";
import { fetchNearbyRunners } from "../../Redux/runnerSlice";

export default function RunnerSelectionScreen({
  selectedVehicle,
  selectedService,
  onSelectRunner,
  darkMode,
  isOpen,
  onClose
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  
  const dispatch = useDispatch();
  const { nearbyRunners, loading, error } = useSelector((state) => state.runners);

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

  if (!isOpen) return null;

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => {
      if (typeof onClose === "function") onClose();
    }, 200);
  };

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
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
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
            {/* Location Error */}
            {/* {locationError && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
                <p className="text-red-600 dark:text-red-400 text-center">
                  {locationError}
                </p>
              </div>
            )} */}

            {/* Loading State */}
            {loading && (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-300 border-t-blue-600 mb-2"></div>
                <p className="text-gray-500">Finding nearby runners...</p>
              </div>
            )}

            {/* API Error */}
            {/* {error && !loading && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
                <p className="text-red-600 dark:text-red-400 text-center">
                  {error.message || 'Failed to fetch runners'}
                </p>
              </div>
            )} */}

            {/* Runners List */}
            {!loading && !locationError && nearbyRunners.length > 0 && (
              <div className="max-w-md mx-auto">
                <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl p-4 mb-4">
                  <p className="text-gray-700 dark:text-gray-300">
                    Found {nearbyRunners.length} available runner{nearbyRunners.length !== 1 ? 's' : ''} nearby. Who would you like?
                  </p>
                </div>

                <div className="space-y-3">
                  {nearbyRunners.map((runner) => (
                    <Card
                      key={runner._id || runner.id}
                      className="cursor-pointer hover:shadow-lg transition-shadow"
                      onClick={() => {
                        onSelectRunner(runner);
                        handleClose();
                      }}
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
                      </CardBody>
                    </Card>
                  ))}
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