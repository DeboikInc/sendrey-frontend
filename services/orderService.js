const Order = require('../models/Order');
const Runner = require('../models/Runner');
const User = require('../models/User');
const { Chat } = require('../models/Chat');

const Escrow = require('../models/Escrows');
const Wallet = require('../models/Wallet');
const LedgerEntry = require('../models/LedgerEntry');

const cancelOrder = async ({ orderId, chatId, runnerId, userId, reason, cancelledBy = 'runner' }) => {
  const order = await Order.findOne({
    ...(orderId ? { orderId } : {}),
    ...(chatId ? { chatId } : {})
  }).sort({ createdAt: -1 });

  if (!order) throw new Error('Order not found');

  let escrowFlagged = false;

  // Handle paid orders — return funds to escrow for admin review
  if (order.paymentStatus === 'paid') {
    const escrow = await Escrow.findOne({ taskId: order.orderId });

    if (escrow && escrow.status === 'funded') {
      // If wallet payment, unlock the locked balance back to available
      const userWallet = await Wallet.findOne({ userId: order.userId, userType: 'user' });
      if (userWallet && userWallet.lockedBalance >= escrow.totalAmount) {
        userWallet.lockedBalance -= escrow.totalAmount;
        userWallet.balance += escrow.totalAmount;
        await userWallet.save();
      }

      escrow.status = 'disputed';
      escrow.metadata = {
        ...escrow.metadata,
        adminReview: true,
        cancelledBy,
        cancellationReason: reason || `Cancelled by ${cancelledBy}`,
        cancelledAt: new Date(),
        awaitingAdminRefund: true,
      };
      await escrow.save();

      await LedgerEntry.create({
        userId: order.userId,
        userModel: 'User',
        runnerId: order.runnerId,
        type: 'escrow_lock',
        grossAmount: escrow.totalAmount,
        netAmount: escrow.totalAmount,
        providerFee: 0,
        provider: 'system',
        orderId: order.orderId,
        escrowId: escrow._id,
        description: `Order ${order.orderId} cancelled by ${cancelledBy} — held in escrow pending admin review`,
        status: 'pending',
      });

      escrowFlagged = true;
      console.log(`Escrow ${escrow._id} flagged for admin review after cancellation of paid order ${order.orderId}`);
    }
  }

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
    text: escrowFlagged
      ? `Order cancelled — your payment is held securely and will be reviewed by our team within 24 hours.`
      : reason
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

  return { order, cancelMessage, escrowFlagged };
};

module.exports = { cancelOrder };