const Order = require('../models/Order');
const Chat = require('../models/Chat').Chat;
const User = require('../models/User');
const Runner = require('../models/Runner');
const Escrow = require('../models/Escrows');
const { DELIVERY_FEE_PERCENTAGE, BASE_DELIVERY_FEE } = require('../config/pricing');
const orderStateMachine = require('../services/orderStateMachine');
const { notifyPaymentRequest } = require('../services/notificationService');

const handleRunnerAccept = async (io, socket, data) => {
    try {
        const { runnerId, userId, chatId, serviceType } = data;

        const user = await User.findById(userId);
        if (!user?.currentRequest) {
            throw new Error('User request not found');
        }

        const request = user.currentRequest;

        let itemBudget = 0;
        let deliveryFee = 0;

        if (serviceType === 'run_errand' || serviceType === 'run-errand') {
            const totalBudget = Number(request.itemBudget || request.budget) || 0;
            deliveryFee = Math.round(totalBudget * DELIVERY_FEE_PERCENTAGE); // 20% of total budget
            itemBudget = totalBudget - deliveryFee; // remainder for item shopping
        } else if (serviceType === 'pick-up') {
            itemBudget = 0;
            deliveryFee = request.deliveryFee || calculateDeliveryFee(request);
        }

        const totalAmount = itemBudget + deliveryFee; // equals original budget for run-errand
        const { platformFee, runnerPayout } = Escrow.calculateFees(deliveryFee);

        const order = await Order.create({
            orderId: Order.generateOrderId(),
            chatId,
            userId,
            runnerId,
            serviceType,
            taskType: serviceType === 'run-errand' ? 'run_errand' : 'pickup_delivery',
            pickupLocation: request.pickupLocation || {},
            deliveryLocation: request.deliveryLocation || {},
            marketLocation: request.marketLocation || {},
            itemBudget,
            deliveryFee,
            totalAmount,
            platformFee,
            runnerPayout,
            specialInstructions: request.specialInstructions,
            fleetType: request.fleetType,
            status: 'pending_payment',
            paymentStatus: 'unpaid',
            approvalStatus: serviceType === 'run-errand' ? 'pending' : 'not_required',
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
                    orderId: order.orderId,
                    taskId: order.orderId,
                    userId,
                    runnerId,
                }
            },
            { new: true }
        );

        console.log('Chat updated with orderId:', order.orderId, '| chatId:', chatId);

        await Runner.findByIdAndUpdate(runnerId, {
            activeOrderId: order.orderId,
            currentUserId: userId
        });

        await User.findByIdAndUpdate(userId, {
            activeOrderId: order.orderId,
            currentRunnerId: runnerId
        });

        const orderPayload = {
            order: {
                orderId: order.orderId,
                escrowId: order.escrowId,
                itemBudget: order.itemBudget,
                deliveryFee: order.deliveryFee,
                totalAmount: order.totalAmount,
                taskType: order.taskType,
                serviceType: order.serviceType,
                status: order.status,
                paymentStatus: order.paymentStatus,
                approvalStatus: order.approvalStatus,
            }
        };

        io.to(`runner-${runnerId}`).emit('orderCreated', orderPayload);
        io.to(`user-${userId}`).emit('orderCreated', orderPayload);

        await notifyPaymentRequest(userId, {
            orderId: order.orderId,
            amount: order.totalAmount
        });

        console.log('Order created:', order.orderId, '| itemBudget:', itemBudget, '| deliveryFee:', deliveryFee, '| total:', totalAmount);
        return order;

    } catch (error) {
        console.error('Error creating order:', error);
        throw error;
    }
};

function calculateDeliveryFee(request) {
    return request.estimatedDeliveryFee || BASE_DELIVERY_FEE;
}

module.exports = { handleRunnerAccept };