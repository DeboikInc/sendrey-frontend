import React, { useEffect, useState } from "react";
import { Card, CardBody, Chip } from "@material-tailwind/react";
import { useDispatch, useSelector } from "react-redux";
import { Star, X } from "lucide-react";
import { fetchRunnersByService } from "../../Redux/userSlice";

export default function RunnerSelectionScreen({
  selectedVehicle,
  selectedService,
  onSelectRunner,
  darkMode,
  isOpen,
  onClose
}) {
  const [isVisible, setIsVisible] = useState(false);
  const dispatch = useDispatch();
  const { runners, loading, error } = useSelector((state) => state.users);

  useEffect(() => {
    if (isOpen && selectedService) {
      // Fetch runners by service type
      dispatch(fetchRunnersByService({ serviceType: selectedService, fleetType: selectedVehicle }));
      setTimeout(() => setIsVisible(true), 10);
    } else {
      setIsVisible(false);
    }
  }, [isOpen, dispatch, selectedService]);

  if (!isOpen) return null;

  // Filter by vehicle type (backend already filtered by service)
  const availableRunners = runners?.filter(r => r.fleetType === selectedVehicle) || [];

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
              Select Runner
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
            {loading && (
              <p className="text-gray-500 text-center">Loading runners...</p>
            )}

            {!loading && availableRunners.length > 0 && (
              <div className="max-w-md mx-auto">
                <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl p-4 mb-4">
                  <p className="text-gray-700 dark:text-gray-300">
                    Found {availableRunners.length} available runners. Who would you like?
                  </p>
                </div>

                <div className="space-y-3">
                  {availableRunners.map((runner) => (
                    <Card
                      key={runner._id || runner.id}
                      className="cursor-pointer hover:shadow-lg transition-shadow"
                      onClick={() => {
                        onSelectRunner(runner);
                        onClose();
                      }}
                    >
                      <CardBody className="flex flex-row items-center p-3">
                        <img
                          src={runner.avatar || "https://cdn-icons-png.flaticon.com/512/149/149071.png"}
                          alt={runner.firstName + " " + (runner.lastName || "")}
                          className="w-12 h-12 rounded-full mr-3"
                        />
                        <div className="flex-1">
                          <div className="flex justify-between items-center">
                            <h4 className="font-bold text-black dark:text-gray-800">
                              {runner.firstName + " " + (runner.lastName || "")}
                            </h4>
                            <div className="flex items-center">
                              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                              <span className="text-sm ml-1 text-black dark:text-white">
                                {runner.rating?.toFixed(1) || "N/A"}
                              </span>
                            </div>
                          </div>
                          <div className="flex justify-between items-center text-sm text-gray-600 dark:text-gray-400">
                            <span>{runner.totalRuns || 0} deliveries</span>
                            <Chip
                              value={runner.fleetType || "N/A"}
                              size="sm"
                              className="capitalize"
                              color={runner.online ? "green" : "gray"}
                            />
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {!loading && availableRunners.length === 0 && (
              <p className="text-gray-500 text-center">
                No available runners for this service and vehicle.
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}