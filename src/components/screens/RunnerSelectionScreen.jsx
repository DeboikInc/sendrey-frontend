import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { Card, CardBody, Chip } from "@material-tailwind/react";
import { Star, X, Clock, MapPin, ChevronRight } from "lucide-react";
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
  runnerResponseData,
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [isWaitingForRunner, setIsWaitingForRunner] = useState(false);
  const [selectedRunnerId, setSelectedRunnerId] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const { socket, isConnected } = useSocket();
  const timeoutRef = useRef(null);
  const pendingRequestRef = useRef(null);

  // --- 1. INTELLIGENT RANKING ---
  // Sorts the list before rendering so the best match is always at index 0
  const sortedRunners = useMemo(() => {
    if (!runnerResponseData?.runners) return [];
    return [...runnerResponseData.runners].sort((a, b) => {
      // Prioritize Distance
      if (a.distance !== b.distance) return a.distance - b.distance;
      // Then Experience
      if (b.totalRuns !== a.totalRuns) return b.totalRuns - a.totalRuns;
      // Then Rating
      return (b.rating || 0) - (a.rating || 0);
    });
  }, [runnerResponseData]);

  const runners = sortedRunners;
  const count = runnerResponseData?.count || runners.length;

  // --- 2. AUTO RE-ASSIGN LOGIC ---
  const handleAutoReassign = useCallback(() => {
    const nextIndex = currentIndex + 1;
    if (nextIndex < runners.length) {
      console.log(`🔄 Auto-assigning next best runner: ${runners[nextIndex].firstName}`);
      setCurrentIndex(nextIndex);
      handleRunnerClick(runners[nextIndex], nextIndex);
    } else {
      setIsWaitingForRunner(false);
      alert("We couldn't connect you to a runner at this time. Please try again.");
      handleClose();
    }
  }, [currentIndex, runners]);

  const handleRunnerClick = (runner, index) => {
    const rId = runner._id || runner.id;
    const userId = userData?._id;
    const chatId = `task-${Date.now()}-${rId}`;

    setCurrentIndex(index);
    setSelectedRunnerId(rId);
    setIsWaitingForRunner(true);
    pendingRequestRef.current = { rId, chatId };

    // Emit to Socket
    socket.emit('requestRunner', {
      runnerId: rId,
      userId,
      chatId,
      serviceType: selectedService,
      vehicleType: selectedVehicle
    });

    // 35s Timeout before moving to the next runner automatically
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      handleAutoReassign();
    }, 35000);
  };

  // --- SOCKET LISTENERS ---
  useEffect(() => {
    if (!socket || !isConnected) return;

    socket.on('proceedToChat', (data) => {
      if (data.chatId === pendingRequestRef.current?.chatId) {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setIsWaitingForRunner(false);
        onSelectRunner(runners.find(r => (r._id || r.id) === data.runnerId));
      }
    });

    socket.on('runnerRejectedTask', (data) => {
      if (data.runnerId === selectedRunnerId) {
        handleAutoReassign();
      }
    });

    return () => {
      socket.off('proceedToChat');
      socket.off('runnerRejectedTask');
    };
  }, [socket, isConnected, selectedRunnerId, handleAutoReassign]);

  const handleClose = () => {
    setIsVisible(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setTimeout(() => onClose(), 300);
  };

  useEffect(() => {
    if (isOpen) setTimeout(() => setIsVisible(true), 10);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-[999] flex items-end justify-center transition-all duration-500 ${isVisible ? 'bg-black/60 backdrop-blur-sm' : 'bg-transparent'}`}>
      <div className={`w-full max-w-2xl transform transition-transform duration-500 ease-out ${isVisible ? 'translate-y-0' : 'translate-y-full'} ${darkMode ? 'bg-black-100' : 'bg-white'} rounded-t-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]`}>
        
        {/* Header */}
        <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-inherit">
          <div>
            <h2 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Runner Selection</h2>
            <p className="text-sm text-gray-500">Ranking based on proximity and rating</p>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {runners.map((runner, index) => {
            const rId = runner._id || runner.id;
            const isSelected = selectedRunnerId === rId;
            const isWaiting = isWaitingForRunner && isSelected;

            return (
              <Card
                key={rId}
                className={`relative transition-all duration-300 border shadow-none ${
                  isSelected ? 'border-primary ring-1 ring-primary' : 'border-gray-100 dark:border-gray-800'
                } ${isWaitingForRunner && !isSelected ? 'opacity-40 grayscale-[0.5]' : 'opacity-100'}`}
                onClick={() => !isWaitingForRunner && handleRunnerClick(runner, index)}
              >
                <CardBody className="p-4 flex items-center gap-4">
                  {/* Avatar Section */}
                  <div className="relative">
                    <img 
                      src={runner.avatar || "https://i.pravatar.cc/150"} 
                      className="w-16 h-16 rounded-2xl object-cover border-2 border-white shadow-sm"
                      alt="avatar" 
                    />
                    {index === 0 && (
                      <div className="absolute -top-2 -right-2 bg-blue-600 text-white p-1 rounded-full shadow-lg">
                        <Star className="w-3 h-3 fill-current" />
                      </div>
                    )}
                  </div>

                  {/* Info Section */}
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className={`font-bold text-lg ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                          {runner.firstName} {index === 0 && <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full ml-2 uppercase tracking-tighter">Best Match</span>}
                        </h4>
                        <div className="flex items-center gap-3 mt-1">
                           <span className="flex items-center text-xs font-medium text-gray-500">
                             <MapPin className="w-3 h-3 mr-1" /> {runner.distance?.toFixed(1) || '0.5'} km
                           </span>
                           <span className="flex items-center text-xs font-medium text-gray-500">
                             <Clock className="w-3 h-3 mr-1" /> {runner.eta || '5'} mins
                           </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                        <div className="flex items-center text-yellow-700 font-bold">
                          <Star className="w-4 h-4 fill-yellow-400 text-yellow-400 mr-1" />
                          {runner.rating || '5.0'}
                        </div>
                        <p className="text-[10px] text-gray-400">{runner.totalRuns || '120'} runs</p>
                      </div>
                    </div>

                    {/* Footer Chips */}
                    <div className="flex gap-2 mt-3">
                      <Chip value={runner.fleetType || "Bike"} size="sm" variant="ghost" className="rounded-lg text-[10px] capitalize" />
                      {runner.isOnline && <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse self-center" />}
                    </div>
                  </div>

                  {/* Status Indicator */}
                  <div className="flex flex-col items-center justify-center min-w-[60px]">
                    {isWaiting ? (
                      <BarLoader color="#2563eb" />
                    ) : isSelected ? (
                      <div className="bg-primary/10 p-2 rounded-full">
                        <ChevronRight className="w-5 h-5 text-primary" />
                      </div>
                    ) : null}
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>

        {/* Action Button - Shows up only when not waiting */}
        <div className="p-6 bg-inherit border-t border-gray-100 dark:border-gray-800">
          {!isWaitingForRunner ? (
            <button 
               onClick={() => handleRunnerClick(runners[0], 0)}
               className="w-full bg-primary hover:bg-primary/90 text-white py-4 rounded-2xl font-bold shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
            >
              Request Top Runner
            </button>
          ) : (
            <div className="text-center space-y-2">
               <p className="text-sm font-medium animate-pulse text-primary">Connecting you to {runners[currentIndex]?.firstName}...</p>
               <p className="text-xs text-gray-400">Next best runner available in {runners.length - currentIndex - 1} slots</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}