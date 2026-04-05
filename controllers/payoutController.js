const BaseController = require('./baseController');
const RunnerPayout = require('../models/RunnerPayout');
const Order = require('../models/Order');
const cloudinary = require('../config/cloudinary');
const logger = require('../utils/logger');
const pinService = require('../services/pinService');
const paymentService = require('../services/paymentServices');
const { withTransaction } = require('../utils/withTransaction');
const Wallet = require('../models/Wallet');
const LedgerEntry = require('../models/LedgerEntry');

const uploadToCloudinary = (base64String, folder = 'payout-receipts') =>
  new Promise((resolve, reject) => {
    cloudinary.uploader.upload(
      base64String,
      { folder, resource_type: 'image' },
      (err, result) => (err ? reject(err) : resolve(result))
    );
  });

class PayoutController extends BaseController {
  constructor() {
    super(null);
    this.getRunnerPayout = this.getRunnerPayout.bind(this);
    this.getPayoutHistory = this.getPayoutHistory.bind(this);
    this.getRunnerReceipts = this.getRunnerReceipts.bind(this);
    this.submitReceipt = this.submitReceipt.bind(this);
    this.transferToVendor = this.transferToVendor.bind(this);
    this.adminGetAllReceipts = this.adminGetAllReceipts.bind(this);
    this.adminReviewReceipt = this.adminReviewReceipt.bind(this);
    this.adminPayoutStats = this.adminPayoutStats.bind(this);
  }

  // GET /payouts/current?chatId=...
  async getRunnerPayout(req, res) {
    try {
      const { chatId, orderId } = req.query;
      const runnerId = req.user.id;

      if (!chatId && !orderId) return this.badRequest(res, 'chatId or orderId required');

      const order = chatId
        ? await Order.findOne({ chatId })
        : await Order.findOne({ orderId });

      if (!order) return this.success(res, { payout: null });

      const payout = await RunnerPayout.findOne({ orderId: order.orderId, runnerId }).lean();
      return this.success(res, { payout });
    } catch (err) {
      logger.error('getRunnerPayout error:', err);
      return this.error(res, err.message);
    }
  }

  // GET /payouts/history
  async getPayoutHistory(req, res) {
    try {
      const runnerId = req.user.id;
      const { page = 1, limit = 20 } = req.query;
      const skip = (page - 1) * limit;

      const [payouts, total] = await Promise.all([
        RunnerPayout.find({ runnerId }).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
        RunnerPayout.countDocuments({ runnerId }),
      ]);

      return this.success(res, { payouts, total, page: parseInt(page), limit: parseInt(limit) });
    } catch (err) {
      logger.error('getPayoutHistory error:', err);
      return this.error(res, err.message);
    }
  }

  // GET /payouts/receipts
  async getRunnerReceipts(req, res) {
    try {
      const runnerId = req.user.id;

      const payouts = await RunnerPayout.find({
        runnerId,
        'receiptHistory.0': { $exists: true },
      })
        .select('orderId chatId vendorName amountSpent status receiptHistory createdAt')
        .sort({ createdAt: -1 })
        .lean();

      const receipts = payouts.flatMap(p =>
        p.receiptHistory.map(r => ({
          ...r,
          orderId: p.orderId,
          chatId: p.chatId,
          payoutStatus: p.status,
        }))
      );

      return this.success(res, { receipts, total: receipts.length });
    } catch (err) {
      logger.error('getRunnerReceipts error:', err);
      return this.error(res, err.message);
    }
  }

  // POST /payouts/submit-receipt
  async submitReceipt(req, res) {
    try {
      const runnerId = req.user.id;
      const { chatId, vendorName, amountSpent, changeAmount, bankName, accountNumber, accountName, receiptBase64 } = req.body;

      if (!chatId) return this.badRequest(res, 'chatId required');

      const order = await Order.findOne({ chatId });
      if (!order) return this.notFound(res, 'Order not found');

      const payout = await RunnerPayout.findOne({ orderId: order.orderId, runnerId });
      if (!payout) return this.notFound(res, 'Payout record not found');

      let receiptUrl = null;
      if (receiptBase64) {
        const uploaded = await uploadToCloudinary(receiptBase64, 'payout-receipts');
        receiptUrl = uploaded.secure_url;
      }

      const receiptEntry = {
        receiptUrl,
        vendorName,
        amountSpent: parseFloat(amountSpent) || 0,
        changeAmount: changeAmount != null ? parseFloat(changeAmount) : (payout.itemBudget - parseFloat(amountSpent || 0)),
        submittedAt: new Date(),
        status: 'pending',
      };

      payout.receiptHistory.push(receiptEntry);
      payout.vendorName = vendorName;
      payout.amountSpent = parseFloat(amountSpent) || 0;
      payout.changeAmount = receiptEntry.changeAmount;
      payout.receiptUrl = receiptUrl;
      payout.usedPayoutSystem = true;
      payout.status = 'submitted';
      payout.submittedAt = new Date();

      if (bankName || accountNumber || accountName) {
        payout.bankDetails = { bankName, accountNumber, accountName };
      }

      await payout.save();
      logger.info(`Receipt submitted: runner=${runnerId} order=${order.orderId} amount=₦${amountSpent}`);

      return this.success(res, {
        payoutId: payout._id,
        status: payout.status,
        receiptUrl,
        usedPayoutSystem: payout.usedPayoutSystem,
      }, 'Receipt submitted successfully');
    } catch (err) {
      logger.error('submitReceipt error:', err);
      return this.error(res, err.message);
    }
  }

  // POST /payouts/transfer-to-vendor
  async transferToVendor(req, res) {
    try {
      const {
        orderId, vendorName, amountSpent, changeAmount,
        bankName, accountNumber, accountName, pin,
      } = req.body;

      if (!orderId) return this.badRequest(res, 'orderId is required');
      if (!vendorName || !amountSpent) return this.badRequest(res, 'vendorName and amountSpent are required');
      if (!bankName || !accountNumber || !accountName) return this.badRequest(res, 'Bank details are required');
      if (!pin) return this.badRequest(res, 'PIN is required to authorise transfer');

      // Verify PIN 
      const { valid } = await pinService.verifyPin({ userId: req.user._id, role: req.user.role, pin });
      if (!valid) return this.error(res, 'Incorrect PIN', 401);

      const spent = parseFloat(amountSpent);
      const change = changeAmount != null ? parseFloat(changeAmount) : 0;

      // Atomic claim — prevent double submission
      const claimed = await RunnerPayout.findOneAndUpdate(
        { orderId, status: 'pending' },
        { $set: { status: 'processing' } },
        { new: true }
      );
      if (!claimed) return this.error(res, 'Transfer already submitted or currently processing', 409);

      if (spent > claimed.itemBudget) {
        await RunnerPayout.findOneAndUpdate({ orderId }, { $set: { status: 'pending' } });
        return this.badRequest(res, `Amount ₦${spent} exceeds budget ₦${claimed.itemBudget}`);
      }

      // ── 3. Deduct from user's locked wallet balance ───────────────────────────
      // The item budget is sitting in the user's lockedBalance since payment.
      // We deduct it here — money leaves their wallet when the runner spends it.

      const order = await Order.findOne({ orderId }).lean();
      if (!order) {
        await RunnerPayout.findOneAndUpdate({ orderId }, { $set: { status: 'pending' } });
        return this.notFound(res, 'Order not found');
      }

      try {
        await withTransaction(async (session) => {
          const userWallet = await Wallet.findOne({ userId: order.userId }).session(session);
          if (!userWallet) throw new Error('User wallet not found');
          if (userWallet.lockedBalance < spent) throw new Error('Insufficient locked balance');

          userWallet.lockedBalance -= spent;
          await userWallet.save({ session });

          await LedgerEntry.create([{
            userId: order.userId,
            userModel: 'User',
            runnerId: order.runnerId,
            type: 'item_budget_spent',
            grossAmount: spent,
            netAmount: spent,
            providerFee: 0,
            provider: 'paystack',
            orderId,
            description: `Item budget spent at ${vendorName} for order ${orderId}`,
            status: 'completed',
          }], { session });
        });
      } catch (walletErr) {
        await RunnerPayout.findOneAndUpdate({ orderId }, { $set: { status: 'pending' } });
        logger.error('transferToVendor wallet deduction failed:', walletErr);
        return this.error(res, walletErr.message || 'Wallet deduction failed');
      }

      // transfer to vendor
      const transferResult = await paymentService.transferToVendor({
        amount: spent,
        bankName,
        accountNumber,
        accountName,
        vendorName,
        orderId,
        runnerId: order.runnerId,
      });

      if (!transferResult.success) {
        // Roll back wallet deduction — refund lockedBalance
        await withTransaction(async (session) => {
          const userWallet = await Wallet.findOne({ userId: order.userId }).session(session);
          if (userWallet) {
            userWallet.lockedBalance += spent;
            await userWallet.save({ session });
          }

          // Also reverse the ledger entry
          await LedgerEntry.deleteOne({
            orderId,
            type: 'item_budget_spent',
            userId: order.userId
          }).session(session);
        });


        await RunnerPayout.findOneAndUpdate({ orderId }, { $set: { status: 'pending' } });
        return this.error(res, transferResult.error || 'Transfer to vendor failed');
      }

      // Persist to RunnerPayout
      const payout = await RunnerPayout.findOneAndUpdate(
        { orderId },
        {
          $set: {
            vendorName, amountSpent: spent, changeAmount: change,
            status: 'submitted', submittedAt: new Date(),
            usedPayoutSystem: true,
            bankDetails: { bankName, accountNumber, accountName },
            transferReference: transferResult.reference,
            transferId: transferResult.transferId,
          },
          $push: {
            receiptHistory: {
              vendorName, amountSpent: spent, changeAmount: change,
              submittedAt: new Date(), status: 'pending',
              bankDetails: { bankName, accountNumber, accountName },
              transferReference: transferResult.reference,
              transferId: transferResult.transferId,
            },
          },
        },
        { new: true }
      );

      const newReceipt = payout.receiptHistory[payout.receiptHistory.length - 1];

      logger.info(`transferToVendor | orderId=${orderId} | vendor=${vendorName} | amount=₦${spent} | ref=${transferResult.reference}`);

      return this.success(res, {
        orderId: payout.orderId,
        status: payout.status,
        usedPayoutSystem: payout.usedPayoutSystem,
        vendorName: payout.vendorName,
        amountSpent: payout.amountSpent,
        changeAmount: payout.changeAmount,
        transferReference: transferResult.reference,
        receiptId: newReceipt._id,
      }, 'Transfer submitted successfully');

    } catch (err) {
      logger.error('transferToVendor error:', err);
      return this.error(res, err.message);
    }
  }

  // ── Admin ──────────────────────────────────────────────────────────────────

  // GET /admin/payouts/receipts
  async adminGetAllReceipts(req, res) {
    try {
      const { status, runnerId, page = 1, limit = 20 } = req.query;
      const skip = (page - 1) * limit;

      const query = { 'receiptHistory.0': { $exists: true } };
      if (status) query['receiptHistory.status'] = status;
      if (runnerId) query.runnerId = runnerId;

      const [payouts, total] = await Promise.all([
        RunnerPayout.find(query)
          .populate('runnerId', 'firstName lastName phone email avatar')
          .populate('userId', 'firstName lastName phone')
          .sort({ updatedAt: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        RunnerPayout.countDocuments(query),
      ]);

      const receipts = payouts.flatMap(p =>
        p.receiptHistory.map(r => ({
          receiptId: r._id,
          receiptUrl: r.receiptUrl,
          vendorName: r.vendorName || p.vendorName,
          amountSpent: r.amountSpent || p.amountSpent,
          changeAmount: r.changeAmount || p.changeAmount,
          status: r.status,
          submittedAt: r.submittedAt,
          reviewedAt: r.reviewedAt,
          rejectionReason: r.rejectionReason,
          orderId: p.orderId,
          chatId: p.chatId,
          itemBudget: p.itemBudget,
          payoutStatus: p.status,
          runner: p.runnerId,
          user: p.userId,
          bankDetails: p.bankDetails,
        }))
      );

      return this.success(res, { receipts, total, page: parseInt(page), limit: parseInt(limit) });
    } catch (err) {
      logger.error('adminGetAllReceipts error:', err);
      return this.error(res, err.message);
    }
  }

  // PATCH /admin/payouts/:payoutId/receipt/:receiptId
  async adminReviewReceipt(req, res) {
    try {
      const { payoutId, receiptId } = req.params;
      const { action, rejectionReason } = req.body;
      const adminId = req.user.id;

      if (!['approve', 'reject'].includes(action)) {
        return this.badRequest(res, 'action must be approve or reject');
      }

      const payout = await RunnerPayout.findById(payoutId);
      if (!payout) return this.notFound(res, 'Payout not found');

      const receipt = payout.receiptHistory.id(receiptId);
      if (!receipt) return this.notFound(res, 'Receipt not found');

      receipt.status = action === 'approve' ? 'approved' : 'rejected';
      receipt.reviewedAt = new Date();
      receipt.reviewedBy = adminId;
      if (action === 'reject') receipt.rejectionReason = rejectionReason || 'Rejected by admin';

      if (action === 'approve') {
        payout.status = 'approved';
        payout.approvedAt = new Date();
      }

      await payout.save();
      logger.info(`Admin ${action}d receipt ${receiptId} for payout ${payoutId}`);

      return this.success(res, { receipt, payoutStatus: payout.status }, `Receipt ${action}d successfully`);
    } catch (err) {
      logger.error('adminReviewReceipt error:', err);
      return this.error(res, err.message);
    }
  }

  // GET /admin/payouts/stats
  async adminPayoutStats(req, res) {
    try {
      const [total, pending, submitted, approved, rejected] = await Promise.all([
        RunnerPayout.countDocuments(),
        RunnerPayout.countDocuments({ status: 'pending' }),
        RunnerPayout.countDocuments({ status: 'submitted' }),
        RunnerPayout.countDocuments({ status: 'approved' }),
        RunnerPayout.countDocuments({ status: 'rejected' }),
      ]);

      const [budgetResult] = await RunnerPayout.aggregate([
        { $group: { _id: null, total: { $sum: '$itemBudget' }, spent: { $sum: '$amountSpent' } } }
      ]);

      const totals = budgetResult || { total: 0, spent: 0 };

      return this.success(res, {
        counts: { total, pending, submitted, approved, rejected },
        amounts: {
          totalBudgetAllocated: totals.total,
          totalAmountSpent: totals.spent,
          totalChange: totals.total - totals.spent,
        },
      });
    } catch (err) {
      logger.error('adminPayoutStats error:', err);
      return this.error(res, err.message);
    }
  }
}

module.exports = new PayoutController();