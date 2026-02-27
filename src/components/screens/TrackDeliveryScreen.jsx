// components/userScreens/TrackDeliveryScreen.jsx
import React, { useState } from "react";
import { ArrowLeft, MapPin, Wifi, WifiOff, Clock } from "lucide-react";
import { Button } from "@material-tailwind/react";
import useTracking from "../../hooks/useTracking";
import { LiveTrackingMap } from "../tracking/LiveTrackingMap";

export const TrackDeliveryScreen = ({ darkMode, onClose, socket, orderId }) => {
    const [isFullScreen, setIsFullScreen] = useState(false);

    const { 
        runnerLocation, 
        runnerName, 
        runnerFleetType, 
        destinationCoordinates, // This is what we show on map
        destinationLocation,    // This is the address string
        isRunnerOnline, 
        isConnecting 
    } = useTracking({
        orderId,
        socket,
        enabled: true,
    });

    const handleOpen = () => setIsFullScreen(true);
    const handleClose = () => {
        setIsFullScreen(false);
        if (onClose) onClose();
    };

    // Mini card view
    if (!isFullScreen) {
        return (
            <div
                onClick={handleOpen}
                className={`w-64 rounded-2xl cursor-pointer overflow-hidden shadow-md transition-transform active:scale-95 ${darkMode ? 'bg-black-200' : 'bg-white'}`}
            >
                <div className="h-24 bg-primary/20 flex items-center justify-center relative">
                    <div className="absolute inset-0 bg-gradient-to-b from-primary/10 to-primary/30" />
                    <MapPin className="h-8 w-8 text-primary animate-bounce relative z-10" />
                    <div className={`absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${isRunnerOnline ? 'bg-green-500/20 text-green-600' : 'bg-gray-300/50 text-gray-500'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${isRunnerOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                        {isRunnerOnline ? 'Live' : 'Offline'}
                    </div>
                </div>
                <div className="p-3">
                    <p className={`font-bold text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>Track Runner</p>
                    <p className={`text-xs mt-0.5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {isRunnerOnline ? 'Tap to see live location' : 'Runner location updating soon'}
                    </p>
                </div>
            </div>
        );
    }

    // Full screen view
    return (
        <div className="fixed inset-0 z-50 flex flex-col">
            <div className="bg-primary p-4 flex items-center gap-3 text-white">
                <Button onClick={handleClose} className="p-1.5 hover:bg-white/10 rounded-full transition-colors">
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex-1">
                    <p className="font-semibold">Track Runner</p>
                    {runnerName && <p className="text-xs text-white/70">{runnerName}</p>}
                </div>
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${isRunnerOnline ? 'bg-green-500/20 text-green-300' : 'bg-white/10 text-white/50'}`}>
                    {isConnecting ? (
                        <>
                            <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                            Connecting...
                        </>
                    ) : isRunnerOnline ? (
                        <>
                            <Wifi className="h-3 w-3" />
                            Live
                        </>
                    ) : (
                        <>
                            <WifiOff className="h-3 w-3" />
                            Offline
                        </>
                    )}
                </div>
            </div>

            <div className="flex-1 relative">
                <LiveTrackingMap
                    runnerLocation={runnerLocation}
                    deliveryLocation={destinationCoordinates} // Use destinationCoordinates
                    runnerFleetType={runnerFleetType}
                    runnerHeading={runnerLocation?.heading || 0}
                    darkMode={darkMode}
                    className="absolute inset-0"
                    showPath={true}
                />

                {isConnecting && (
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-10">
                        <div className="bg-white dark:bg-gray-800 rounded-2xl px-6 py-4 flex items-center gap-3 shadow-xl">
                            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Locating runner...</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Destination info overlay */}
            {destinationLocation && (
                <div className="absolute bottom-4 left-4 right-4 z-10">
                    <div className={`${darkMode ? 'bg-black-100/90' : 'bg-white/90'} backdrop-blur-sm rounded-2xl p-4 shadow-xl`}>
                        <p className={`text-sm font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Destination</p>
                        <p className={`font-semibold ${darkMode ? 'text-white' : 'text-black-200'}`}>
                            {destinationLocation}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TrackDeliveryScreen;