/**
 * payoutController.js
 * REST endpoints for runner payout system
 * Socket handlers handle real-time flow (getRunnerPayout, submitPayoutReceipt)
 * HTTP endpoints handle: history, admin views, status updates
 */

const RunnerPayout = require('../models/RunnerPayout');
const Order = require('../models/Order');
const Runner = require('../models/Runner');
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

// ─── RUNNER ENDPOINTS ─────────────────────────────────────────────────────────

/**
 * GET /payout/current
 * Runner gets their active payout for current chat
 * Query: ?chatId=...
 */
exports.getRunnerPayout = async (req, res) => {
  try {
    const { chatId } = req.query;
    const runnerId = req.user.id;

    if (!chatId) return res.status(400).json({ success: false, message: 'chatId required' });

    const order = await Order.findOne({ chatId });
    if (!order) return res.status(200).json({ success: true, data: { payout: null } });

    const payout = await RunnerPayout.findOne({
      orderId: order.orderId,
      runnerId,
    }).lean();

    return res.status(200).json({ success: true, data: { payout } });
  } catch (err) {
    logger.error('getRunnerPayout error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /payout/history
 * Runner gets all their payout records (history across all orders)
 */
exports.getPayoutHistory = async (req, res) => {
  try {
    const runnerId = req.user.id;
    const { page = 1, limit = 20 } = req.query;

    const skip = (page - 1) * limit;

    const [payouts, total] = await Promise.all([
      RunnerPayout.find({ runnerId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      RunnerPayout.countDocuments({ runnerId }),
    ]);

    return res.status(200).json({
      success: true,
      data: { payouts, total, page: parseInt(page), limit: parseInt(limit) }
    });
  } catch (err) {
    logger.error('getPayoutHistory error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /payout/receipts
 * Runner gets all their submitted receipts
 */
exports.getRunnerReceipts = async (req, res) => {
  try {
    const runnerId = req.user.id;

    const payouts = await RunnerPayout.find({
      runnerId,
      'receiptHistory.0': { $exists: true }, // only payouts that have receipts
    })
      .select('orderId chatId vendorName amountSpent status receiptHistory createdAt')
      .sort({ createdAt: -1 })
      .lean();

    // Flatten into individual receipt records
    const receipts = payouts.flatMap(p =>
      p.receiptHistory.map(r => ({
        ...r,
        orderId: p.orderId,
        chatId: p.chatId,
        payoutStatus: p.status,
      }))
    );

    return res.status(200).json({ success: true, data: { receipts, total: receipts.length } });
  } catch (err) {
    logger.error('getRunnerReceipts error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /payout/submit-receipt
 * HTTP version of submitPayoutReceipt socket handler
 * Runner submits receipt after shopping
 * Body: { chatId, vendorName, amountSpent, bankName, accountNumber, accountName, receiptBase64 }
 */
exports.submitReceipt = async (req, res) => {
  try {
    const runnerId = req.user.id;
    const {
      chatId,
      vendorName,
      amountSpent,
      changeAmount,
      bankName,
      accountNumber,
      accountName,
      receiptBase64,
    } = req.body;

    if (!chatId) return res.status(400).json({ success: false, message: 'chatId required' });

    const order = await Order.findOne({ chatId });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    const payout = await RunnerPayout.findOne({ orderId: order.orderId, runnerId });
    if (!payout) return res.status(404).json({ success: false, message: 'Payout record not found' });

    // Upload receipt to Cloudinary
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

    // Push to receiptHistory + update root fields
    payout.receiptHistory.push(receiptEntry);
    payout.vendorName = vendorName;
    payout.amountSpent = parseFloat(amountSpent) || 0;
    payout.changeAmount = receiptEntry.changeAmount;
    payout.receiptUrl = receiptUrl;
    payout.usedPayoutSystem = true; // ← runner fee unlocked
    payout.status = 'submitted';
    payout.submittedAt = new Date();

    if (bankName || accountNumber || accountName) {
      payout.bankDetails = { bankName, accountNumber, accountName };
    }

    await payout.save();

    // Save receipt to admin log (PlatformEarnings-style record kept separately)
    // Admin can view via GET /admin/payout/receipts
    logger.info(`Payout receipt submitted: runner=${runnerId} order=${order.orderId} amount=₦${amountSpent}`);

    return res.status(200).json({
      success: true,
      message: 'Receipt submitted successfully',
      data: {
        payoutId: payout._id,
        status: payout.status,
        receiptUrl,
        usedPayoutSystem: payout.usedPayoutSystem,
      }
    });
  } catch (err) {
    logger.error('submitReceipt error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── ADMIN ENDPOINTS ──────────────────────────────────────────────────────────

/**
 * GET /admin/payout/receipts
 * Admin views all submitted receipts across all runners
 * Query: ?status=pending&page=1&limit=20&runnerId=...
 */
exports.adminGetAllReceipts = async (req, res) => {
  try {
    const { status, runnerId, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const query = { 'receiptHistory.0': { $exists: true } };
    if (status) query['receiptHistory.status'] = status;
    if (runnerId) query.runnerId = runnerId;

    const payouts = await RunnerPayout.find(query)
      .populate('runnerId', 'firstName lastName phone email avatar')
      .populate('userId', 'firstName lastName phone')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await RunnerPayout.countDocuments(query);

    // Flatten receipts with parent payout context
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

    return res.status(200).json({
      success: true,
      data: { receipts, total, page: parseInt(page), limit: parseInt(limit) }
    });
  } catch (err) {
    logger.error('adminGetAllReceipts error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * PATCH /admin/payout/receipts/:payoutId/receipt/:receiptId
 * Admin approves or rejects a specific receipt
 * Body: { action: 'approve' | 'reject', rejectionReason? }
 */
exports.adminReviewReceipt = async (req, res) => {
  try {
    const { payoutId, receiptId } = req.params;
    const { action, rejectionReason } = req.body;
    const adminId = req.user.id;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'action must be approve or reject' });
    }

    const payout = await RunnerPayout.findById(payoutId);
    if (!payout) return res.status(404).json({ success: false, message: 'Payout not found' });

    const receipt = payout.receiptHistory.id(receiptId);
    if (!receipt) return res.status(404).json({ success: false, message: 'Receipt not found' });

    receipt.status = action === 'approve' ? 'approved' : 'rejected';
    receipt.reviewedAt = new Date();
    receipt.reviewedBy = adminId;
    if (action === 'reject') receipt.rejectionReason = rejectionReason || 'Rejected by admin';

    // If approved, update root payout status too
    if (action === 'approve') {
      payout.status = 'approved';
      payout.approvedAt = new Date();
    }

    await payout.save();

    logger.info(`Admin ${action}d receipt ${receiptId} for payout ${payoutId}`);

    return res.status(200).json({
      success: true,
      message: `Receipt ${action}d successfully`,
      data: { receipt, payoutStatus: payout.status }
    });
  } catch (err) {
    logger.error('adminReviewReceipt error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /admin/payout/stats
 * Admin gets payout summary stats
 */
exports.adminPayoutStats = async (req, res) => {
  try {
    const [total, pending, submitted, approved, rejected] = await Promise.all([
      RunnerPayout.countDocuments(),
      RunnerPayout.countDocuments({ status: 'pending' }),
      RunnerPayout.countDocuments({ status: 'submitted' }),
      RunnerPayout.countDocuments({ status: 'approved' }),
      RunnerPayout.countDocuments({ status: 'rejected' }),
    ]);

    const totalBudgetResult = await RunnerPayout.aggregate([
      { $group: { _id: null, total: { $sum: '$itemBudget' }, spent: { $sum: '$amountSpent' } } }
    ]);

    const totals = totalBudgetResult[0] || { total: 0, spent: 0 };

    return res.status(200).json({
      success: true,
      data: {
        counts: { total, pending, submitted, approved, rejected },
        amounts: {
          totalBudgetAllocated: totals.total,
          totalAmountSpent: totals.spent,
          totalChange: totals.total - totals.spent,
        }
      }
    });
  } catch (err) {
    logger.error('adminPayoutStats error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Transfer to vendor — called from Redux payoutSlice transferToVendor action
exports.transferToVendor = async (req, res) => {
  try {
    const {
      orderId, vendorName, amountSpent, changeAmount,
      bankName, accountNumber, accountName,
    } = req.body;

    if (!orderId) return res.status(400).json({ success: false, message: 'orderId is required' });
    if (!vendorName || !amountSpent) return res.status(400).json({ success: false, message: 'vendorName and amountSpent are required' });
    if (!bankName || !accountNumber || !accountName) return res.status(400).json({ success: false, message: 'Bank details are required' });

    const spent = parseFloat(amountSpent);
    const change = changeAmount != null ? parseFloat(changeAmount) : 0;

    const receiptEntry = {
      vendorName,
      amountSpent: spent,
      changeAmount: change,
      submittedAt: new Date(),
      status: 'pending',
      bankDetails: { bankName, accountNumber, accountName },
    };

    const payout = await RunnerPayout.findOneAndUpdate(
      { orderId },
      {
        $set: {
          vendorName,
          amountSpent: spent,
          changeAmount: change,
          status: 'submitted',
          submittedAt: new Date(),
          usedPayoutSystem: true,
          bankDetails: { bankName, accountNumber, accountName },
        },
        $push: { receiptHistory: receiptEntry },
      },
      { new: true }
    );

    if (!payout) return res.status(404).json({ success: false, message: 'Payout record not found for this order' });

    logger.info(`transferToVendor | orderId=${orderId} | vendor=${vendorName} | amount=₦${spent}`);

    return res.status(200).json({
      success: true,
      message: 'Transfer submitted successfully',
      data: {
        orderId: payout.orderId,
        status: payout.status,
        usedPayoutSystem: payout.usedPayoutSystem,
        vendorName: payout.vendorName,
        amountSpent: payout.amountSpent,
        changeAmount: payout.changeAmount,
      },
    });
  } catch (err) {
    logger.error('transferToVendor error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};