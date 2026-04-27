const Order = require('../models/Order');
const Runner = require('../models/Runner');
const Escrow = require('../models/Escrows');
const User = require('../models/User');
const { Chat } = require('../models/Chat');
const { logSocketAudit } = require('../utils/socketAudit');
const logger = require('../utils/logger');
const { archiveCurrentSession } = require('./socketHandlers');

// Remove runner from the in-memory service pool
const { runnersByService } = require('./socketHandlers');
const { cancelOrder } = require('../services/orderService');


const handleCancelOrder = async (socket, io, data) => {
    const { chatId, orderId, runnerId, userId, reason } = data;
    try {
        const { order, cancelMessage } = await cancelOrder({
            orderId, chatId, runnerId, userId, reason, cancelledBy: 'runner'
        });

        await Promise.all([
            Runner.findByIdAndUpdate(runnerId, { isAvailable: true, activeOrderId: null, currentUserId: null }),
            User.findByIdAndUpdate(userId,
                {
                    isAvailable: true,
                    activeOrderId: null,
                    currentRunnerId: null,
                    $unset: { currentRequest: '' },
                }),
        ]);

        if (order.serviceType && runnersByService[order.serviceType]) {
            runnersByService[order.serviceType].delete(socket.id);
        }

        // Get runner name for message
        const runner = await Runner.findById(runnerId).select('firstName lastName');
        const runnerName = runner ? `${runner.firstName} ${runner.lastName || ''}`.trim() : 'Runner';

        // Clear chat messages for this chatId to prepare for fresh start
        await Chat.findOneAndUpdate(
            { chatId },
            { $set: { lastActivity: new Date() } }
            // Don't wipe messages — runner/user may want to browse completed chat
        );

        const systemMessage = {
            id: `cancel-${Date.now()}`,
            chatId,
            text: `${runnerName} cancelled this order. ${reason}`,
            type: 'system',
            from: 'system',
            senderId: 'system',
            senderType: 'system',
            createdAt: new Date().toISOString(),
        };


        // Archive session on cancellation
        await archiveCurrentSession(chatId, orderId, 'cancelled');

        io.to(chatId).emit('orderCancelled', {
            orderId: order.orderId,
            chatId,
            message: cancelMessage.text,
            cancelledBy: 'runner',
            runnerName,
            systemMessage,
            clearChat: true
        });
        io.to(chatId).emit('message', systemMessage);

        // Check if user is online
        const userSockets = await io.in(chatId).fetchSockets();
        const userOnline = userSockets.some(s => s.data?.userId === userId || s.data?.userType === 'user');

        if (!userOnline) {
            // Send push notification
            const user = await User.findById(userId).select('pushToken pushTokens');
            const tokens = user?.pushTokens || (user?.pushToken ? [user.pushToken] : []);

            if (tokens.length > 0) {
                await sendPushNotification(tokens, {
                    title: 'Order Cancelled',
                    body: `${runnerName} cancelled your order ${reason}`,
                    data: { type: 'order_cancelled', chatId, orderId: order.orderId },
                });
            }
        }

        // Leave room
        const room = io.sockets.adapter.rooms.get(chatId);
        if (room) {
            for (const socketId of room) {
                const s = io.sockets.sockets.get(socketId);
                if (s) s.leave(chatId);
            }
        }
    } catch (error) {
        const msg = error.message === 'PAID_ORDER'
            ? 'This order has already been funded and cannot be cancelled.'
            : 'Failed to cancel order. Please try again.';
        socket.emit('cancelOrderError', { message: msg });
    }
};


const handleTaskCompleted = async (io, data) => {
    const { chatId, orderId, runnerId, userId } = data;

    try {
        const order = await Order.findOne({ orderId });
        if (!order) return;

        logger.info('Task Completed:', { chatId, orderId, runnerId, userId });
        let escrowId = order?.escrowId;
        if (!escrowId) {
            const escrow = await Escrow.findOne({ taskId: orderId }).lean();
            if (escrow) {
                escrowId = escrow._id;
                await Order.findOneAndUpdate({ orderId }, { $set: { escrowId: escrow._id } });
                logger.warn(`handleTaskCompleted: patched missing escrowId for order ${orderId}`);
            } else {
                logger.warn(`handleTaskCompleted: no escrow found for order ${orderId} — payout skipped`);
            }
        }

        if (escrowId) {
            try {
                const paymentService = require('../services/paymentServices');
                const result = await paymentService.payoutToRunner(order.escrowId);
                logger.info(`✅ Runner paid | orderId=${orderId} | payout=₦${result.runnerPayout} | usedPayoutSystem=${result.usedPayoutSystem}`);
            } catch (err) {
                // Don't block task completion if payout fails
                logger.error(`payoutToRunner failed for order ${orderId}:`, err.message);
            }
        } else {
            logger.warn(`handleTaskCompleted: no escrowId on order ${orderId} — payout skipped`);
        }

        // transition order to completed
        try {
            const orderStateMachine = require('../services/orderStateMachine');
            await orderStateMachine.transition(orderId, 'completed', {
                triggeredBy: 'system',
                note: 'Task completed by runner',
            });
        } catch (err) {
            // Already completed via delivery confirmation — safe to ignore
            logger.warn(`handleTaskCompleted: state transition skipped for ${orderId}: ${err.message}`);
        }

        // Set runner and user available
        await Runner.findByIdAndUpdate(runnerId, {
            isAvailable: true,
            activeOrderId: null,
            currentUserId: null,
            $inc: { completedOrders: 1, totalRuns: 1 }
        });

        await User.findByIdAndUpdate(userId, {
            isAvailable: true,
            activeOrderId: null,
            currentRunnerId: null,
        });

        // Clear user's currentRequest
        await User.findByIdAndUpdate(userId, {
            $unset: { currentRequest: '' }
        });

        await Chat.findOneAndUpdate(
            { chatId },
            { $set: { lastActivity: new Date() } }
            // Don't wipe messages — runner/user may want to browse completed chat
        );

        await Order.updateMany(
            { chatId, paymentStatus: 'unpaid', status: { $nin: ['completed', 'cancelled', 'task_completed'] }, orderId: { $ne: orderId } },
            { $set: { status: 'cancelled', cancelledAt: new Date(), cancelReason: 'task_completed_new_order_started' } }
        );

        // Remove runner from service pool
        const room = io.sockets.adapter.rooms.get(chatId);
        if (room) {
            for (const socketId of room) {
                const s = io.sockets.sockets.get(socketId);
                if (s) {
                    // Remove from service pool if runner socket
                    if (s.runnerId && s.serviceType && runnersByService[s.serviceType]) {
                        runnersByService[s.serviceType].delete(socketId);
                    }
                    s.leave(chatId);
                }
            }
        }

        // Archive session on completion
        await archiveCurrentSession(chatId, orderId, 'completed');

        // Emit task completed with clear flag
        io.to(chatId).emit('task_completed', {
            orderId,
            chatId,
            runnerId,
            userId,
            clearChat: true
        });

        const chat = await Chat.findOne({ chatId });
        console.log(`[TaskCompleted] Final messages in chat:`, chat?.messages.map(m => ({ id: m.id, type: m.type, text: m.text?.slice(0, 50) })));


        logger.info(`Task ${orderId} completed. Runner ${runnerId} and user ${userId} freed. Chat cleared for fresh start.`);

    } catch (error) {
        logger.info('Order or chatId not found', { chatId, orderId, runnerId, });
        console.error('handleTaskCompleted error:', error);
    }
};

const handleRunnerStartedNewOrder = async (socket, data) => {
    const { runnerId, previousOrderId } = data;
    try {
        // Cancel any lingering unpaid orders for this runner
        await Order.updateMany(
            {
                runnerId,
                paymentStatus: { $ne: 'paid' },
                status: { $nin: ['completed', 'cancelled'] },
                ...(previousOrderId ? { orderId: { $ne: previousOrderId } } : {})
            },
            {
                $set: {
                    status: 'cancelled',
                    cancelledBy: 'system',
                    cancelledAt: new Date(),
                    cancellationReason: 'Runner started new order',
                },
                $push: {
                    statusHistory: {
                        status: 'cancelled',
                        timestamp: new Date(),
                        triggeredBy: 'system',
                        note: 'Runner started new order — stale pending order auto-cancelled',
                    }
                }
            }
        );

        await Runner.findByIdAndUpdate(runnerId, {
            isAvailable: true,
            activeOrderId: null,
            currentUserId: null,
        });
    } catch (err) {
        logger.error('handleRunnerStartedNewOrder error:', err);
    }
};

module.exports = { handleCancelOrder, handleTaskCompleted, handleRunnerStartedNewOrder };