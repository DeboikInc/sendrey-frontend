// socket/trackingHandlers.js
const locationStore = require('../services/locationTracking/locationStore');
const Order = require('../models/Order');
const socketOrderMap = new Map();

// Track which orders have already fired arrival events to avoid repeated emits
const arrivedAtSourceSet = new Set();   // orderId — runner reached market/pickup
const arrivedAtDeliverySet = new Set(); // orderId — runner reached delivery

// Haversine distance in meters between two {lat, lng} points
const getDistanceMeters = (a, b) => {
    if (!a || !b) return Infinity;
    const R = 6371000;
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const sinLat = Math.sin(dLat / 2);
    const sinLng = Math.sin(dLng / 2);
    const c =
        sinLat * sinLat +
        Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
    return R * 2 * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c));
};

const ARRIVAL_THRESHOLD_METERS = 50;

const registerTrackingHandlers = (io, socket) => {

    // Runner location update
    socket.on('runner:locationUpdate', async (data) => {
        const { orderId, lat, lng, heading = 0, speed = 0 } = data;

        console.log('[TRACKING] Location update received:', { orderId, lat, lng, heading, speed });

        socketOrderMap.set(socket.id, orderId);

        if (!orderId || lat == null || lng == null) {
            return socket.emit('tracking:error', { message: 'Missing orderId, lat or lng' });
        }

        try {
            const order = await Order.findOne({ orderId })
            .select('runnerId userId status serviceType marketCoordinates pickupCoordinates deliveryCoordinates')
            .sort({ createdAt: -1 });

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

            // Broadcast live location to everyone watching
            io.to(`tracking:${orderId}`).emit('runner:locationUpdate', {
                orderId,
                ...locationPayload
            });

            const runnerCoords = { lat, lng };

            // ── Geofence: runner reached market (errand) or pickup location ──────
            if (!arrivedAtSourceSet.has(orderId)) {
                const sourceCoords = order.serviceType === 'run-errand'
                    ? order.marketCoordinates
                    : order.pickupCoordinates;

                if (sourceCoords?.lat && sourceCoords?.lng) {
                    const dist = getDistanceMeters(runnerCoords, sourceCoords);
                    if (dist <= ARRIVAL_THRESHOLD_METERS) {
                        arrivedAtSourceSet.add(orderId);
                        io.to(`tracking:${orderId}`).emit('runner:arrivedAtSource', { orderId });
                    }
                }
            }

            // ── Geofence: runner reached delivery location ────────────────────────
            if (!arrivedAtDeliverySet.has(orderId)) {
                const delivCoords = order.deliveryCoordinates;
                if (delivCoords?.lat && delivCoords?.lng) {
                    const dist = getDistanceMeters(runnerCoords, delivCoords);
                    if (dist <= ARRIVAL_THRESHOLD_METERS) {
                        arrivedAtDeliverySet.add(orderId);
                        io.to(`tracking:${orderId}`).emit('runner:arrivedAtDelivery', { orderId });
                    }
                }
            }

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
                .populate('runnerId', 'firstName lastName fleetType')
                .sort({ createdAt: -1 })
                .lean();

            if (!order) return socket.emit('tracking:error', { message: 'Order not found' });

            socket.join(`tracking:${orderId}`);

            // Get last known location from Redis
            const lastKnown = await locationStore.getLocation(orderId);

            if (lastKnown) {
                socket.emit('runner:locationUpdate', { orderId, ...lastKnown });
            }

            const trackingData = {
                orderId,
                serviceType: order.serviceType,
                runnerName: [order.runnerId?.firstName, order.runnerId?.lastName]
                    .filter(Boolean)
                    .join(' ') || 'Your Runner',
                runnerFleetType: order.runnerId?.fleetType || 'pedestrian',
                hasActiveLocation: !!lastKnown,
            };

            if (order.serviceType === 'run-errand') {
                trackingData.destinationLocation = order.marketLocation?.address || null;
                trackingData.destinationCoordinates = order.marketCoordinates;
                trackingData.deliveryLocation = order.deliveryLocation?.address || null;
                trackingData.deliveryCoordinates = order.deliveryCoordinates;
            } else {
                trackingData.destinationLocation = order.pickupLocation?.address || null;
                trackingData.destinationCoordinates = order.pickupCoordinates;
                trackingData.deliveryLocation = order.deliveryLocation?.address || null;
                trackingData.deliveryCoordinates = order.deliveryCoordinates;
            }

            // Derive current stage from order status
            const statusStageMap = {
                'arrived_at_market': 1,
                'arrived_at_pickup_location': 1,
                'purchase_in_progress': 1,
                'item_collected': 1,
                'purchase_completed': 1,
                'en_route_to_delivery': 2,
                'arrived_at_delivery_location': 3,
                'task_completed': 4,
            };
            trackingData.currentStage = statusStageMap[order.status] ?? 0;

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
    socket.on('runner:stopTracking', async ({ orderId }) => {
        if (!orderId) return;
        try {
            await locationStore.removeLocation(orderId);
            // Clean up arrival sets when order ends
            arrivedAtSourceSet.delete(orderId);
            arrivedAtDeliverySet.delete(orderId);
            io.to(`tracking:${orderId}`).emit('runner:offline', { orderId });
        } catch (err) {
            console.error('runner:stopTracking error:', err.message);
        }
    });

    // Cleanup on disconnect
    socket.on('disconnect', async () => {
        const orderId = socketOrderMap.get(socket.id);
        if (orderId) {
            io.to(`tracking:${orderId}`).emit('runner:offline', { orderId });
            socketOrderMap.delete(socket.id);
        }
    });
};

module.exports = { registerTrackingHandlers };