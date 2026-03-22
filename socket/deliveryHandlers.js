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

// ─── Helpers 

const makeErrorMsg = (id) => ({
    id: `error-${id}-${Date.now()}`,
    from: 'system', type: 'system', messageType: 'system',
    text: 'A server error occurred. Please try again.',
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    status: 'sent', senderId: 'system', senderType: 'system', style: 'error',
});

const persistMessages = async (chatId, messages) => {
    await Chat.findOneAndUpdate(
        { chatId },
        { $push: { messages: { $each: messages } } },
        { upsert: true }
    );
};

// ─── Runner marks delivery complete

const handleMarkDeliveryComplete = async (io, socket, data) => {
    const { chatId, orderId, runnerId, deliveryProof } = data;


    let order;
    try {
        order = await Order.findOne({ orderId });

        // If the resolved order is already terminal, find the active one for this chat
        const terminalStatuses = ['completed', 'cancelled', 'task_completed', 'archived'];
        if (!order || terminalStatuses.includes(order?.status)) {
            order = await Order.findOne({
                chatId,
                status: { $nin: terminalStatuses },
                paymentStatus: 'paid',
            }).sort({ createdAt: -1 });
        }

        if (!order) return socket.emit('error', { message: 'No active order found' });
        if (order.status === 'delivered') return socket.emit('error', { message: 'Delivery already marked as complete' });
    } catch (err) {
        console.error('[markDeliveryComplete] Order lookup failed:', err);
        return socket.emit('error', { message: 'Failed to find order. Please try again.' });
    }


    // State transition + escrow update 
    try {

        if (order.status === 'paid') {
            await orderStateMachine.transition(orderId, 'in_progress', {
                triggeredBy: 'system',
                note: 'Auto-progressed from paid to in_progress on delivery mark',
            });
        }

        if (order.status === 'in_progress' || order.status === 'paid') {
            // for run-errand, items_submitted may be required — skip if pick-up
            const isPickup = order.serviceType === 'pick-up' || order.taskType === 'pick-up';
            if (!isPickup && order.status !== 'items_submitted') {
                // run-errand path — items should already be submitted/approved
                // if not, the frontend already guards this — proceed anyway
            }
        }

        await orderStateMachine.transition(orderId, 'delivered', {
            triggeredBy: 'runner',
            triggeredById: runnerId,
            note: 'Runner marked as delivered',
        });



        if (order.escrowId) {
            const escrow = await Escrow.findById(order.escrowId);
            if (escrow) {
                escrow.status = 'delivery_pending';
                await escrow.save();
            }
        }
    } catch (err) {
        console.error('[markDeliveryComplete] State transition failed:', err);
        return socket.emit('error', { message: 'Failed to update order state. Please try again.' });
    }

    // Build messages 
    let runnerName = 'Runner';
    try {
        const runner = await Runner.findById(runnerId).select('firstName lastName');
        runnerName = [runner?.firstName, runner?.lastName].filter(Boolean).join(' ') || 'Runner';
    } catch (err) {
        console.warn('[markDeliveryComplete] Could not fetch runner name:', err.message);
    }

    const confirmationMessage = {
        id: `delivery-confirm-${Date.now()}`,
        from: 'system',
        type: 'delivery_confirmation_request',
        messageType: 'delivery_confirmation_request',
        text: 'Runner has marked delivery as complete. Please confirm delivery.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'sent', senderId: 'system', senderType: 'system',
        orderId: order.orderId,
        deliveryProof: deliveryProof || null,
        confirmationStatus: 'pending',
        runnerName,
    };

    const runnerAckMessage = {
        id: `delivery-marked-runner-${Date.now() + 1}`,
        from: 'system', type: 'system', messageType: 'system',
        text: 'You marked delivery as complete. Waiting for the user to confirm.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'sent', senderId: 'system', senderType: 'system',
    };

    // Emit immediately (optimistic)
    io.to(`user-${order.userId.toString()}`).emit('message', confirmationMessage);
    io.to(`runner-${runnerId.toString()}`).emit('message', runnerAckMessage);

    io.to(chatId).emit('deliveryMarkedComplete', { orderId: order.orderId, status: 'awaiting_confirmation' });

    // Persist to DB — recover on failure
    try {
        await persistMessages(chatId, [confirmationMessage, runnerAckMessage]);
    } catch (err) {
        console.error('[markDeliveryComplete] Chat persist failed:', err);

        // Revert order state so runner can retry
        try {
            // If order is still in 'paid' state, transition through required states first
            if (order.status === 'paid') {
                await orderStateMachine.transition(orderId, 'in_progress', {
                    triggeredBy: 'system',
                    note: 'Auto-progressed from paid to in_progress',
                });
            }

            await orderStateMachine.transition(orderId, 'in_progress', {
                triggeredBy: 'system',
                note: 'Reverted after DB failure on delivery mark',
            });

            if (order.escrowId) {
                const escrow = await Escrow.findById(order.escrowId);
                if (escrow) {
                    escrow.status = 'delivery_pending';
                    await escrow.save();
                }
            }
        } catch (revertErr) {
            console.error('[markDeliveryComplete] State revert failed:', revertErr.message);
            return socket.emit('error', { message: 'Failed to update order state. Please try again.' });
        }

        const errMsg = makeErrorMsg('delivery-mark');
        io.to(`user-${order.userId.toString()}`).emit('message', errMsg);
        io.to(`runner-${runnerId.toString()}`).emit('message', errMsg);
        return;
    }

    // Side effects (non-critical) 
    logSocketAudit('ORDER_DELIVERED', { runnerId, chatId, orderId });
    scheduleAutoConfirm(io, chatId, orderId, order.escrowId);

    notifyDeliveryConfirmationRequest(order.userId, { orderId: order.orderId })
        .catch(err => console.warn('[markDeliveryComplete] Push notify failed:', err.message));
};

// User confirms delivery 
const handleConfirmDelivery = async (io, socket, data) => {
    const { chatId, orderId, userId } = data;

    // Validate 
    let order;
    try {
        order = await Order.findOne({ orderId });
        if (!order) return socket.emit('error', { message: 'Order not found' });
        if (order.deliveryConfirmedAt) return socket.emit('error', { message: 'Delivery already confirmed' });
    } catch (err) {
        console.error('[confirmDelivery] Order lookup failed:', err);
        return socket.emit('error', { message: 'Failed to find order. Please try again.' });
    }

    // Critical DB writes — must succeed before emit 
    // Payment is involved so write first here, then emit
    try {
        await orderStateMachine.transition(orderId, 'completed', {
            triggeredBy: 'user',
            triggeredById: userId,
            note: 'Delivery confirmed by user',
        });

        order.deliveryConfirmedAt = new Date();
        order.deliveryConfirmedBy = 'user';
        await order.save();

        if (order.escrowId) {
            const escrow = await Escrow.findById(order.escrowId);
            if (escrow && !escrow.deliveryFeeReleased) {
                await paymentService.payoutToRunner(escrow._id);
            }
        }

        await User.findByIdAndUpdate(userId, { activeOrderId: null, currentRunnerId: null });
        await Runner.findByIdAndUpdate(order.runnerId, { activeOrderId: null, currentUserId: null });
    } catch (err) {
        console.error('[confirmDelivery] Critical write failed:', err);
        return socket.emit('error', { message: 'Failed to confirm delivery. Please try again.' });
    }

    // Build messages 
    let userName = 'User';
    try {
        const user = await User.findById(userId).select('firstName lastName');
        userName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'User';
    } catch (err) {
        console.warn('[confirmDelivery] Could not fetch user name:', err.message);
    }

    const userSystemMsg = {
        id: `delivery-confirmed-user-${Date.now()}`,
        from: 'system', type: 'system', messageType: 'system',
        text: 'You confirmed delivery. Order completed successfully.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'sent', senderId: 'system', senderType: 'system',
    };

    const runnerSystemMsg = {
        id: `delivery-confirmed-runner-${Date.now() + 1}`,
        from: 'system', type: 'system', messageType: 'system',
        text: `${userName} confirmed the delivery of their item(s). Order completed.`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'sent', senderId: 'system', senderType: 'system',
    };

    // Emit 
    io.to(chatId).emit('deliveryConfirmed', { orderId: order.orderId, status: 'completed' });

    io.to(chatId).emit('message', userSystemMsg);
    io.to(`runner-${order.runnerId.toString()}`).emit('message', runnerSystemMsg);

    io.to(`tracking:${orderId}`).emit('runner:delivered', { orderId });

    // Prompt rating
    // io.to(`user-${userId}`).emit('promptRating', {
    //     orderId: order.orderId,
    //     runnerId: order.runnerId,
    // });

    // Persist chat messages (non-critical after payment) 
    persistMessages(chatId, [userSystemMsg, runnerSystemMsg])
        .catch(err => console.error('[confirmDelivery] Chat persist failed (payment already released):', err));

    //  Side effects 
    logSocketAudit('USER_CONFIRMED_ORDER_DELIVERED', { userId, chatId, orderId });

    Runner.findById(order.runnerId).select('firstName lastName').then(runner => {
        notifyDeliveryConfirmed(order.runnerId, { orderId: order.orderId, amount: order.runnerPayout })
            .catch(err => console.warn('[confirmDelivery] Runner notify failed:', err.message));
        notifyRatingPrompt(userId, {
            orderId: order.orderId,
            runnerName: [runner?.firstName, runner?.lastName].filter(Boolean).join(' '),
        }).catch(err => console.warn('[confirmDelivery] Rating notify failed:', err.message));
    }).catch(err => console.warn('[confirmDelivery] Runner fetch for notify failed:', err.message));
};

// User denies delivery 

const handleDenyDelivery = async (io, socket, data) => {
    const { chatId, orderId, userId } = data;

    // Validate
    let order;
    try {
        order = await Order.findOne({ orderId });
        if (!order) return socket.emit('error', { message: 'Order not found' });
        if (order.deliveryConfirmedAt) return socket.emit('error', { message: 'Delivery already confirmed' });
    } catch (err) {
        console.error('[denyDelivery] Order lookup failed:', err);
        return socket.emit('error', { message: 'Failed to find order. Please try again.' });
    }

    // State revert 
    try {
        if (order.status !== 'in_progress') {
            await orderStateMachine.transition(orderId, 'in_progress', {
                triggeredBy: 'user',
                triggeredById: userId,
                note: 'Delivery denied by user',
            });
        }

        if (order.escrowId) {
            const escrow = await Escrow.findById(order.escrowId);
            if (escrow) {
                escrow.status = 'funded';
                await escrow.save();
            }
        }
    } catch (err) {
        console.error('[denyDelivery] State revert failed:', err);
        return socket.emit('error', { message: 'Failed to process denial. Please try again.' });
    }


    let userName = 'User';
    try {
        const user = await User.findById(userId).select('firstName lastName');
        userName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'User';
    } catch (err) {
        console.warn('[denyDelivery] Could not fetch user name:', err.message);
    }

    const userSystemMsg = {
        id: `delivery-denied-user-${Date.now()}`,
        from: 'system', type: 'system', messageType: 'system',
        text: 'You reported that your item(s) were not delivered.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'sent', senderId: 'system', senderType: 'system', style: 'error',
    };

    const runnerSystemMsg = {
        id: `delivery-denied-runner-${Date.now() + 1}`,
        from: 'system', type: 'system', messageType: 'system',
        text: `${userName} denied the delivery of their item(s). Please ensure you deliver their order.`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'sent', senderId: 'system', senderType: 'system', style: 'error',
    };

    io.to(chatId).emit('deliveryDenied', { orderId: order.orderId, status: 'denied' });
    io.to(chatId).emit('message', userSystemMsg);
    io.to(`runner-${order.runnerId.toString()}`).emit('message', runnerSystemMsg);

    // Persist
    try {
        await persistMessages(chatId, [userSystemMsg, runnerSystemMsg]);
    } catch (err) {
        console.error('[denyDelivery] Chat persist failed:', err);
        // No rollback needed — order already reverted above, messages already emitted
    }

    logSocketAudit('USER_DENIED_ORDER_DELIVERED', { userId, chatId, orderId });
};

// ─── Auto-confirm after 24 hours 

const scheduleAutoConfirm = (io, chatId, orderId, escrowId) => {
    const AUTO_CONFIRM_DELAY = 24 * 60 * 60 * 1000;

    setTimeout(async () => {
        try {
            const order = await Order.findOne({ orderId });
            if (!order || order.deliveryConfirmedAt || order.status !== 'delivered') return;

            await orderStateMachine.transition(orderId, 'completed', {
                triggeredBy: 'system',
                note: 'Auto-confirmed after 24 hours',
            });

            order.deliveryConfirmedAt = new Date();
            order.deliveryConfirmedBy = 'system';
            await order.save();

            if (escrowId) {
                const escrow = await Escrow.findById(escrowId);
                if (escrow && !escrow.deliveryFeeReleased) {
                    await paymentService.payoutToRunner(escrow._id);
                }
            }

            await User.findByIdAndUpdate(order.userId, { activeOrderId: null, currentRunnerId: null });
            await Runner.findByIdAndUpdate(order.runnerId, { activeOrderId: null, currentUserId: null });

            const autoConfirmMessage = {
                id: `auto-confirm-${Date.now()}`,
                from: 'system', type: 'system', messageType: 'system',
                text: 'Delivery auto-confirmed (24hr timeout). Order completed.',
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                status: 'sent', senderId: 'system', senderType: 'system',
            };

            io.to(chatId).emit('message', autoConfirmMessage);
            io.to(chatId).emit('deliveryAutoConfirmed', { orderId, status: 'completed' });
            io.to(`tracking:${orderId}`).emit('runner:delivered', { orderId });

            persistMessages(chatId, [autoConfirmMessage])
                .catch(err => console.error('[autoConfirm] Chat persist failed:', err));

            logSocketAudit('ORDER_AUTO_CONFIRM_DELIVERED', { chatId, orderId });

        } catch (error) {
            console.error('[autoConfirm] Failed:', error);
        }
    }, AUTO_CONFIRM_DELAY);
};

module.exports = {
    handleMarkDeliveryComplete,
    handleConfirmDelivery,
    handleDenyDelivery,
};