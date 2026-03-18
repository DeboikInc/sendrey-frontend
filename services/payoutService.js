const RunnerPayout = require('../models/RunnerPayout');
const Order = require('../models/Order');
const { Chat } = require('../models/Chat');
const cloudinary = require('../config/cloudinary');
const paystackService = require('./paystackService');
const logger = require('../utils/logger');
const { withTransaction } = require('../utils/withTransaction');

const uploadReceipt = (base64String) =>
  new Promise((resolve, reject) => {
    cloudinary.uploader.upload(
      base64String,
      { folder: 'payout-receipts', resource_type: 'image' },
      (err, result) => (err ? reject(err) : resolve(result.secure_url))
    );
  });

const transferToVendorBank = async ({ amount, bankName, accountNumber, accountName, vendorName, orderId }) => {
  try {
    const transfer = await paystackService.initiateTransfer({
      amount: amount * 100, // kobo
      recipient: {
        type: 'nuban',
        name: accountName,
        account_number: accountNumber,
        bank_code: await paystackService.getBankCode(bankName),
        currency: 'NGN',
      },
      reason: `Payment for items from ${vendorName} - Order ${orderId}`,
      reference: `payout-${orderId}`, //  Paystack deduplicates on this
    });

    if (transfer.status === 'success' || transfer.status === 'pending') {
      return { success: true, reference: transfer.reference, transferId: transfer.id };
    }

    return { success: false, error: transfer.message || 'Transfer initiation failed' };
  } catch (error) {
    logger.error('transferToVendorBank error:', error);
    return { success: false, error: error.message };
  }
};

const submitReceipt = async ({
  orderId, runnerId, vendorName, amountSpent, changeAmount,
  receiptBase64, bankDetails, chatId, userId,
}) => {

  // ── Step 1: Atomic claim ───────────────────────────────────────────────────
  // Flips status from 'pending' → 'processing' in a single atomic write.
  // If two requests race, only ONE gets a non-null result — the other throws here.
  const claimed = await RunnerPayout.findOneAndUpdate(
    { orderId, runnerId, status: 'pending' },
    { $set: { status: 'processing' } },
    { new: true }
  );

  if (!claimed) {
    throw new Error('Payout already submitted or currently being processed');
  }

  // Budget check using the claimed document — no extra DB read needed
  if (amountSpent > claimed.itemBudget) {
    // Release the lock before throwing
    await RunnerPayout.findOneAndUpdate(
      { orderId, runnerId },
      { $set: { status: 'pending' } }
    );
    throw new Error(`Amount spent (₦${amountSpent}) exceeds budget (₦${claimed.itemBudget})`);
  }

  // ── Step 2: External calls ─────────────────────────────────────────────────
  // Cloudinary + Paystack are outside the transaction intentionally —
  // MongoDB cannot roll back external API calls.
  // If either fails, we release the 'processing' lock so the runner can retry.
  let receiptUrl, transferResult;
  try {
    receiptUrl = await uploadReceipt(receiptBase64);

    transferResult = await transferToVendorBank({
      amount: amountSpent,
      bankName: bankDetails.bankName,
      accountNumber: bankDetails.accountNumber,
      accountName: bankDetails.accountName,
      vendorName,
      orderId,
      runnerId,
    });

    if (!transferResult.success) {
      throw new Error(transferResult.error || 'Transfer to vendor failed');
    }
  } catch (error) {
    // Release the lock — runner can try again
    await RunnerPayout.findOneAndUpdate(
      { orderId, runnerId },
      { $set: { status: 'pending' } }
    );
    throw error;
  }

  // safe refernce to db
  await RunnerPayout.findOneAndUpdate(
    { orderId, runnerId },
    {
      $set: {
        transferReference: transferResult.reference,
        transferId: transferResult.transferId
      }
    }
  );

  // ── Step 3: Atomic DB writes ───────────────────────────────────────────────
  // Both the payout update and receipt history push happen together.
  // If the save fails, neither is committed.
  return withTransaction(async (session) => {
    const receiptEntry = {
      receiptUrl,
      vendorName,
      amountSpent,
      changeAmount,
      submittedAt: new Date(),
      status: 'pending',
      transferReference: transferResult.reference,
      transferId: transferResult.transferId,
    };

    const updatedPayout = await RunnerPayout.findOneAndUpdate(
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
          transferReference: transferResult.reference,
          transferStatus: transferResult.status,
        },
        $push: { receiptHistory: receiptEntry },
      },
      { new: true, session }
    );

    if (!updatedPayout) throw new Error('Failed to update payout record');

    // Non-critical — socket failure should never fail the payout
    await notifyUserOfReceipt({
      chatId, userId, orderId, vendorName, amountSpent, receiptUrl,
    }).catch((err) => logger.error('notifyUserOfReceipt failed (non-critical):', err.message));

    logger.info(`✅ Payout receipt submitted: order=${orderId} vendor=${vendorName} amount=₦${amountSpent} ref=${transferResult.reference}`);

    return {
      success: true,
      payout: updatedPayout,
      transferReference: transferResult.reference,
      receiptUrl,
    };
  });
};

const notifyUserOfReceipt = async ({ chatId, userId, orderId, vendorName, amountSpent, receiptUrl }) => {
  const io = require('../socket').getIO();

  const submissionId = `payout-receipt-${Date.now()}`;
  const message = {
    id: submissionId,
    type: 'item_submission',
    messageType: 'item_submission',
    senderId: 'system',
    senderType: 'system',
    chatId,
    submissionId,
    items: [{ name: `Shopping at ${vendorName}`, quantity: 1, price: amountSpent }],
    receiptUrl,
    totalAmount: amountSpent,
    vendorName,
    status: 'pending',
    time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
    createdAt: new Date(),
  };

  await withTransaction(async (session) => {
    const chat = await Chat.findOne({ chatId }).session(session);
    if (chat) {
      chat.messages.push(message);
      await chat.save({ session });
    }
  });

  if (io) {
    io.to(chatId).emit('message', message);
    io.to(`user-${userId}`).emit('payoutReceiptSubmitted', {
      orderId, vendorName, amountSpent, receiptUrl, submissionId,
    });
  }
};

const getPayoutByOrderId = async (orderId) => {
  return RunnerPayout.findOne({ orderId }).lean();
};

module.exports = {
  uploadReceipt,
  transferToVendorBank,
  submitReceipt,
  notifyUserOfReceipt,
  getPayoutByOrderId,
};