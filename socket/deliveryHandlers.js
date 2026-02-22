const Order = require('../models/Order');
const Escrow = require('../models/Escrows');
const Chat = require('../models/Chat').Chat;
const paymentService = require('../services/paymentServices');
const User = require('../models/User');
const Runner = require('../models/Runner');
const orderStateMachine = require('../services/orderStateMachine');

const {
    notifyDeliveryConfirmationRequest,
    notifyDeliveryConfirmed,
    notifyRatingPrompt
} = require('../services/notificationService');

/**
 * Runner marks delivery as completed
 */
const handleMarkDeliveryComplete = async (io, socket, data) => {
    try {
        const { chatId, orderId, runnerId, deliveryProof } = data;

        console.log('Runner marking delivery complete:', orderId);

        const order = await Order.findOne({ orderId });
        if (!order) {
            socket.emit('error', { message: 'Order not found' });
            return;
        }

        if (order.status === 'delivered') {
            socket.emit('error', { message: 'Delivery already marked as complete' });
            return;
        }

        // Update order status
        await orderStateMachine.transition(orderId, 'delivered', {
            triggeredBy: 'runner',
            triggeredById: runnerId,
            note: 'Runner marked as delivered'
        });


        // Update escrow status to delivery_pending
        if (order.escrowId) {
            const escrow = await Escrow.findById(order.escrowId);
            if (escrow) {
                escrow.status = 'delivery_pending';
                await escrow.save();
            }
        }

        // Send confirmation request message to user
        const confirmationMessage = {
            id: `delivery-confirm-${Date.now()}`,
            from: 'system',
            type: 'delivery_confirmation_request',
            messageType: 'delivery_confirmation_request',
            text: '✅ Runner has marked delivery as complete. Please confirm delivery.',
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            status: 'sent',
            senderId: 'system',
            senderType: 'system',
            orderId: order.orderId,
            deliveryProof: deliveryProof || null,
            confirmationStatus: 'pending'
        };

        // Save to chat
        await Chat.findOneAndUpdate(
            { chatId },
            { $push: { messages: confirmationMessage } },
            { upsert: true }
        );

        // Emit to both parties
        io.to(chatId).emit('message', confirmationMessage);
        io.to(chatId).emit('deliveryMarkedComplete', {
            orderId: order.orderId,
            status: 'awaiting_confirmation'
        });

        await notifyDeliveryConfirmationRequest(order.userId, {
            orderId: order.orderId
        });

        // Schedule auto-confirm after 24 hours
        scheduleAutoConfirm(io, chatId, orderId, order.escrowId);

        console.log('Delivery marked complete, awaiting user confirmation');

    } catch (error) {
        console.error('Error marking delivery complete:', error);
        socket.emit('error', { message: error.message });
    }
};

/**
 * User confirms delivery
 */
const handleConfirmDelivery = async (io, socket, data) => {
    try {
        const { chatId, orderId, userId, rating, feedback } = data;

        console.log('User confirming delivery:', orderId);

        const order = await Order.findOne({ orderId });
        if (!order) {
            socket.emit('error', { message: 'Order not found' });
            return;
        }

        if (order.deliveryConfirmedAt) {
            socket.emit('error', { message: 'Delivery already confirmed' });
            return;
        }

        await orderStateMachine.transition(orderId, 'completed', {
            triggeredBy: 'user',
            triggeredById: userId,
            note: 'Delivery confirmed by user'
        });

        order.deliveryConfirmedAt = new Date();
        order.deliveryConfirmedBy = 'user';
        await order.save();

        // Release escrow and payout runner
        if (order.escrowId) {
            const escrow = await Escrow.findById(order.escrowId);
            if (escrow && !escrow.deliveryFeeReleased) {
                // Release delivery fee to runner
                await paymentService.payoutToRunner(escrow._id);

                console.log('Delivery fee released to runner');
            }
        }


        await User.findByIdAndUpdate(userId, {
            activeOrderId: null,
            currentRunnerId: null
        });

        await Runner.findByIdAndUpdate(order.runnerId, {
            activeOrderId: null,
            currentUserId: null
        });

        // Send confirmation success message
        const successMessage = {
            id: `delivery-confirmed-${Date.now()}`,
            from: 'system',
            type: 'system',
            messageType: 'system',
            text: 'Delivery confirmed! Order completed successfully.',
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            status: 'sent',
            senderId: 'system',
            senderType: 'system',
            style: 'success'
        };

        await Chat.findOneAndUpdate(
            { chatId },
            { $push: { messages: successMessage } },
            { upsert: true }
        );

        io.to(chatId).emit('message', successMessage);
        io.to(chatId).emit('deliveryConfirmed', {
            orderId: order.orderId,
            status: 'completed'
        });

        // Trigger rating prompt (will implement in next PRD)
        io.to(`user-${userId}`).emit('promptRating', {
            orderId: order.orderId,
            runnerId: order.runnerId
        });

        const runner = await Runner.findById(order.runnerId)
            .select('firstName lastName');

        await notifyDeliveryConfirmed(order.runnerId, {
            orderId: order.orderId,
            amount: order.runnerPayout
        });

        await notifyRatingPrompt(userId, {
            orderId: order.orderId,
            runnerName: `${runner.firstName} ${runner.lastName}`
        });

        console.log('Delivery confirmed successfully');

    } catch (error) {
        console.error('Error confirming delivery:', error);
        socket.emit('error', { message: error.message });
    }
};

/**
 * Schedule auto-confirm after 24 hours
 */
const scheduleAutoConfirm = (io, chatId, orderId, escrowId) => {
    const AUTO_CONFIRM_DELAY = 24 * 60 * 60 * 1000; // 24 hours

    setTimeout(async () => {
        try {
            const order = await Order.findOne({ orderId });

            // Only auto-confirm if user hasn't confirmed yet
            if (order && !order.deliveryConfirmedAt && order.status === 'delivered') {
                console.log('Auto-confirming delivery for order:', orderId);


                await orderStateMachine.transition(orderId, 'completed', {
                    triggeredBy: 'system',
                    note: 'Auto-confirmed after 24 hours'
                });

                order.deliveryConfirmedAt = new Date();
                order.deliveryConfirmedBy = 'system';
                await order.save();

                // Release escrow
                if (escrowId) {
                    const escrow = await Escrow.findById(escrowId);
                    if (escrow && !escrow.deliveryFeeReleased) {
                        await paymentService.payoutToRunner(escrow._id);
                        console.log('Auto-confirmed: Delivery fee released to runner');
                    }
                }

                // Clear active orders
                const User = require('../models/User');
                const Runner = require('../models/Runner');

                await User.findByIdAndUpdate(order.userId, {
                    activeOrderId: null,
                    currentRunnerId: null
                });

                await Runner.findByIdAndUpdate(order.runnerId, {
                    activeOrderId: null,
                    currentUserId: null
                });

                // Send auto-confirm message
                const autoConfirmMessage = {
                    id: `auto-confirm-${Date.now()}`,
                    from: 'system',
                    type: 'system',
                    messageType: 'system',
                    text: '✅ Delivery auto-confirmed (24hr timeout). Order completed.',
                    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                    status: 'sent',
                    senderId: 'system',
                    senderType: 'system',
                    style: 'success'
                };

                await Chat.findOneAndUpdate(
                    { chatId },
                    { $push: { messages: autoConfirmMessage } },
                    { upsert: true }
                );

                io.to(chatId).emit('message', autoConfirmMessage);
                io.to(chatId).emit('deliveryAutoConfirmed', {
                    orderId: order.orderId,
                    status: 'completed'
                });
            }
        } catch (error) {
            console.error('❌ Error auto-confirming delivery:', error);
        }
    }, AUTO_CONFIRM_DELAY);
};

module.exports = {
    handleMarkDeliveryComplete,
    handleConfirmDelivery
};