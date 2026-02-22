/**
 * paymentHandlers.js - Socket handlers for payment flow
 */

const { Chat } = require('../models/Chat');
const Order = require('../models/Order');
const RunnerPayout = require('../models/RunnerPayout');
const User = require('../models/User');
const logger = require('../utils/logger');

const handlePaymentSuccess = async (socket, io, data) => {
  try {
    const { chatId, escrowId, reference, orderId } = data;

    logger.info('💰 Payment success received:', { chatId, escrowId, reference, orderId });

    const chat = await Chat.findOne({ chatId });
    if (!chat) {
      logger.error('Chat not found:', chatId);
      return socket.emit('error', { message: 'Chat not found' });
    }

    // Find and update order
    const order = await Order.findOne({
      $or: [
        ...(orderId ? [{ orderId }] : []),
        { chatId },
        ...(escrowId ? [{ escrowId }] : []),
      ]
    });

    if (!order) {
      logger.error('Order not found for payment');
      return socket.emit('error', { message: 'Order not found' });
    }

    logger.info(`Order found: ${order.orderId} | chatId stored on order: ${order.chatId}`);

    // Update order payment status
    order.paymentStatus = 'paid';
    order.status = 'active';
    if (escrowId) order.escrowId = escrowId;
    if (reference) order.paystackReference = reference;

    // Add to status history
    order.statusHistory.push({
      status: 'active',
      timestamp: new Date(),
      triggeredBy: 'user',
      triggeredById: chat.userId,
      note: 'Payment confirmed'
    });

    if (!order.chatId && chatId) {
      order.chatId = chatId;
      await order.save();
    }

    // Get user info for system message
    const user = await User.findById(chat.userId).lean();
    const userName = user ? `${user.firstName} ${user.lastName || ''}`.trim() : 'User';

    // Create system message for runner
    const systemMessage = {
      id: `payment-confirmed-${Date.now()}`,
      from: 'system',
      type: 'system',
      messageType: 'system',
      text: `${userName} made payment for this task`,
      time: new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }),
      senderId: 'system',
      senderType: 'system',
      status: 'sent',
      paymentConfirmed: true,
    };

    // Save system message to chat
    chat.messages.push(systemMessage);
    chat.lastActivity = new Date();
    await chat.save();

    // Emit system message to both user and runner
    io.to(chatId).emit('message', systemMessage);

    // Emit payment confirmed event
    io.to(chatId).emit('paymentConfirmed', {
      chatId,
      orderId: order.orderId,
      escrowId,
      order: {
        orderId: order.orderId,
        paymentStatus: 'paid',
        status: 'active',
        escrowId: order.escrowId,
        itemBudget: order.itemBudget,
        deliveryFee: order.deliveryFee,
        totalAmount: order.totalAmount,
      },
    });

    // Notify runner specifically
    io.to(`runner-${chat.runnerId}`).emit('paymentReceived', {
      chatId,
      userId: chat.userId,
      userName,
      orderId: order.orderId,
      amount: order.totalAmount,
      serviceType: order.serviceType,
    });

    logger.info(`✅ Payment confirmed for order ${order.orderId}, system message sent to runner`);

    // Create RunnerPayout for run-errand tasks
    if (order.serviceType === 'run-errand' || order.serviceType === 'run_errand') {
      const existingPayout = await RunnerPayout.findOne({ orderId: order.orderId });

      if (!existingPayout) {
        await RunnerPayout.create({
          orderId: order.orderId,
          chatId: order.chatId,
          runnerId: order.runnerId,
          userId: order.userId,
          escrowId: order.escrowId,
          itemBudget: order.itemBudget,
          status: 'pending',
          usedPayoutSystem: false, // Will be set to true when runner submits receipt
        });

        logger.info(`RunnerPayout created for order ${order.orderId} with itemBudget ₦${order.itemBudget}`);
      }
    }

  } catch (err) {
    logger.error('handlePaymentSuccess error:', err);
    socket.emit('error', { message: 'Failed to process payment confirmation' });
  }
};

module.exports = { handlePaymentSuccess };