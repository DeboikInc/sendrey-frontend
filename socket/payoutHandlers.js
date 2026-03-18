/**
 * payoutHandlers.js - Socket handlers for runner payout flow
 */

const { Chat } = require('../models/Chat');
const Order = require('../models/Order');
const RunnerPayout = require('../models/RunnerPayout');
const cloudinary = require('../config/cloudinary');
const logger = require('../utils/logger');
const { logSocketAudit } = require('../utils/socketAudit');
const paymentService = require('../services/paymentServices');

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

    console.log('Looking for payout with chatId:', chatId);
    const allPayouts = await RunnerPayout.find({ runnerId }).lean();
    console.log('All payouts for runner:', allPayouts.map(p => ({ orderId: p.orderId, chatId: p.chatId, itemBudget: p.itemBudget })));

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

    logSocketAudit('GET_RUNNER_PAYOUT', {
      runnerId: data.runnerId,
      chatId: data.chatId,
    });
    logger.info(`getRunnerPayout | chatId=${chatId} | found=${!!payout} | orderId=${payout?.orderId}`);
    socket.emit('runnerPayoutData', { payout: payout || null });
    logger.info(`getRunnerPayout | chatId=${chatId} | found=${!!payout} | orderId=${payout?.orderId} | itemBudget=${payout?.itemBudget} | usedPayoutSystem=${payout?.usedPayoutSystem}`);

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
    const result = await paymentService.submitPayoutReceipt({
      orderId: data.orderId,
      runnerId: data.runnerId,
      userId: data.userId,
      chatId: data.chatId,
      vendorName: data.vendorName,
      amountSpent: data.amountSpent,
      changeAmount: data.changeAmount,
      bankName: data.bankName,
      accountNumber: data.accountNumber,
      accountName: data.accountName,
      receiptBase64: data.receiptBase64,
    });

    socket.emit('payoutReceiptSuccess', {
      submissionId: `payout-receipt-${Date.now()}`,
      status: 'submitted',
      usedPayoutSystem: true,
      receiptUrl: result.receiptUrl,
      message: 'Receipt saved.',
    });

    // Notify runner's room so RunnerChatScreen can update currentOrder
    io.to(`runner-${data.runnerId}`).emit('payoutReceiptSubmitted', {
      orderId: data.orderId,
      usedPayoutSystem: true,
    });

  } catch (err) {
    logger.error('handleSubmitPayoutReceipt error:', err);
    socket.emit('error', { message: err.message || 'Failed to submit receipt' });
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