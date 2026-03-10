const Order = require('../models/Order');
const Runner = require('../models/Runner');
const User = require('../models/User');
const { Chat } = require('../models/Chat');
const { logSocketAudit } = require('../utils/socketAudit');
const logger = require('../utils/logger');

// Remove runner from the in-memory service pool
const { runnersByService } = require('./socketHandlers');
const { cancelOrder } = require('../services/orderService');

const handleCancelOrder = async (socket, io, data) => {
    const { chatId, orderId, runnerId, userId, reason } = data;

    try {
        const { order, cancelMessage } = await cancelOrder({
            orderId, chatId, runnerId, userId, reason, cancelledBy: 'runner'
        });

        if (order.serviceType && runnersByService[order.serviceType]) {
            runnersByService[order.serviceType].delete(socket.id);
        }

        io.to(chatId).emit('orderCancelled', {
            orderId: order.orderId,
            chatId,
            message: cancelMessage.text,
            cancelledBy: 'runner',
        });

        io.to(chatId).emit('message', cancelMessage);

        const room = io.sockets.adapter.rooms.get(chatId);
        if (room) {
            for (const socketId of room) {
                const s = io.sockets.sockets.get(socketId);
                if (s) s.leave(chatId);
            }
        }

    } catch (error) {
        const msg = error.message === 'PAID_ORDER'
            ? 'This order has already been funded and cannot be cancelled. Please raise a dispute instead.'
            : 'Failed to cancel order. Please try again.';
        socket.emit('cancelOrderError', { message: msg });
    }
};

const handleTaskCompleted = async (io, data) => {
    const { chatId, orderId, runnerId, userId } = data;

    try {
        logger.info('Task Completed:', { chatId, orderId, runnerId, userId });
        // Set runner and user available
        await Runner.findByIdAndUpdate(runnerId, {
            isAvailable: true,
            activeOrderId: null,
            currentUserId: null,
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

        // console.log(`Task ${orderId} completed. Runner ${runnerId} and user ${userId} freed.`);

    } catch (error) {
        logger.info('Order or chatId not found', { chatId, orderId, runnerId, });
        console.error('handleTaskCompleted error:', error);
    }
};

module.exports = { handleCancelOrder, handleTaskCompleted };