const Order = require('../models/Order');
const Chat = require('../models/Chat').Chat;
const User = require('../models/User');
const Runner = require('../models/Runner');
const Escrow = require('../models/Escrows');
const { computeDeliveryFeeFromDocs } = require('../config/pricing');
const orderStateMachine = require('../services/orderStateMachine');
const { notifyPaymentRequest } = require('../services/notificationService');
const logger = require('../utils/logger');
const { logSocketAudit } = require('../utils/socketAudit');

const handleRunnerAccept = async (io, socket, data) => {
    try {
        const { runnerId, userId, chatId, serviceType } = data;

        // Fetch runner and user in parallel — both documents needed for distance calc
        const [runner, user] = await Promise.all([
            Runner.findById(runnerId).lean(),
            User.findById(userId).lean(),
        ]);

        if (!user?.currentRequest) {
            throw new Error('User request not found');
        }

        const request = user.currentRequest;

        // ── Delivery fee: DELIVERY_FEE_PER_METER × actual route distance ─────
        // run-errand:  runner → marketCoords  + marketCoords  → user location
        // pick-up:     runner → pickupCoords  + pickupCoords  → user location
        const { deliveryFee, distanceInMeters, legs, error: distanceError } =
            computeDeliveryFeeFromDocs(serviceType, runner, user);

        if (distanceError) {
            console.warn(`[orderHandlers] Distance calculation issue for order (${chatId}): ${distanceError}`);
        }

        // Item budget only applies to run-errand; pick-up has no item budget
        const isErrand = serviceType === 'run-errand';
        const itemBudget = isErrand
            ? Number(request.itemBudget || request.budget) || 0
            : 0;

        const totalAmount = itemBudget + deliveryFee;
        const { platformFee, runnerPayout } = Escrow.calculateFees(deliveryFee);

        const order = await Order.create({
            orderId: Order.generateOrderId(),
            chatId,
            userId,
            runnerId,
            serviceType,
            taskType: isErrand ? 'run-errand' : 'pick-up',
            pickupLocation:  request.pickupLocation  || {},
            deliveryLocation: request.deliveryLocation || {},
            marketLocation:  request.marketLocation  || {},

            marketCoordinates:  request.marketCoordinates  || null,
            pickupCoordinates:  request.pickupCoordinates  || null,
            deliveryCoordinates: request.deliveryCoordinates || null,

            // Store computed distance for reference / auditing
            routeDistanceMeters: Math.round(distanceInMeters),
            routeLegs: legs || {},

            itemBudget,
            deliveryFee,
            totalAmount,
            platformFee,
            runnerPayout,
            specialInstructions: request.specialInstructions,
            fleetType: request.fleetType,
            status: 'pending_payment',
            paymentStatus: 'unpaid',
            approvalStatus: isErrand ? 'pending' : 'not_required',
            statusHistory: [{
                status: 'pending_payment',
                timestamp: new Date(),
                triggeredBy: 'system',
                note: 'Order created, awaiting payment'
            }]
        });

        await Chat.findOneAndUpdate(
            { chatId },
            {
                $set: {
                    orderId:  order.orderId,
                    taskId:   order.orderId,
                    userId,
                    runnerId,
                }
            },
            { new: true }
        );

        await Runner.findByIdAndUpdate(runnerId, {
            activeOrderId: order.orderId,
            currentUserId: userId
        });

        await User.findByIdAndUpdate(userId, {
            activeOrderId:   order.orderId,
            currentRunnerId: runnerId
        });

        const orderPayload = {
            order: {
                orderId:        order.orderId,
                escrowId:       order.escrowId,
                itemBudget:     order.itemBudget,
                deliveryFee:    order.deliveryFee,
                totalAmount:    order.totalAmount,
                runnerPayout:   order.runnerPayout,
                taskType:       order.taskType,
                serviceType:    order.serviceType,
                status:         order.status,
                paymentStatus:  order.paymentStatus,
                approvalStatus: order.approvalStatus,
                routeDistanceMeters: order.routeDistanceMeters,
            }
        };

        io.to(`runner-${runnerId}`).emit('orderCreated', orderPayload);
        io.to(`user-${userId}`).emit('orderCreated', orderPayload);

        console.log('Order created:', order.orderId,
            '| distance:', order.routeDistanceMeters + 'm',
            '| deliveryFee: ₦' + deliveryFee,
            '| itemBudget: ₦' + itemBudget,
            '| total: ₦' + totalAmount
        );

        await notifyPaymentRequest(userId, {
            orderId: order.orderId,
            amount:  order.totalAmount
        });

        logSocketAudit('RUNNER_ACCEPTED_ORDER', {
            runnerId,
            userId,
            serviceType,
            chatId,
            orderId: order.orderId
        });

        return order;

    } catch (error) {
        console.error('Error creating order:', error);
        throw error;
    }
};

module.exports = { handleRunnerAccept };