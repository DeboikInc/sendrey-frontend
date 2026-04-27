// utils/handleRejectionStrike.js
const Runner = require('../models/Runner');
const { Chat } = require('../models/Chat');
const Order = require('../models/Order');
const Escrow = require('../models/Escrows');
const paymentService = require('../services/paymentServices');

const persistMessages = async (chatId, messages) => {
  await Chat.findOneAndUpdate(
    { chatId },
    { $push: { messages: { $each: messages } } },
    { upsert: true }
  );
};

const handleRejectionStrike = async (io, runnerId, chatId) => {
  console.log(`[rejectionStrike] Processing strike for runner ${runnerId} in chat ${chatId}`);

  const runner = await Runner.findByIdAndUpdate(
    runnerId,
    { $inc: { itemRejectionCount: 1 } },
    { new: true }
  ).select('itemRejectionCount firstName');

  if (!runner) {
    console.warn(`[rejectionStrike] Runner ${runnerId} not found`);
    return;
  }

  const count = runner.itemRejectionCount;
  console.log(`[rejectionStrike] Runner ${runner.firstName} (${runnerId}) now has ${count} strike(s)`);

  if (count >= 3) {
    console.log(`[rejectionStrike] Runner ${runner.firstName} has reached ${count} strikes — BANNING`);

    await Runner.findByIdAndUpdate(runnerId, {
      runnerStatus: 'banned',
      isOnline: false,
      isAvailable: false,
      isActive: false
    });

    const activeOrder = await Order.findOne({
      chatId,
      status: { $nin: ['completed', 'cancelled', 'task_completed'] }
    }).sort({ createdAt: -1 });

    if (activeOrder) {
      // cancel the order
      await Order.findByIdAndUpdate(activeOrder._id, { status: 'cancelled' });

      // refund escrow to user if funded
      if (activeOrder.escrowId) {
        try {
          const escrow = await Escrow.findById(activeOrder.escrowId);
          if (escrow && escrow.status === 'funded') {
            // await paymentService.refundToUser(escrow._id);
            // console.log(`[rejectionStrike] Escrow ${activeOrder.escrowId} refunded to user`);
          }
        } catch (err) {
          console.error('[rejectionStrike] Refund failed:', err.message);
        }
      }

      const userId = activeOrder.userId?.toString();

      const userMsg = {
        id: `runner-banned-user-${Date.now()}`,
        from: 'system', type: 'system', messageType: 'system',
        text: `This runner has been banned after ${count} violations. Your order has been cancelled and is under review by our team. A refund will be processed shortly.`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'sent', senderId: 'system', senderType: 'system', style: 'error',
      };

      const runnerMsg = {
        id: `runner-banned-runner-${Date.now() + 1}`,
        from: 'system', type: 'system', messageType: 'system',
        text: `Your account has been banned. This order has been cancelled.`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'sent', senderId: 'system', senderType: 'system', style: 'error',
      };

      await persistMessages(chatId, [userMsg, runnerMsg]);

      // emit to chat room
      io.to(chatId).emit('message', userMsg);
      io.to(chatId).emit('message', runnerMsg);

      // trigger order cancelled on user side → back to home
      if (userId) {
        io.to(`user-${userId}`).emit('orderCancelled', {
          orderId: activeOrder.orderId,
          cancelledBy: 'system',
          reason: 'Runner banned',
        });
      }

      // trigger on runner side too
      io.to(`runner-${runnerId}`).emit('orderCancelled', {
        orderId: activeOrder.orderId,
        cancelledBy: 'system',
      });

      console.log(`[rejectionStrike] Order ${activeOrder.orderId} cancelled, user notified`);
    }

    // emit ban event
    io.to(`runner-${runnerId.toString()}`).emit('verificationStatus', {
      isBanned: true,
      reason: 'Your account has been banned due to repeated item or delivery rejections.',
    });
  }
};

module.exports = { handleRejectionStrike };