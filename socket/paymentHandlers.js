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

    // Find order
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

    // Idempotency guard — don't double-process
    if (order.paymentStatus === 'paid') {
      logger.warn(`Order ${order.orderId} already paid — skipping`);
      return;
    }

    logger.info(`Order found: ${order.orderId} | chatId stored on order: ${order.chatId}`);

    // Update order fields
    order.paymentStatus = 'paid';
    order.status = 'paid';
    if (escrowId) order.escrowId = escrowId;
    if (reference) order.paystackReference = reference;
    if (!order.chatId && chatId) order.chatId = chatId;

    order.statusHistory.push({
      status: 'paid',
      timestamp: new Date(),
      triggeredBy: 'user',
      triggeredById: chat.userId,
      note: 'Payment confirmed'
    });

    // Always save — was previously only saved inside the chatId guard
    await order.save();
    logger.info(`✅ Order ${order.orderId} saved with paymentStatus: paid`);

    // Get user info for system message
    const user = await User.findById(chat.userId).lean();
    const userName = user ? `${user.firstName} ${user.lastName || ''}`.trim() : 'User';

    // Create system message
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

    chat.messages.push(systemMessage);
    chat.lastActivity = new Date();
    await chat.save();

    // Emit to room
    io.to(chatId).emit('message', systemMessage);

    io.to(chatId).emit('paymentConfirmed', {
      chatId,
      orderId: order.orderId,
      escrowId,
      order: {
        orderId: order.orderId,
        paymentStatus: 'paid',
        status: 'paid',
        escrowId: order.escrowId,
        itemBudget: order.itemBudget,
        deliveryFee: order.deliveryFee,
        totalAmount: order.totalAmount,
      },
    });

    io.to(`runner-${chat.runnerId}`).emit('paymentReceived', {
      chatId,
      userId: chat.userId,
      userName,
      orderId: order.orderId,
      amount: order.totalAmount,
      serviceType: order.serviceType,
    });

    logger.info(`✅ Payment confirmed for order ${order.orderId}, system message sent`);

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
          usedPayoutSystem: false,
        });

        logger.info(`RunnerPayout created for order ${order.orderId} | itemBudget: ₦${order.itemBudget}`);
      }
    }

  } catch (err) {
    logger.error('handlePaymentSuccess error:', err);
    socket.emit('error', { message: 'Failed to process payment confirmation' });
  }
};

module.exports = { handlePaymentSuccess };