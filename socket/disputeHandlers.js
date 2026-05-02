const disputeService = require('../services/disputeService');
const { Chat } = require('../models/Chat');
const { notifyDisputeRaised, notifyDisputeResolved } = require('../services/notificationService');
const { logSocketAudit } = require('../utils/socketAudit');
const Order = require('../models/Order');
const Escrow = require('../models/Escrows');
const RunnerPayout = require('../models/RunnerPayout');

const cleanForEmit = (data) => {
  if (data && typeof data === 'object') {
    if (data.toObject) return data.toObject();
    if (Array.isArray(data)) return data.map(cleanForEmit);
    const result = {};
    for (const key in data) result[key] = cleanForEmit(data[key]);
    return result;
  }
  return data;
};

const handleRaiseDispute = async (socket, io, data) => {
  const {
    chatId,
    orderId,
    raisedBy,
    raisedById,
    userId,
    runnerId,
    reason,
    description,
    evidenceFiles
  } = data;

  try {
    const dispute = await disputeService.raiseDispute({
      orderId,
      chatId,
      raisedBy,
      raisedById,
      userId,
      runnerId,
      reason,
      description,
      evidenceFiles
    });

    // Lock escrow for admin review
    const order = await Order.findOneAndUpdate(
      { orderId },
      { hasDispute: true, disputeId: dispute._id || dispute.disputeId },
      { new: true }
    ).lean();

    if (order?.escrowId) {
      await Escrow.findByIdAndUpdate(order.escrowId, {
        status: 'disputed',
        disputeId: dispute._id || dispute.disputeId,
        lockedAt: new Date(),
      });
    }

    // Lock payout
    await RunnerPayout.findOneAndUpdate(
      { orderId },
      {
        status: 'locked',
        lockedReason: 'dispute_raised',
        lockedAt: new Date(),
      }
    );

    io.to(chatId).emit('payoutLocked', {
      chatId,
      reason: 'A dispute has been raised. Payout is locked pending admin review.',
    });

    // Send dispute raised message to chat
    const disputeMessage = {
      id: `dispute-${Date.now()}`,
      from: 'system',
      type: 'dispute_raised',
      messageType: 'dispute_raised',
      text: 'A dispute has been raised for this order.',
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: 'sent',
      senderId: 'system',
      disputeId: dispute.disputeId,
      disputeDetails: {
        disputeId: dispute.disputeId,
        reason: dispute.reason,
        description: dispute.description,
        status: dispute.status,
        raisedBy
      }
    };

    // Save to chat
    await Chat.findOneAndUpdate(
      { chatId },
      { $push: { messages: disputeMessage } },
      { upsert: true }
    );

    // Emit to both parties
    io.to(chatId).emit('message', cleanForEmit(disputeMessage));
    io.to(chatId).emit('disputeRaised', {
      disputeId: dispute.disputeId,
      orderId,
      status: 'open'
    });

    // Emit to admin room
    io.to('admin-room').emit('newDispute', cleanForEmit(dispute));

    socket.emit('disputeRaisedSuccess', {
      disputeId: dispute.disputeId,
      message: 'Dispute raised successfully'
    });

    logSocketAudit('DISPUTE_RAISED', {
      userId,
      runnerId,
      disputeId: dispute.disputeId,
      orderId,
    });

    await notifyDisputeRaised({
      userId: data.userId,
      runnerId: data.runnerId,
      orderId: data.orderId,
      raisedBy: data.raisedBy
    });

    // console.log(`Dispute raised: ${dispute.disputeId}`);

  } catch (error) {
    console.error('Error raising dispute:', error);
    socket.emit('disputeError', { error: error.message });
  }
};

const handleResolveDispute = async (socket, io, data) => {
  const {
    disputeId,
    outcome,
    releasePercentage,
    adminNote,
    resolvedBy
  } = data;

  try {
    const { dispute, amountToUser, amountToRunner } = await disputeService.resolveDispute({
      disputeId,
      outcome,
      releasePercentage,
      adminNote,
      resolvedBy
    });

    const orderDoc = await Order.findOne({ orderId: dispute.orderId }).sort({ createdAt: -1 }).lean();

    if (orderDoc?.escrowId) {
      await Escrow.findByIdAndUpdate(orderDoc.escrowId, {
        status: outcome === 'refund_user' ? 'refunded' : 'released',
        resolvedAt: new Date(),
      });
    }

    const payoutStatus = outcome === 'refund_user' ? 'cancelled' : 'unlocked';
    await RunnerPayout.findOneAndUpdate(
      { orderId: dispute.orderId },
      { status: payoutStatus, unlockedAt: new Date() }
    );

    // Notify parties payout is unlocked (if runner gets something)
    if (outcome !== 'refund_user') {
      io.to(dispute.chatId).emit('payoutUnlocked', {
        chatId: dispute.chatId,
        reason: 'Dispute resolved. Payout has been released.',
      });
    }

    // Send resolution message to chat
    const resolutionMessage = {
      id: `dispute-resolved-${Date.now()}`,
      from: 'system',
      type: 'dispute_resolved',
      messageType: 'dispute_resolved',
      text: 'The dispute has been resolved by admin.',
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: 'sent',
      senderId: 'system',
      disputeId,
      resolutionDetails: {
        outcome,
        amountToUser,
        amountToRunner,
        adminNote,
        isFinal: true
      }
    };

    // Save to chat
    await Chat.findOneAndUpdate(
      { chatId: dispute.chatId },
      { $push: { messages: resolutionMessage } },
      { upsert: true }
    );

    // Notify both parties
    io.to(dispute.chatId).emit('message', cleanForEmit(resolutionMessage));
    io.to(dispute.chatId).emit('disputeResolved', {
      disputeId,
      outcome,
      amountToUser,
      amountToRunner,
      isFinal: true
    });

    socket.emit('disputeResolvedSuccess', { disputeId, outcome });

    logSocketAudit('DISPUTE_RESOLVED', {
      resolvedBy,
      disputeId
    });

    await notifyDisputeResolved({
      userId: dispute.userId,
      runnerId: dispute.runnerId,
      orderId: dispute.orderId,
      outcome
    });

    // console.log(`Dispute resolved: ${disputeId}`);

  } catch (error) {
    console.error('Error resolving dispute:', error);
    socket.emit('disputeError', { error: error.message });
  }
};

module.exports = { handleRaiseDispute, handleResolveDispute };