// components/userScreens/TrackDeliveryScreen.jsx
import React, { useState, useEffect } from "react";
import { ArrowLeft, MapPin, Wifi, WifiOff, Clock } from "lucide-react";
import useTracking from "../../hooks/useTracking";
import { LiveTrackingMap } from "../tracking/LiveTrackingMap";

export const TrackDeliveryScreen = ({
    darkMode,
    trackingData,
    onClose,
    socket,
    orderId,
    serviceType
}) => {
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [userLocation, setUserLocation] = useState(null);

    const {
        runnerLocation,
        runnerName,
        runnerFleetType,
        deliveryCoordinates,
        // deliveryLocation,
        isRunnerOnline,
        isConnecting,
        currentStage: liveStage,
    } = useTracking({
        orderId,
        socket,
        enabled: true,
    });

    // Use live stage from hook; fall back to prop if hook hasn't caught up yet
    const currentStage = liveStage || trackingData?.currentStage || 0;
    
    const isPickup = serviceType === 'pick-up' || serviceType === 'pick_up';
    const stages = [
        { label: "Order Accepted", time: trackingData?.stageTimes?.[0] || null },
        { label: isPickup ? "Runner at pickup" : "Runner at market", time: trackingData?.stageTimes?.[1] || null },
        { label: "On the way to you", time: trackingData?.stageTimes?.[2] || null },
        { label: "Runner arrived", time: trackingData?.stageTimes?.[3] || null },
        { label: isPickup ? "Item delivered" : "Delivered", time: trackingData?.stageTimes?.[4] || null },
    ];

    const progressPercentage = currentStage === 0 ? (trackingData?.progressPercentage || 0)
        : Math.round((currentStage / (stages.length - 1)) * 100);

    const handleOpen = () => setIsFullScreen(true);
    const handleClose = () => {
        setIsFullScreen(false);
        if (onClose) onClose();
    };

    // User's own GPS position
    useEffect(() => {
        if (!navigator.geolocation) return;
        const id = navigator.geolocation.watchPosition(
            (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            (err) => console.warn(err),
            { enableHighAccuracy: true, maximumAge: 5000 }
        );
        return () => navigator.geolocation.clearWatch(id);
    }, []);

    // ─── Mini card (shown in chat) ─────────────────────────────────────────────
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
                    <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                        <div
                            className="bg-primary h-1 rounded-full transition-all duration-500"
                            style={{ width: `${progressPercentage}%` }}
                        />
                    </div>
                </div>
            </div>
        );
    }

    // ─── Full screen tracking view ─────────────────────────────────────────────
    return (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ height: '100dvh' }}>

            {/* Header */}
            <div className="bg-primary p-4 flex items-center gap-3 text-white">
                <button onClick={handleClose} className="p-1.5 hover:bg-white/10 rounded-full transition-colors">
                    <ArrowLeft className="h-5 w-5" />
                </button>
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

            {/* Map */}
            <div className="flex-1 relative">
                <LiveTrackingMap
                    runnerLocation={runnerLocation}
                    deliveryLocation={deliveryCoordinates}
                    userLocation={userLocation}
                    runnerFleetType={runnerFleetType}
                    runnerHeading={runnerLocation?.heading || 0}
                    darkMode={darkMode}
                    className="absolute inset-0"
                    showPath={true}
                />

                {/* Connecting overlay */}
                {isConnecting && (
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-10">
                        <div className="bg-white dark:bg-gray-800 rounded-2xl px-6 py-4 flex items-center gap-3 shadow-xl">
                            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Locating runner...</p>
                        </div>
                    </div>
                )}

                {/* Runner offline notice */}
                {!isConnecting && !isRunnerOnline && (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
                        <div className="bg-white dark:bg-gray-800 rounded-full px-4 py-2 shadow-lg flex items-center gap-2">
                            <WifiOff className="h-4 w-4 text-gray-400" />
                            <p className="text-xs text-gray-500">Runner location unavailable</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Progress + stages */}
            <div className={`${darkMode ? 'bg-black-100' : 'bg-white'} p-5 max-h-[50dv] overflow-y-auto marketSelection`}>

                {/* Progress bar */}
                <div className="mb-5">
                    <div className="flex justify-between items-center mb-2">
                        <p className={`text-xs font-semibold tracking-widest ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            ORDER PROGRESS
                        </p>
                        <p className="text-xs font-bold text-primary">{progressPercentage}%</p>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                            className="bg-primary h-2 rounded-full transition-all duration-700 ease-out"
                            style={{ width: `${progressPercentage}%` }}
                        />
                    </div>
                </div>

                {/* Stage timeline */}
                <div className="space-y-0">
                    {stages.map((stage, index) => {
                        const isCompleted = currentStage > index;
                        const isActive = currentStage === index;

                        return (
                            <div key={index} className="flex items-start gap-3">
                                {/* Timeline dot + line */}
                                <div className="flex flex-col items-center">
                                    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 ${isCompleted
                                        ? 'bg-primary'
                                        : isActive
                                            ? 'bg-primary ring-4 ring-primary/20'
                                            : 'bg-gray-200 dark:bg-gray-700'
                                        }`}>
                                        {isCompleted && (
                                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                        {isActive && (
                                            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                                        )}
                                    </div>
                                    {index < stages.length - 1 && (
                                        <div className={`w-0.5 h-7 transition-all duration-300 ${isCompleted ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'
                                            }`} />
                                    )}
                                </div>

                                {/* Stage info */}
                                <div className="flex-1 pb-1">
                                    <p className={`text-sm font-medium transition-colors ${isCompleted || isActive
                                        ? darkMode ? 'text-white' : 'text-gray-900'
                                        : 'text-gray-400'
                                        }`}>
                                        {stage.label}
                                    </p>
                                    {stage.time && (
                                        <div className="flex items-center gap-1 mt-0.5">
                                            <Clock className="h-3 w-3 text-gray-400" />
                                            <p className="text-xs text-gray-400">{stage.time}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default TrackDeliveryScreen;