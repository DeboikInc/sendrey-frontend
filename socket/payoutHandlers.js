/**
 * payoutHandlers.js - Socket handlers for runner payout flow
 */

const { Chat } = require('../models/Chat');
const Order = require('../models/Order');
const RunnerPayout = require('../models/RunnerPayout');
const cloudinary = require('../config/cloudinary');
const logger = require('../utils/logger');

const uploadToCloudinary = (base64String, folder = 'payout-receipts') =>
  new Promise((resolve, reject) => {
    cloudinary.uploader.upload(
      base64String,
      { folder, resource_type: 'image' },
      (err, result) => (err ? reject(err) : resolve(result))
    );
  });

/**
 * Runner fetches their payout record
 * Queries by chatId on RunnerPayout directly (not via Order lookup)
 * — avoids Order.chatId field mismatch issues
 */
const handleGetRunnerPayout = async (socket, io, data) => {
  try {
    const { chatId, runnerId } = data;

    if (!chatId) return socket.emit('runnerPayoutData', { payout: null });

    // Query RunnerPayout directly by chatId — created in handlePaymentSuccess
    let payout = await RunnerPayout.findOne({ chatId }).lean();

    // Fallback: try via Order lookup in case chatId is stored on Order differently
    if (!payout) {
      const order = await Order.findOne({
        $or: [
          { chatId },
          { chatId: chatId.replace(/^chat-/, '') }, // strip prefix if any
        ]
      });
      if (order) {
        payout = await RunnerPayout.findOne({ orderId: order.orderId }).lean();
      }
    }

    logger.info(`getRunnerPayout | chatId=${chatId} | found=${!!payout} | orderId=${payout?.orderId}`);
    socket.emit('runnerPayoutData', { payout: payout || null });

  } catch (err) {
    logger.error('handleGetRunnerPayout error:', err);
    socket.emit('error', { message: 'Failed to fetch payout data' });
  }
};

/**
 * Runner submits receipt after shopping
 * Sets usedPayoutSystem = true → unlocks runner fee at task_completed
 */
const handleSubmitPayoutReceipt = async (socket, io, data) => {
  try {
    const {
      chatId, runnerId, userId, orderId,
      vendorName, amountSpent, changeAmount,
      bankName, accountNumber, accountName,
      receiptBase64, items = [],
    } = data;

    // Upload receipt image
    let receiptUrl = null;
    if (receiptBase64) {
      const uploaded = await uploadToCloudinary(receiptBase64, 'payout-receipts');
      receiptUrl = uploaded.secure_url;
      logger.info(`Receipt uploaded: ${receiptUrl}`);
    }

    const spentAmount = parseFloat(amountSpent) || 0;
    const changeAmt = changeAmount != null ? parseFloat(changeAmount) : 0;

    const receiptEntry = {
      receiptUrl, vendorName,
      amountSpent: spentAmount,
      changeAmount: changeAmt,
      submittedAt: new Date(),
      status: 'pending',
    };

    // Find payout by orderId or chatId
    const query = orderId ? { orderId } : { chatId };
    const payout = await RunnerPayout.findOneAndUpdate(
      query,
      {
        $set: {
          vendorName,
          amountSpent: spentAmount,
          changeAmount: changeAmt,
          receiptUrl,
          status: 'submitted',
          submittedAt: new Date(),
          usedPayoutSystem: true, // ← runner fee unlocked
          ...(bankName && { bankDetails: { bankName, accountNumber, accountName } }),
        },
        $push: { receiptHistory: receiptEntry },
      },
      { new: true }
    );

    if (!payout) {
      logger.error(`submitPayoutReceipt: payout not found | orderId=${orderId} | chatId=${chatId}`);
      return socket.emit('error', { message: 'Payout record not found' });
    }

    // Build item_submission message so user sees it in chat
    const submissionId = `payout-receipt-${Date.now()}`;
    const message = {
      id: submissionId,
      type: 'item_submission',
      messageType: 'item_submission',
      senderId: runnerId,
      senderType: 'runner',
      chatId,
      submissionId,
      escrowId: payout.escrowId?.toString() || null,
      items: items.length > 0 ? items : [{
        name: `Shopping at ${vendorName}`,
        quantity: 1,
        price: spentAmount,
        note: changeAmt > 0 ? `₦${changeAmt.toLocaleString()} change to be returned` : undefined,
      }],
      receiptUrl,
      totalAmount: spentAmount,
      vendorName,
      changeAmount: changeAmt,
      bankDetails: payout.bankDetails,
      status: 'pending',
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
      createdAt: new Date(),
    };

    const chat = await Chat.findOne({ chatId });
    if (chat) { chat.messages.push(message); await chat.save(); }

    io.to(chatId).emit('message', message);
    io.to(`user-${userId}`).emit('payoutReceiptSubmitted', {
      orderId: payout.orderId, vendorName, amountSpent: spentAmount, receiptUrl, submissionId,
    });

    socket.emit('payoutReceiptSuccess', {
      submissionId,
      status: 'submitted',
      usedPayoutSystem: true,
      receiptUrl,
      message: 'Receipt submitted. Waiting for user approval.',
    });

    logger.info(`Payout receipt submitted | orderId=${payout.orderId} | runner=${runnerId} | amount=₦${spentAmount}`);

  } catch (err) {
    logger.error('handleSubmitPayoutReceipt error:', err);
    socket.emit('error', { message: 'Failed to submit receipt' });
  }
};

/**
 * Called from handleApproveItems after user approves
 */
const handlePayoutApproved = async (orderId) => {
  try {
    const payout = await RunnerPayout.findOneAndUpdate(
      { orderId },
      { $set: { status: 'approved', approvedAt: new Date() } },
      { new: true }
    );
    if (payout) logger.info(`RunnerPayout approved | orderId=${orderId} | usedPayoutSystem=${payout.usedPayoutSystem}`);
  } catch (err) {
    logger.error('handlePayoutApproved error:', err);
  }
};

module.exports = { handleGetRunnerPayout, handleSubmitPayoutReceipt, handlePayoutApproved };