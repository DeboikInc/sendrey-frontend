// hooks/useTracking.js
// Manages the socket subscription for live runner location
// and exposes location state to the TrackDeliveryScreen component

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * @param {object} options
 * @param {string} options.orderId      - The order to track
 * @param {object} options.socket       - Your existing socket.io client instance
 * @param {boolean} options.enabled     - Only subscribe when tracking screen is open
 */
const useTracking = ({ orderId, socket, enabled = false }) => {
    const [runnerLocation, setRunnerLocation] = useState(null); // { lat, lng, heading, speed, updatedAt }
    const [runnerName, setRunnerName] = useState('');
    const [isRunnerOnline, setIsRunnerOnline] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState(null);

    const watchingRef = useRef(false);

    const startWatching = useCallback(() => {
        if (!socket || !orderId || watchingRef.current) return;

        setIsConnecting(true);
        watchingRef.current = true;

        socket.emit('user:watchOrder', { orderId });
    }, [socket, orderId]);

    const stopWatching = useCallback(() => {
        if (!socket || !orderId || !watchingRef.current) return;
        socket.emit('user:stopWatching', { orderId });
        watchingRef.current = false;
    }, [socket, orderId]);

    useEffect(() => {
        if (!socket || !orderId) return;

        const onJoined = (data) => {
            setIsConnecting(false);
            setIsRunnerOnline(data.hasActiveLocation);
            setRunnerName(data.runnerName || 'Your Runner');
        };

        const onLocationUpdate = (data) => {
            if (data.orderId !== orderId) return;
            setIsRunnerOnline(true);
            setIsConnecting(false);
            setRunnerLocation({
                lat: data.lat,
                lng: data.lng,
                heading: data.heading || 0,
                speed: data.speed || 0,
                updatedAt: data.updatedAt,
            });
        };

        const onRunnerOffline = (data) => {
            if (data.orderId !== orderId) return;
            setIsRunnerOnline(false);
        };

        const onError = (data) => {
            setError(data.message);
            setIsConnecting(false);
        };

        socket.on('tracking:joined', onJoined);
        socket.on('runner:locationUpdate', onLocationUpdate);
        socket.on('runner:offline', onRunnerOffline);
        socket.on('tracking:error', onError);

        return () => {
            socket.off('tracking:joined', onJoined);
            socket.off('runner:locationUpdate', onLocationUpdate);
            socket.off('runner:offline', onRunnerOffline);
            socket.off('tracking:error', onError);
        };
    }, [socket, orderId]);

    // Start/stop watching based on enabled flag (true when screen is open)
    useEffect(() => {
        if (enabled) {
            startWatching();
        } else {
            stopWatching();
        }

        return () => stopWatching();
    }, [enabled, startWatching, stopWatching]);

    return {
        runnerLocation,   // { lat, lng, heading, speed, updatedAt } | null
        runnerName,       // string
        isRunnerOnline,   // bool — false if runner disconnected or hasn't started yet
        isConnecting,     // bool — true while waiting for first location
        error,            // string | null
    };
};

export default useTracking;