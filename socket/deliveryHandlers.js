const Order = require('../models/Order');
const Escrow = require('../models/Escrows');
const Chat = require('../models/Chat').Chat;
const paymentService = require('../services/paymentServices');
const User = require('../models/User');
const Runner = require('../models/Runner');
const orderStateMachine = require('../services/orderStateMachine');
const { logSocketAudit } = require('../utils/socketAudit');

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

        // console.log('Runner marking delivery complete:', orderId);

        const order = await Order.findOne({ orderId });
        if (!order) return socket.emit('error', { message: 'Order not found' });

        if (order.status === 'delivered') {
            return socket.emit('error', { message: 'Delivery already marked as complete' });
        }

        await orderStateMachine.transition(orderId, 'delivered', {
            triggeredBy: 'runner',
            triggeredById: runnerId,
            note: 'Runner marked as delivered'
        });

        if (order.escrowId) {
            const escrow = await Escrow.findById(order.escrowId);
            if (escrow) {
                escrow.status = 'delivery_pending';
                await escrow.save();
            }
        }

        // Fetch runner name to show in confirmation card
        const runner = await Runner.findById(runnerId).select('firstName lastName');
        const runnerName = [runner?.firstName, runner?.lastName].filter(Boolean).join(' ') || 'Runner';

        const confirmationMessage = {
            id: `delivery-confirm-${Date.now()}`,
            from: 'system',
            type: 'delivery_confirmation_request',
            messageType: 'delivery_confirmation_request',
            text: 'Runner has marked delivery as complete. Please confirm delivery.',
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            status: 'sent',
            senderId: 'system',
            senderType: 'system',
            orderId: order.orderId,
            deliveryProof: deliveryProof || null,
            confirmationStatus: 'pending',
            runnerName,  // needed for DeliveryConfirmationMessage
        };

        const runnerAckMessage = {
            id: `delivery-marked-runner-${Date.now()}`,
            from: 'system',
            type: 'system',
            messageType: 'system',
            text: 'You marked delivery as complete. Waiting for the user to confirm.',
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            status: 'sent',
            senderId: 'system',
            senderType: 'system',
            style: 'success'
        };

        await Chat.findOneAndUpdate(
            { chatId },
            { $push: { messages: { $each: [confirmationMessage, runnerAckMessage] } } },
            { upsert: true }
        );

        // Only user sees the confirmation request card
        io.to(`user-${order.userId.toString()}`).emit('message', confirmationMessage);
        // 
        io.to(`user-${runnerId.toString()}`).emit('message', runnerAckMessage);

        io.to(chatId).emit('deliveryMarkedComplete', {
            orderId: order.orderId,
            status: 'awaiting_confirmation'
        });

        logSocketAudit('ORDER_DELIVERED', {
            runnerId,
            chatId,
            orderId
        });

        await notifyDeliveryConfirmationRequest(order.userId, { orderId: order.orderId });
        scheduleAutoConfirm(io, chatId, orderId, order.escrowId);

        // console.log('Delivery marked complete, awaiting user confirmation');

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
        const { chatId, orderId, userId } = data;

        // console.log('User confirming delivery:', orderId);

        const order = await Order.findOne({ orderId });
        if (!order) return socket.emit('error', { message: 'Order not found' });

        if (order.deliveryConfirmedAt) {
            return socket.emit('error', { message: 'Delivery already confirmed' });
        }

        await orderStateMachine.transition(orderId, 'completed', {
            triggeredBy: 'user',
            triggeredById: userId,
            note: 'Delivery confirmed by user'
        });

        order.deliveryConfirmedAt = new Date();
        order.deliveryConfirmedBy = 'user';
        await order.save();

        if (order.escrowId) {
            const escrow = await Escrow.findById(order.escrowId);
            if (escrow && !escrow.deliveryFeeReleased) {
                await paymentService.payoutToRunner(escrow._id);
                // console.log('Delivery fee released to runner');
            }
        }

        await User.findByIdAndUpdate(userId, { activeOrderId: null, currentRunnerId: null });
        await Runner.findByIdAndUpdate(order.runnerId, { activeOrderId: null, currentUserId: null });

        // Fetch user name for system messages
        const user = await User.findById(userId).select('firstName lastName');
        const userName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'User';

        const userSystemMsg = {
            id: `delivery-confirmed-user-${Date.now()}`,
            from: 'system', type: 'system', messageType: 'system',
            text: 'You confirmed delivery. Order completed successfully.',
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            status: 'sent', senderId: 'system', senderType: 'system', style: 'success'
        };

        const runnerSystemMsg = {
            id: `delivery-confirmed-runner-${Date.now() + 1}`,
            from: 'system', type: 'system', messageType: 'system',
            text: `${userName} confirmed the delivery of their item(s). Order completed.`,
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            status: 'sent', senderId: 'system', senderType: 'system', style: 'success'
        };

        await Chat.findOneAndUpdate(
            { chatId },
            { $push: { messages: { $each: [userSystemMsg, runnerSystemMsg] } } }
        );

        // Update confirmation card status for both parties
        io.to(chatId).emit('deliveryConfirmed', { orderId: order.orderId, status: 'completed' });

        // Personal system messages
        io.to(`user-${userId.toString()}`).emit('message', userSystemMsg);
        io.to(`user-${order.runnerId.toString()}`).emit('message', runnerSystemMsg);

        // Advance stage 4 on TrackDeliveryScreen
        io.to(`tracking:${orderId}`).emit('runner:delivered', { orderId });

        // Prompt rating
        io.to(`user-${userId}`).emit('promptRating', {
            orderId: order.orderId,
            runnerId: order.runnerId
        });

        const runner = await Runner.findById(order.runnerId).select('firstName lastName');
        await notifyDeliveryConfirmed(order.runnerId, { orderId: order.orderId, amount: order.runnerPayout });
        await notifyRatingPrompt(userId, {
            orderId: order.orderId,
            runnerName: [runner?.firstName, runner?.lastName].filter(Boolean).join(' ')
        });

        logSocketAudit('USER_CONFIRMED_ORDER_DELIVERED', {
            userId,
            chatId,
            orderId
        });

        // console.log('Delivery confirmed successfully');

    } catch (error) {
        console.error('Error confirming delivery:', error);
        socket.emit('error', { message: error.message });
    }
};

/**
 * User denies delivery
 */
const handleDenyDelivery = async (io, socket, data) => {
    try {
        const { chatId, orderId, userId } = data;

        // console.log('User denying delivery:', orderId);

        const order = await Order.findOne({ orderId });
        if (!order) return socket.emit('error', { message: 'Order not found' });

        if (order.deliveryConfirmedAt) {
            return socket.emit('error', { message: 'Delivery already confirmed' });
        }

        // Revert order back to active so runner can try again
        if (order.status !== 'in_progress') {
            console.log("skipping update of orderstate machine")
            await orderStateMachine.transition(orderId, 'in_progress', {
                triggeredBy: 'user',
                triggeredById: userId,
                note: 'Delivery denied by user'
            });
        }

        // Revert escrow status
        if (order.escrowId) {
            const escrow = await Escrow.findById(order.escrowId);
            if (escrow) {
                escrow.status = 'funded';
                await escrow.save();
            }
        }

        const user = await User.findById(userId).select('firstName lastName');
        const userName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'User';

        const userSystemMsg = {
            id: `delivery-denied-user-${Date.now()}`,
            from: 'system', type: 'system', messageType: 'system',
            text: 'You reported that your item(s) were not delivered.',
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            status: 'sent', senderId: 'system', senderType: 'system', style: 'error'
        };

        const runnerSystemMsg = {
            id: `delivery-denied-runner-${Date.now() + 1}`,
            from: 'system', type: 'system', messageType: 'system',
            text: `${userName} denied the delivery of their item(s). Please Ensure You deliver their Order.`,
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            status: 'sent', senderId: 'system', senderType: 'system', style: 'error'
        };

        // if user denies once more?

        await Chat.findOneAndUpdate(
            { chatId },
            { $push: { messages: { $each: [userSystemMsg, runnerSystemMsg] } } }
        );

        // Update confirmation card to denied state
        io.to(chatId).emit('deliveryDenied', { orderId: order.orderId, status: 'denied' });

        // Personal system messages
        io.to(`user-${userId.toString()}`).emit('message', userSystemMsg);
        io.to(`user-${order.runnerId.toString()}`).emit('message', runnerSystemMsg);

        logSocketAudit('USER_DENIED_ORDER_DELIVERED', {
            userId,
            chatId,
            orderId
        });

        // console.log('Delivery denied by user:', orderId);

    } catch (error) {
        console.error('Error denying delivery:', error);
        socket.emit('error', { message: error.message });
    }
};

/**
 * Schedule auto-confirm after 24 hours
 */
const scheduleAutoConfirm = (io, chatId, orderId, escrowId) => {
    const AUTO_CONFIRM_DELAY = 24 * 60 * 60 * 1000;

    setTimeout(async () => {
        try {
            const order = await Order.findOne({ orderId });
            if (order && !order.deliveryConfirmedAt && order.status === 'delivered') {
                // console.log('Auto-confirming delivery for order:', orderId);

                await orderStateMachine.transition(orderId, 'completed', {
                    triggeredBy: 'system',
                    note: 'Auto-confirmed after 24 hours'
                });

                order.deliveryConfirmedAt = new Date();
                order.deliveryConfirmedBy = 'system';
                await order.save();

                if (escrowId) {
                    const escrow = await Escrow.findById(escrowId);
                    if (escrow && !escrow.deliveryFeeReleased) {
                        await paymentService.payoutToRunner(escrow._id);
                        // console.log('Auto-confirmed: Delivery fee released to runner');
                    }
                }

                await User.findByIdAndUpdate(order.userId, { activeOrderId: null, currentRunnerId: null });
                await Runner.findByIdAndUpdate(order.runnerId, { activeOrderId: null, currentUserId: null });

                const autoConfirmMessage = {
                    id: `auto-confirm-${Date.now()}`,
                    from: 'system', type: 'system', messageType: 'system',
                    text: '✅ Delivery auto-confirmed (24hr timeout). Order completed.',
                    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                    status: 'sent', senderId: 'system', senderType: 'system', style: 'success'
                };

                await Chat.findOneAndUpdate(
                    { chatId },
                    { $push: { messages: autoConfirmMessage } }
                );

                io.to(chatId).emit('message', autoConfirmMessage);
                io.to(chatId).emit('deliveryAutoConfirmed', { orderId, status: 'completed' });

                //  Also advance tracking stage on auto-confirm
                io.to(`tracking:${orderId}`).emit('runner:delivered', { orderId });

                logSocketAudit('ORDER_AUTO_CONFIRM_DELIVERED', {
                    chatId,
                    orderId
                });
            }
        } catch (error) {
            console.error('Error auto-confirming delivery:', error);
        }
    }, AUTO_CONFIRM_DELAY);
};

module.exports = {
    handleMarkDeliveryComplete,
    handleConfirmDelivery,
    handleDenyDelivery,
};