// components/userScreens/TrackDeliveryScreen.jsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import { ArrowLeft, MapPin, Navigation, Wifi, WifiOff, Clock } from "lucide-react";
import useTracking from "../../hooks/useTracking";

const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

// Load Google Maps script once
let mapsLoaded = false;
let mapsLoading = false;
const mapsCallbacks = [];

const loadGoogleMaps = () => {
    return new Promise((resolve) => {
        if (mapsLoaded) return resolve();
        mapsCallbacks.push(resolve);
        if (mapsLoading) return;

        mapsLoading = true;
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=geometry`;
        script.async = true;
        script.onload = () => {
            mapsLoaded = true;
            mapsCallbacks.forEach(cb => cb());
            mapsCallbacks.length = 0;
        };
        document.head.appendChild(script);
    });
};

// Runner arrow marker SVG — rotates based on heading
const createRunnerMarkerIcon = (heading = 0) => ({
    path: 'M12 2L8 18L12 14L16 18L12 2Z',
    fillColor: '#6366f1',
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 2,
    scale: 1.8,
    rotation: heading,
    anchor: new window.google.maps.Point(12, 12),
});

export const TrackDeliveryScreen = ({ darkMode, trackingData, onClose, socket, orderId }) => {
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [mapReady, setMapReady] = useState(false);

    const mapRef = useRef(null);           // DOM element
    const mapInstanceRef = useRef(null);   // google.maps.Map instance
    const markerRef = useRef(null);        // runner marker
    const userMarkerRef = useRef(null);    // user's own location marker

    const currentStage = trackingData?.currentStage || 0;
    const progressPercentage = trackingData?.progressPercentage || 0;
    const deliveryLocation = trackingData?.deliveryLocation || null; // { lat, lng }

    const { runnerLocation, runnerName, isRunnerOnline, isConnecting } = useTracking({
        orderId,
        socket,
        enabled: isFullScreen,
    });

    const stages = [
        { label: "Order Accepted", time: trackingData?.stageTimes?.[0] || null },
        { label: "Runner at pickup location", time: trackingData?.stageTimes?.[1] || null },
        { label: "On the way to you", time: trackingData?.stageTimes?.[2] || null },
        { label: "Runner arrived", time: trackingData?.stageTimes?.[3] || null },
        { label: "Delivered", time: trackingData?.stageTimes?.[4] || null },
    ];

    // ─── Init map 

    const initMap = useCallback(async () => {
        if (!mapRef.current || mapInstanceRef.current) return;

        await loadGoogleMaps();

        const defaultCenter = deliveryLocation || { lat: 6.5244, lng: 3.3792 }; // Lagos default

        const map = new window.google.maps.Map(mapRef.current, {
            center: defaultCenter,
            zoom: 15,
            disableDefaultUI: true,
            zoomControl: true,
            styles: darkMode ? darkMapStyles : lightMapStyles,
        });

        mapInstanceRef.current = map;

        // Drop a pin at the delivery location
        if (deliveryLocation) {
            new window.google.maps.Marker({
                position: deliveryLocation,
                map,
                icon: {
                    path: window.google.maps.SymbolPath.CIRCLE,
                    fillColor: '#ef4444',
                    fillOpacity: 1,
                    strokeColor: '#ffffff',
                    strokeWeight: 2,
                    scale: 10,
                },
                title: 'Delivery Location',
            });
        }

        setMapReady(true);
    }, [darkMode, deliveryLocation]);

    useEffect(() => {
        if (isFullScreen) {
            // Small delay to let the DOM render before initializing map
            const t = setTimeout(initMap, 100);
            return () => clearTimeout(t);
        }
    }, [isFullScreen, initMap]);

    // ─── Update runner marker when location changes ────────────────────────────

    useEffect(() => {
        if (!mapReady || !mapInstanceRef.current || !runnerLocation) return;

        const position = { lat: runnerLocation.lat, lng: runnerLocation.lng };

        if (!markerRef.current) {
            // Create marker on first location update
            markerRef.current = new window.google.maps.Marker({
                position,
                map: mapInstanceRef.current,
                icon: createRunnerMarkerIcon(runnerLocation.heading),
                title: runnerName || 'Runner',
                optimized: false, // needed for rotation updates
            });
        } else {
            // Smoothly animate marker to new position
            animateMarker(markerRef.current, position, runnerLocation.heading);
        }

        // Pan map to keep runner in view
        mapInstanceRef.current.panTo(position);

    }, [runnerLocation, mapReady, runnerName]);

    // ─── Smooth marker animation ───────────────────────────────────────────────

    const animateMarker = (marker, targetPos, heading) => {
        const startPos = marker.getPosition();
        if (!startPos) return marker.setPosition(targetPos);

        const frames = 30;
        const latStep = (targetPos.lat - startPos.lat()) / frames;
        const lngStep = (targetPos.lng - startPos.lng()) / frames;
        let frame = 0;

        const animate = () => {
            frame++;
            const newLat = startPos.lat() + latStep * frame;
            const newLng = startPos.lng() + lngStep * frame;
            marker.setPosition({ lat: newLat, lng: newLng });
            marker.setIcon(createRunnerMarkerIcon(heading));
            if (frame < frames) requestAnimationFrame(animate);
        };

        requestAnimationFrame(animate);
    };

    // ─── Cleanup map on unmount ────────────────────────────────────────────────

    useEffect(() => {
        return () => {
            markerRef.current = null;
            mapInstanceRef.current = null;
        };
    }, []);

    const handleOpen = () => setIsFullScreen(true);

    const handleClose = () => {
        setIsFullScreen(false);
        if (onClose) onClose();
    };

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

                    {/* Online indicator */}
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
                        <div className="bg-primary h-1 rounded-full transition-all duration-500" style={{ width: `${progressPercentage}%` }} />
                    </div>
                </div>
            </div>
        );
    }

    // ─── Full screen tracking view ─────────────────────────────────────────────

    return (
        <div className="fixed inset-0 z-50 flex flex-col">

            {/* Header */}
            <div className="bg-primary p-4 flex items-center gap-3 text-white">
                <button onClick={handleClose} className="p-1.5 hover:bg-white/10 rounded-full transition-colors">
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="flex-1">
                    <p className="font-semibold">Track Runner</p>
                    {runnerName && (
                        <p className="text-xs text-white/70">{runnerName}</p>
                    )}
                </div>
                {/* Online/offline badge */}
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
                <div ref={mapRef} className="absolute inset-0" />

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
            <div className={`${darkMode ? 'bg-black-100' : 'bg-white'} p-5 max-h-[45vh] overflow-y-auto`}>

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
                                    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                                        isCompleted
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
                                        <div className={`w-0.5 h-7 transition-all duration-300 ${
                                            isCompleted ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'
                                        }`} />
                                    )}
                                </div>

                                {/* Stage info */}
                                <div className="flex-1 pb-1">
                                    <p className={`text-sm font-medium transition-colors ${
                                        isCompleted || isActive
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

// ─── Google Maps styles ────────────────────────────────────────────────────────

const lightMapStyles = [
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
    { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9e9e9e' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c9d8f0' }] },
    { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#f9f9f9' }] },
];

const darkMapStyles = [
    { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2d3561' }] },
    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#212a37' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0d2137' }] },
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

export default TrackDeliveryScreen;