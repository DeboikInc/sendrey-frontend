const RunnerPayout = require('../models/RunnerPayout');
const Order = require('../models/Order');
const { Chat } = require('../models/Chat');
const cloudinary = require('../config/cloudinary');
const paystackService = require('./paystackService'); // or flutterwave
const logger = require('../utils/logger');

const uploadReceipt = (base64String) =>
  new Promise((resolve, reject) => {
    cloudinary.uploader.upload(
      base64String,
      { folder: 'payout-receipts', resource_type: 'image' },
      (err, result) => (err ? reject(err) : resolve(result.secure_url))
    );
  });

const transferToVendorBank = async ({ amount, bankName, accountNumber, accountName, vendorName, orderId, runnerId }) => {
  try {
    // Use your payment provider (Paystack, Flutterwave, etc.)
    const transfer = await paystackService.initiateTransfer({
      amount: amount * 100, // Convert to kobo
      recipient: {
        type: 'nuban',
        name: accountName,
        account_number: accountNumber,
        bank_code: await paystackService.getBankCode(bankName),
        currency: 'NGN',
      },
      reason: `Payment for items from ${vendorName} - Order ${orderId}`,
      reference: `payout-${orderId}-${Date.now()}`,
    });

    if (transfer.status === 'success' || transfer.status === 'pending') {
      return {
        success: true,
        reference: transfer.reference,
        transferId: transfer.id,
      };
    }

    return {
      success: false,
      error: transfer.message || 'Transfer initiation failed',
    };

  } catch (error) {
    logger.error('transferToVendorBank error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

const submitReceipt = async ({
  orderId, runnerId, vendorName, amountSpent, changeAmount,
  receiptUrl, bankDetails, transferReference
}) => {
  const receiptEntry = {
    receiptUrl,
    vendorName,
    amountSpent,
    changeAmount,
    submittedAt: new Date(),
    status: 'pending',
    transferReference,
  };

  const payout = await RunnerPayout.findOneAndUpdate(
    { orderId, runnerId },
    {
      $set: {
        vendorName,
        amountSpent,
        changeAmount,
        receiptUrl,
        status: 'submitted',
        submittedAt: new Date(),
        usedPayoutSystem: true,
        bankDetails,
        transferReference,
      },
      $push: { receiptHistory: receiptEntry },
    },
    { new: true }
  );

  return payout;
};

const notifyUserOfReceipt = async ({ chatId, userId, orderId, vendorName, amountSpent, receiptUrl }) => {
  const io = require('../socket').getIO(); // Get socket.io instance
  
  const submissionId = `payout-receipt-${Date.now()}`;
  const message = {
    id: submissionId,
    type: 'item_submission',
    messageType: 'item_submission',
    senderId: 'system',
    senderType: 'system',
    chatId,
    submissionId,
    items: [{
      name: `Shopping at ${vendorName}`,
      quantity: 1,
      price: amountSpent,
    }],
    receiptUrl,
    totalAmount: amountSpent,
    vendorName,
    status: 'pending',
    time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
    createdAt: new Date(),
  };

  // Save to chat
  const chat = await Chat.findOne({ chatId });
  if (chat) {
    chat.messages.push(message);
    await chat.save();
  }

  // Emit to chat room and user
  io.to(chatId).emit('message', message);
  io.to(`user-${userId}`).emit('payoutReceiptSubmitted', {
    orderId,
    vendorName,
    amountSpent,
    receiptUrl,
    submissionId,
  });
};

const getPayoutByOrderId = async (orderId) => {
  return await RunnerPayout.findOne({ orderId }).lean();
};

module.exports = {
  uploadReceipt,
  transferToVendorBank,
  submitReceipt,
  notifyUserOfReceipt,
  getPayoutByOrderId,
};