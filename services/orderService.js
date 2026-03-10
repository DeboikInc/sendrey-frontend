const Order = require('../models/Order');
const Runner = require('../models/Runner');
const User = require('../models/User');
const { Chat } = require('../models/Chat');

const cancelOrder = async ({ orderId, chatId, runnerId, userId, reason, cancelledBy = 'runner' }) => {
  const order = await Order.findOne({ 
    ...(orderId ? { orderId } : {}), 
    ...(chatId ? { chatId } : {}) 
  });
  
  if (!order) throw new Error('Order not found');
  if (order.paymentStatus === 'paid') throw new Error('PAID_ORDER');

  order.status = 'cancelled';
  order.cancelledBy = cancelledBy;
  order.cancelledAt = new Date();
  order.cancellationReason = reason || `Cancelled by ${cancelledBy}`;
  order.statusHistory.push({
    status: 'cancelled',
    timestamp: new Date(),
    triggeredBy: cancelledBy,
    note: reason || `Cancelled by ${cancelledBy}`,
  });
  await order.save();

  await Runner.findByIdAndUpdate(runnerId, {
    isAvailable: true,
    activeOrderId: null,
    currentUserId: null,
  });

  await User.findByIdAndUpdate(userId, {
    isAvailable: true,
    activeOrderId: null,
    currentRunnerId: null,
    $unset: { currentRequest: '' },
  });

  const cancelMessage = {
    id: `cancel-${Date.now()}`,
    from: 'system',
    type: 'system',
    messageType: 'system',
    text: reason
      ? `Order cancelled — Reason: ${reason}`
      : `${cancelledBy === 'runner' ? 'Runner' : 'Admin'} has cancelled the order.`,
    time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
    senderId: 'system',
    senderType: 'system',
    status: 'sent',
  };

  await Chat.findOneAndUpdate(
    { chatId: chatId || order.chatId },
    { $push: { messages: cancelMessage } }
  );

  return { order, cancelMessage };
};

module.exports = { cancelOrder };