// socket/trackingHandlers.js
const locationStore = require('../services/locationTracking/locationStore');
const Order = require('../models/Order');
const socketOrderMap = new Map();

const registerTrackingHandlers = (io, socket) => {
    // Runner location update
    socket.on('runner:locationUpdate', async (data) => {
        const { orderId, lat, lng, heading = 0, speed = 0 } = data;
        socketOrderMap.set(socket.id, orderId);

        if (!orderId || lat == null || lng == null) {
            return socket.emit('tracking:error', { message: 'Missing orderId, lat or lng' });
        }

        try {
            const order = await Order.findOne({ orderId }).select('runnerId userId status');
            if (!order) return socket.emit('tracking:error', { message: 'Order not found' });

            const locationPayload = {
                lat,
                lng,
                heading,
                speed,
                socketId: socket.id,
                updatedAt: Date.now(),
            };

            // Store in Redis
            await locationStore.setLocation(orderId, order.runnerId, locationPayload);

            // Broadcast to everyone watching this order
            io.to(`tracking:${orderId}`).emit('runner:locationUpdate', {
                orderId,
                ...locationPayload
            });

        } catch (err) {
            console.error('runner:locationUpdate error:', err.message);
        }
    });

    // User starts watching
    socket.on('user:watchOrder', async ({ orderId }) => {
        if (!orderId) return;

        try {
            const order = await Order.findOne({ orderId })
                .select('userId runnerId status serviceType deliveryLocation deliveryCoordinates pickupLocation pickupCoordinates marketLocation marketCoordinates')
                .populate('runnerId', 'firstName lastName fleetType');

            if (!order) return socket.emit('tracking:error', { message: 'Order not found' });

            socket.join(`tracking:${orderId}`);

            // Get last known location from Redis
            const lastKnown = await locationStore.getLocation(orderId);

            // Send immediately if exists
            if (lastKnown) {
                socket.emit('runner:locationUpdate', {
                    orderId,
                    ...lastKnown
                });
            }

            // Prepare response based on service type
            const trackingData = {
                orderId,
                serviceType: order.serviceType,
                runnerName: [order.runnerId?.firstName, order.runnerId?.lastName]
                    .filter(Boolean)
                    .join(' ') || 'Your Runner',
                runnerFleetType: order.runnerId?.fleetType || 'pedestrian',
                hasActiveLocation: !!lastKnown,
            };

            // Add appropriate location data based on service type
            if (order.serviceType === 'run-errand') {
                // For run-errand: show market location on map
                trackingData.destinationLocation = order.marketLocation?.address || null;
                trackingData.destinationCoordinates = order.marketCoordinates; 
                trackingData.deliveryLocation = order.deliveryLocation?.address || null; 
                trackingData.deliveryCoordinates = order.deliveryCoordinates; 
            } else {
                // For pick-up: show pickup location on map initially
                trackingData.destinationLocation = order.pickupLocation?.address || null;
                trackingData.destinationCoordinates = order.pickupCoordinates;
                trackingData.deliveryLocation = order.deliveryLocation?.address || null; 
                trackingData.deliveryCoordinates = order.deliveryCoordinates;
            }

            socket.emit('tracking:joined', trackingData);

        } catch (err) {
            console.error('user:watchOrder error:', err.message);
        }
    });

    // Stop watching
    socket.on('user:stopWatching', ({ orderId }) => {
        if (!orderId) return;
        socket.leave(`tracking:${orderId}`);
    });

    // Runner stops tracking
    socket.on('runner:stopTracking', async ({ orderId, userId }) => {
        if (!orderId) return;

        try {
            await locationStore.removeLocation(orderId);
            io.to(`tracking:${orderId}`).emit('runner:offline', { orderId });
        } catch (err) {
            console.error('runner:stopTracking error:', err.message);
        }
    });

    // Cleanup on disconnect
    socket.on('disconnect', async () => {
        const orderId = socketOrderMap.get(socket.id);
        if (orderId) {
            // Optionally notify that runner went offline
            io.to(`tracking:${orderId}`).emit('runner:offline', { orderId });
            socketOrderMap.delete(socket.id);
        }
    });
};

module.exports = { registerTrackingHandlers };