const Order = require('../models/Order');
const Escrow = require('../models/Escrows');
const Chat = require('../models/Chat').Chat;
const paymentService = require('../services/paymentServices');
const User = require('../models/User');
const Runner = require('../models/Runner');
const orderStateMachine = require('../services/orderStateMachine');
const { logSocketAudit } = require('../utils/socketAudit');
const { handleRejectionStrike } = require('../utils/handleRejectionStrike');

const {
    notifyDeliveryConfirmationRequest,
    notifyAutoConfirmWarning, 
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
        const terminalStatuses = ['completed', 'cancelled', 'task_completed', 'archived', 'disputed', 'dispute_resolved'];

        order = await Order.findOne({ orderId }).sort({ createdAt: -1 });
        console.log('[markDeliveryComplete] initial lookup:', order?.orderId, '| status:', order?.status, '| paymentStatus:', order?.paymentStatus);

        if (!order || terminalStatuses.includes(order?.status)) {
            console.log('[markDeliveryComplete] initial order is terminal or missing, searching by chatId:', chatId);

            const candidates = await Order.find({ chatId }).sort({ createdAt: -1 }).lean();
            console.log('[markDeliveryComplete] all orders for chatId:', candidates.map(o => ({
                orderId: o.orderId,
                status: o.status,
                paymentStatus: o.paymentStatus,
                deliveryConfirmedAt: o.deliveryConfirmedAt,
            })));

            order = candidates.find(o =>
                !terminalStatuses.includes(o.status) &&
                o.paymentStatus === 'paid'
            ) || null;

            console.log('[markDeliveryComplete] resolved order:', order?.orderId, '| status:', order?.status);
        }

        if (!order) return socket.emit('error', { message: 'No active order found' });

        if (order.paymentStatus !== 'paid') {
            return socket.emit('error', { message: 'Payment required before marking delivery complete' });
        }

        if (order.status === 'delivered') return socket.emit('error', { message: 'Delivery already marked as complete' });
    } catch (err) {
        console.error('[markDeliveryComplete] Order lookup failed:', err);
        return socket.emit('error', { message: 'Failed to find order. Please try again.' });
    }


    // State transition + escrow update 
    try {
        const advanceToDelivered = async (currentStatus, resolvedOrderId) => {
            if (currentStatus === 'delivered') {
                // Already delivered — just ensure escrow and messages proceed
                return;
            }

            const steps = {
                'pending_payment': ['paid', 'in_progress', 'delivered'],
                'paid': ['in_progress', 'delivered'],
                'in_progress': ['delivered'],
                'items_submitted': ['items_approved', 'delivered'],
                'items_approved': ['delivered'],
            };

            const path = steps[currentStatus];
            if (!path) throw new Error(`Cannot advance to delivered from status: ${currentStatus}`);

            for (const step of path) {
                await orderStateMachine.transition(resolvedOrderId, step, {
                    triggeredBy: step === 'delivered' ? 'runner' : 'system',
                    triggeredById: step === 'delivered' ? runnerId : null,
                    note: step === 'delivered'
                        ? 'Runner marked as delivered'
                        : `Auto-progressed from ${currentStatus} to ${step}`,
                });
            }
        };

        await advanceToDelivered(order.status, order.orderId);


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
        order = await Order.findOne({ orderId }).sort({ createdAt: -1 });
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
        text: 'You confirmed delivery.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'sent', senderId: 'system', senderType: 'system',
    };

    const runnerSystemMsg = {
        id: `delivery-confirmed-runner-${Date.now() + 1}`,
        from: 'system', type: 'system', messageType: 'system',
        text: `${userName} confirmed the delivery of their item(s).`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'sent', senderId: 'system', senderType: 'system',
    };

    // Emit 
    io.to(chatId).emit('deliveryConfirmed', { orderId: order.orderId, status: 'completed' });

    io.to(`user-${userId}`).emit('message', userSystemMsg);
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
        order = await Order.findOne({ orderId }).sort({ createdAt: -1 });
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
    io.to(`user-${userId}`).emit('message', userSystemMsg);
    io.to(`runner-${order.runnerId.toString()}`).emit('message', runnerSystemMsg);

    // Persist
    try {
        await persistMessages(chatId, [userSystemMsg, runnerSystemMsg]);
    } catch (err) {
        console.error('[denyDelivery] Chat persist failed:', err);
        // No rollback needed — order already reverted above, messages already emitted
    }

    // ban them
    await handleRejectionStrike(io, order.runnerId.toString(), chatId);

    logSocketAudit('USER_DENIED_ORDER_DELIVERED', { userId, chatId, orderId });
};

// ─── Auto-confirm after 4 hours ─────────────────────────────────────────────

const scheduleAutoConfirm = (io, chatId, orderId, escrowId) => {
    const AUTO_CONFIRM_DELAY = 4 * 60 * 60 * 1000;       // 4 hours
    const WARNING_BEFORE = 10 * 60 * 1000;            // 10 min warning
    const WARNING_DELAY = AUTO_CONFIRM_DELAY - WARNING_BEFORE;

    // ── 10-minute warning ────────────────────────────────────────────────────
    setTimeout(async () => {
        try {
            const order = await Order.findOne({ orderId }).sort({ createdAt: -1 });
            // Only warn if still waiting for confirmation
            if (!order || order.deliveryConfirmedAt || order.status !== 'delivered') return;

            const warningMessage = {
                id: `auto-confirm-warning-${Date.now()}`,
                from: 'system', type: 'system', messageType: 'system',
                text: 'Your order will be automatically marked as completed in 10 minutes if no action is taken.',
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                status: 'sent', senderId: 'system', senderType: 'system', style: 'warning',
            };

            // Send warning only to user (runner doesn't need it)
            io.to(`user-${order.userId.toString()}`).emit('message', warningMessage);
            io.to(`user-${order.userId.toString()}`).emit('autoConfirmWarning', {
                orderId,
                minutesRemaining: 10,
            });

            persistMessages(chatId, [warningMessage])
                .catch(err => console.error('[autoConfirm] Warning persist failed:', err));

            // Push notification warning
            const { notifyAutoConfirmWarning } = require('../services/notificationService');
            notifyAutoConfirmWarning(order.userId, { orderId, minutesRemaining: 10 })
                .catch(err => console.warn('[autoConfirm] Warning push notify failed:', err.message));

        } catch (error) {
            console.error('[autoConfirm] Warning phase failed:', error);
        }
    }, WARNING_DELAY);

    // ── Full auto-confirm ────────────────────────────────────────────────────
    setTimeout(async () => {
        try {
            const order = await Order.findOne({ orderId }).sort({ createdAt: -1 });
            if (!order || order.deliveryConfirmedAt || order.status !== 'delivered') return;

            await orderStateMachine.transition(orderId, 'completed', {
                triggeredBy: 'system',
                note: 'Auto-confirmed after 4 hours',
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

            // ── System message shown in chat ──────────────────────────────────
            const autoCompleteMessage = {
                id: `auto-confirm-${Date.now()}`,
                from: 'system', type: 'task_completed', messageType: 'task_completed',
                text: 'This order has been marked as completed because the user did not respond in time.',
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                status: 'sent', senderId: 'system', senderType: 'system',
                orderId: order.orderId,
            };

            // Emit task_completed event so both sides trigger their completion UI
            io.to(chatId).emit('message', autoCompleteMessage);
            io.to(chatId).emit('taskCompleted', { orderId, triggeredBy: 'system' });

            // Also keep the existing delivery events so tracking etc. resolves
            io.to(chatId).emit('deliveryAutoConfirmed', { orderId, status: 'completed' });
            io.to(`tracking:${orderId}`).emit('runner:delivered', { orderId });

            persistMessages(chatId, [autoCompleteMessage])
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