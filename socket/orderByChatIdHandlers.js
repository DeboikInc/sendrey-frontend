const Order = require('../models/Order');
const { logSocketAudit } = require('../utils/socketAudit');

/**
 * Handle getOrderByChatId event
 * Fetches order details by chatId and emits back orderByChatId with full order object
 */
const handleGetOrderByChatId = async (socket, data) => {
    try {
        const { chatId, runnerId } = data;
        
        if (!chatId) {
            socket.emit('orderByChatId', { error: 'chatId is required' });
            return;
        }

        // Find the order by chatId
        const order = await Order.findOne({ chatId })
            .populate('userId', 'name email phone fleetType')
            .populate('runnerId', 'name email phone fleetType')
            .lean();

        if (!order) {
            console.log(`Order not found for chatId: ${chatId}`);
            socket.emit('orderByChatId', { error: 'Order not found', chatId });
            return;
        }

        // Log the fetch
        logSocketAudit('GET_ORDER_BY_CHAT_ID', {
            chatId,
            orderId: order.orderId,
            runnerId,
            serviceType: order.serviceType
        });

        // Emit the full order object back to the client
        socket.emit('orderByChatId', {
            order,
            chatId,
            orderId: order.orderId,
            serviceType: order.serviceType,
            deliveryLocation: order.deliveryLocation,
            deliveryCoordinates: order.deliveryCoordinates,
            marketLocation: order.marketLocation,
            marketCoordinates: order.marketCoordinates,
            pickupLocation: order.pickupLocation,
            pickupCoordinates: order.pickupCoordinates,
            usedPayoutSystem: order.usedPayoutSystem,
            payout: order.payout,
            status: order.status,
            statusHistory: order.statusHistory,
            paymentStatus: order.paymentStatus,
            runnerId: order.runnerId,
            userId: order.userId
        });

        // console.log("serviceType in orderbychat", order.serviceType)

    } catch (error) {
        console.error('Error in handleGetOrderByChatId:', error);
        socket.emit('orderByChatId', { 
            error: 'Failed to fetch order',
            message: error.message 
        });
    }
};

module.exports = { handleGetOrderByChatId };