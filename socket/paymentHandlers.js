/**
 * paymentHandlers.js - Socket handlers for payment flow
 */

const { Chat } = require('../models/Chat');
const Order = require('../models/Order');
const RunnerPayout = require('../models/RunnerPayout');
const User = require('../models/User');
const logger = require('../utils/logger');
const { logSocketAudit } = require('../utils/socketAudit');
const paymentService = require('../services/paymentServices');
const Escrow = require('../models/Escrows');

const handlePaymentSuccess = async (socket, io, data) => {
  try {
    const { chatId, escrowId, reference, orderId } = data;

    if (reference) {
      try {
        const verification = await paymentService.verifyPayment(reference);
        if (verification?.alreadyPaid) {
          logger.info(`Payment already verified for ref ${reference}`);
        } else {
          logger.info(`Payment verified via socket for ref ${reference}`);
        }
      } catch (err) {
        logger.error('verifyPayment via socket failed:', err.message);
        // Don't block — continue with rest of handler
      }
    }

    logger.info('💰 Payment success received:', { chatId, escrowId, reference, orderId });

    const chat = await Chat.findOne({ chatId });
    if (!chat) {
      logger.error('Chat not found:', chatId);
      return socket.emit('error', { message: 'Chat not found' });
    }

    // Find order
    let order;

    if (orderId) {
      order = await Order.findOne({ orderId });
    } else if (escrowId) {
      order = await Order.findOne({ escrowId });
    } else {
      // Find the most recent UNPAID order for this chat
      order = await Order.findOne({
        chatId,
        paymentStatus: { $ne: 'paid' }
      }).sort({ createdAt: -1 });
    }

    if (!order) {
      logger.error('Order not found for payment');
      return socket.emit('error', { message: 'Order not found' });
    }

    // Idempotency guard — don't double-process
    const alreadyPaid = order.paymentStatus === 'paid';

    if (!alreadyPaid) {

      let resolvedEscrowId = escrowId || order.escrowId;

      if (!resolvedEscrowId && order.totalAmount > 0) {
        const escrow = await Escrow.create({
          taskId: order._id,
          orderId: order._id,
          chatId,
          userId: chat.userId,
          runnerId: chat.runnerId,
          amount: order.totalAmount,
          totalAmount: order.totalAmount,
          itemBudget: order.itemBudget || 0,
          deliveryFee: order.deliveryFee || 0,
          platformFee: order.platformFee || 0,
          runnerPayout: order.runnerPayout || 0,
          taskType: order.serviceType || order.taskType,
          status: 'funded',
          fundedAt: new Date(),
          ...(reference && { paystackReference: reference }),
        });
        resolvedEscrowId = escrow._id.toString();
        console.log('[payment] created escrow for card payment:', resolvedEscrowId);
      }

      await Order.findOneAndUpdate(
        { orderId: order.orderId },
        {
          $set: {
            paymentStatus: 'paid',
            status: 'paid',
            escrowId: resolvedEscrowId,
            ...(reference && { paystackReference: reference }),
            ...(!order.chatId && chatId && { chatId }),
          },
          $push: {
            statusHistory: {
              status: 'paid',
              timestamp: new Date(),
              triggeredBy: 'user',
              triggeredById: chat.userId,
              note: 'Payment confirmed',
            }
          }
        }
      );

      if (!alreadyPaid) {
        await RunnerPayout.findOneAndUpdate(
          { orderId: order.orderId },
          {
            $setOnInsert: {
              orderId: order.orderId,
              chatId,
              runnerId: chat.runnerId,
              userId: chat.userId,
              itemBudget: order.itemBudget || 0,
              deliveryFee: order.deliveryFee || 0,
              runnerPayout: order.runnerPayout || 0,
              status: 'pending',
              usedPayoutSystem: false,
            }
          },
          { upsert: true, new: true }
        );
      }

      // Re-fetch so order.escrowId is correct for the emit below
      order = await Order.findOne({ orderId: order.orderId }).lean();
      logSocketAudit('PAYMENT_SUCCESS', {
        orderId: data.orderId,
        chatId: data.chatId,
        escrowId: data.escrowId,
        reference: data.reference,
      });

      logger.info(`✅ Order ${order.orderId} saved with paymentStatus: paid`);
    } else {
      logger.info(`Order ${order.orderId} already paid — skipping DB update but still notifying room`);
    }

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

    const receiptMessage = {
      id: `payment-receipt-${Date.now()}`,
      from: 'system',
      type: 'payment_confirmed',
      messageType: 'payment_confirmed',
      text: `${userName} made payment for this task`,
      time: systemMessage.time,
      senderId: 'system',
      senderType: 'system',
      status: 'sent',
      paymentConfirmed: true,
      paymentData: {
        orderId: order.orderId,
        itemBudget: order.itemBudget,
        deliveryFee: order.deliveryFee,
        totalAmount: order.totalAmount,
        serviceType: order.serviceType,
      },
    };

    // Re-fetch fresh chat to avoid stale read
    const freshChat = await Chat.findOne({ chatId });
    const alreadyHasPaymentMsg = freshChat?.messages?.some(
      m => m.paymentConfirmed === true ||
        m.type === 'payment_confirmed' ||
        m.messageType === 'payment_confirmed' ||
        (m.type === 'system' && m.text?.toLowerCase().includes('made payment for this task'))
    );

    if (!alreadyHasPaymentMsg) {
      await Chat.findOneAndUpdate(
        { chatId },
        {
          $push: { messages: { $each: [systemMessage, receiptMessage] } },
          $set: { lastActivity: new Date() }
        }
      );
    } else {
      logger.info(`Payment messages already exist for chat ${chatId} — skipping push`);
    }

    // Emit to room
    const room = io.sockets.adapter.rooms.get(chatId);
    console.log(`Room ${chatId} has ${room?.size ?? 0} sockets`);
    logger.info(`Room ${chatId} has ${room?.size ?? 0} sockets`);

    // emit both system messages
    io.to(chatId).emit('message', systemMessage);
    io.to(chatId).emit('message', receiptMessage);

    io.to(chatId).emit('paymentConfirmed', {
      chatId,
      orderId: order.orderId,
      escrowId,
      order: {
        chatId,
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

    console.log('[payment]- changed usedpayout to false line 163 paymnethandlers runner socket in room?', chatId, 'room size:', room?.size);

    console.log('[payment] emitting paymentSuccess to room:', chatId, 'data:', { escrowId, orderId });

    io.to(chatId).emit('paymentSuccess', {
      escrowId: order.escrowId?.toString() ?? escrowId,  // prefer the DB value
      orderId: order.orderId,
      paymentStatus: 'paid'
    });

  } catch (err) {
    logger.error('handlePaymentSuccess error:', err);
    socket.emit('error', { message: 'Failed to process payment confirmation' });
  }
};

module.exports = { handlePaymentSuccess };