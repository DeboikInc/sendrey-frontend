import { useState, useEffect } from 'react';

const useTracking = ({ orderId, socket, enabled = false }) => {
    const [runnerLocation, setRunnerLocation] = useState(null);
    const [runnerName, setRunnerName] = useState('');
    const [runnerFleetType, setRunnerFleetType] = useState('pedestrian');
    const [destinationLocation, setDestinationLocation] = useState(null); // string for display
    const [destinationCoordinates, setDestinationCoordinates] = useState(null); // {lat, lng} for map
    const [deliveryLocation, setDeliveryLocation] = useState(null); // for later use
    const [deliveryCoordinates, setDeliveryCoordinates] = useState(null); // for later use
    const [serviceType, setServiceType] = useState(null);
    const [isRunnerOnline, setIsRunnerOnline] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState(null);

    // Socket listeners — always active
    useEffect(() => {
        if (!socket || !orderId) return;

        const onJoined = (data) => {
            setIsConnecting(false);
            setIsRunnerOnline(data.hasActiveLocation);
            setRunnerName(data.runnerName || 'Your Runner');
            setRunnerFleetType(data.runnerFleetType || 'pedestrian');
            setServiceType(data.serviceType);
            
            // Set destination (market for errand, pickup for pickup)
            setDestinationLocation(data.destinationLocation);
            setDestinationCoordinates(data.destinationCoordinates);
            
            // Store delivery for later use
            setDeliveryLocation(data.deliveryLocation);
            setDeliveryCoordinates(data.deliveryCoordinates);
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

    // Watch/unwatch
    useEffect(() => {
        if (!socket || !orderId || !enabled) return;

        setIsConnecting(true);
        socket.emit('user:watchOrder', { orderId });

        return () => {
            socket.emit('user:stopWatching', { orderId });
        };
    }, [socket, orderId, enabled]);

    return { 
        runnerLocation, 
        runnerName, 
        isRunnerOnline, 
        runnerFleetType,
        destinationLocation,
        destinationCoordinates,
        deliveryLocation,
        deliveryCoordinates,
        serviceType,
        isConnecting, 
        error 
    };
};

export default useTracking;