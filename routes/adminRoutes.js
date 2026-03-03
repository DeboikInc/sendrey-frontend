// adminRoutes
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const runnerController = require('../controllers/runnerController');
const payoutController = require('../controllers/payoutController');

const { authenticate, authorize, auditLog } = require('../middleware/auth');
const { validate, validateQuery } = require('../middleware/validation');
const { userValidation, userQueryValidation, userParamsValidation } = require('../validations/userValidation');

const { getMetricsSummary, checkMetricsHealth } = require('../utils/metricsLogger');
const Metric = require('../models/Metric');

const { isAdmin} = require('../middleware/roleCheck');

// payments and escrows
const Escrow = require('../models/Escrows');
const Dispute = require('../models/Dispute');
// const Transaction = require('../models/Transaction');
const Order = require('../models/Order');

// All admin routes require authentication
router.use(authenticate);

// All admin routes require admin privileges
router.use(authorize(['admin', 'super-admin', 'manager']));

// ========== USER MANAGEMENT ROUTES ==========
// Get all users
router.get('/users',
  validateQuery(userQueryValidation.listUsers),
  auditLog('LIST_USERS'),
  userController.listUsers
);

// Search users
router.get('/users/search',
  validateQuery(userQueryValidation.listUsers),
  auditLog('SEARCH_USERS'),
  userController.searchUsers
);

// Get single user details
router.get('/users/:userId',
  validate(userParamsValidation.userId, 'params'),
  auditLog('GET_USER_ADMIN'),
  userController.getSingleUser
);

// Update any user profile
router.put('/users/:userId',
  validate(userParamsValidation.userId, 'params'),
  validate(userValidation.updateProfile, 'body'),
  auditLog('UPDATE_USER_ADMIN'),
  userController.updateProfile
);

// Update user role
router.patch('/users/:userId/role',
  validate(userParamsValidation.userId, 'params'),
  validate(userValidation.updateRole),
  auditLog('UPDATE_USER_ROLE_ADMIN'),
  userController.updateUserRole
);

// Update user status
router.patch('/users/:userId/status',
  validate(userParamsValidation.userId, 'params'),
  validate(userValidation.updateStatus),
  auditLog('UPDATE_USER_STATUS_ADMIN'),
  userController.updateUserStatus
);

// Delete user (super-admin only)
router.delete('/users/:userId',
  validate(userParamsValidation.userId, 'params'),
  authorize(['super-admin']),
  auditLog('DELETE_USER_ADMIN'),
  userController.deleteUser
);

// Bulk user actions
router.post('/users/bulk/action',
  validate(userValidation.bulkAction),
  auditLog('BULK_USER_ACTION_ADMIN'),
  userController.bulkUserAction
);

// Export users data
router.post('/users/export',
  validate(userValidation.exportUsers),
  auditLog('EXPORT_USERS'),
  userController.exportUsers
);

// ========== RUNNER MANAGEMENT ROUTES ==========
// Get all runners
router.get('/runners',
  runnerController.getRunners
);

// Get runner statistics
router.get('/runners/stats',
  auditLog('GET_RUNNER_STATS'),
  runnerController.getRunnerStats
);

// Search runners
router.get('/runners/search',
  auditLog('SEARCH_RUNNERS'),
  runnerController.searchRunners
);

// Delete runner
router.delete('/runners/:runnerId',
  authorize(['super-admin']),
  auditLog('DELETE_RUNNER'),
  runnerController.deleteRunner
);

// Update runner status (admin override)
router.patch('/runners/:runnerId/status',
  auditLog('UPDATE_RUNNER_STATUS_ADMIN'),
  runnerController.updateRunnerStatus
);

// metrics summary
/**
 * GET /api/metrics/summary
 * Get metrics summary for a time period
 */
router.get('/summary', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const summary = await getMetricsSummary(hours);

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Error fetching metrics summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch metrics summary'
    });
  }
});

/**
 * GET /api/metrics/health
 * Check system health and get alerts
 */
router.get('/health', async (req, res) => {
  try {
    const health = await checkMetricsHealth();

    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    console.error('Error checking metrics health:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check metrics health'
    });
  }
});

/**
 * GET /api/metrics/recent-failures
 * Get recent failed operations
 */
router.get('/recent-failures', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const type = req.query.type; // optional filter by type

    const query = { status: 'failed' };
    if (type) {
      query.type = type;
    }

    const failures = await Metric.find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    res.json({
      success: true,
      data: {
        total: failures.length,
        failures
      }
    });
  } catch (error) {
    console.error('Error fetching failures:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch failures'
    });
  }
});

/**
 * GET /api/metrics/by-type
 * Get metrics grouped by type
 */
router.get('/by-type', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const metricsByType = await Metric.aggregate([
      { $match: { timestamp: { $gte: since } } },
      {
        $group: {
          _id: {
            type: '$type',
            status: '$status'
          },
          count: { $sum: 1 },
          avgLatency: { $avg: '$latency' }
        }
      },
      { $sort: { '_id.type': 1 } }
    ]);

    res.json({
      success: true,
      data: {
        period: `Last ${hours} hours`,
        metrics: metricsByType
      }
    });
  } catch (error) {
    console.error('Error fetching metrics by type:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch metrics by type'
    });
  }
});


// ========== PAYMENT & ESCROW ROUTES ==========
// View all escrows with status filter
router.get('/escrows', async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = status ? { status } : {};

    const escrows = await Escrow.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('userId', 'firstName lastName email')
      .populate('runnerId', 'firstName lastName email');

    const total = await Escrow.countDocuments(query);

    res.json({ success: true, data: { escrows, total, page: parseInt(page) } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// View all disputes with status filter
router.get('/disputes', async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const disputeService = require('../services/disputeService');
    const result = await disputeService.getAllDisputes(
      parseInt(page), parseInt(limit), status || null
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single dispute details
router.get('/disputes/:disputeId', async (req, res) => {
  try {
    const dispute = await Dispute.findOne({ disputeId: req.params.disputeId })
      .populate('userId', 'firstName lastName email')
      .populate('runnerId', 'firstName lastName email');

    if (!dispute) return res.status(404).json({ success: false, error: 'Dispute not found' });

    res.json({ success: true, data: dispute });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Resolve dispute
router.post('/disputes/:disputeId/resolve',
  auditLog('RESOLVE_DISPUTE'),
  async (req, res) => {
    try {
      const { disputeId } = req.params;
      const { outcome, releasePercentage, adminNote } = req.body;

      if (!outcome) {
        return res.status(400).json({ success: false, error: 'Outcome is required' });
      }

      const disputeService = require('../services/disputeService');
      const result = await disputeService.resolveDispute({
        disputeId,
        outcome,
        releasePercentage,
        adminNote,
        resolvedBy: req.user._id
      });

      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// ─── payout routes ─────────────────────────────────────────────────────────────
router.get('/payout/receipts', payoutController.adminGetAllReceipts);
router.get('/payout/stats', payoutController.adminPayoutStats);
router.patch('/payout/receipts/:payoutId/receipt/:receiptId', payoutController.adminReviewReceipt);

// Platform revenue summary
// router.get('/revenue',
//   auditLog('VIEW_REVENUE'),
//   async (req, res) => {
//     try {
//       const { startDate, endDate } = req.query;
//       const dateFilter = {};
//       if (startDate) dateFilter.$gte = new Date(startDate);
//       if (endDate) dateFilter.$lte = new Date(endDate);

//       const [revenueData, totalRevenue] = await Promise.all([
//         Transaction.aggregate([
//           {
//             $match: {
//               transactionType: 'platform_fee',
//               status: 'completed',
//               ...(Object.keys(dateFilter).length ? { createdAt: dateFilter } : {})
//             }
//           },
//           {
//             $group: {
//               _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
//               dailyRevenue: { $sum: '$amount' },
//               count: { $sum: 1 }
//             }
//           },
//           { $sort: { _id: -1 } },
//           { $limit: 30 }
//         ]),
//         Transaction.aggregate([
//           { $match: { transactionType: 'platform_fee', status: 'completed' } },
//           { $group: { _id: null, total: { $sum: '$amount' } } }
//         ])
//       ]);

//       res.json({
//         success: true,
//         data: {
//           totalRevenue: totalRevenue[0]?.total || 0,
//           dailyBreakdown: revenueData
//         }
//       });
//     } catch (error) {
//       res.status(500).json({ success: false, error: error.message });
//     }
//   }
// );

// Pending runner payouts
router.get('/payouts/pending',
  auditLog('VIEW_PENDING_PAYOUTS'),
  async (req, res) => {
    try {
      const pendingPayouts = await Escrow.find({
        status: 'delivery_pending',
        deliveryFeeReleased: false
      })
        .populate('runnerId', 'firstName lastName email')
        .populate('userId', 'firstName lastName email')
        .sort({ createdAt: -1 });

      const totalPending = pendingPayouts.reduce(
        (sum, e) => sum + (e.runnerPayout || 0), 0
      );

      res.json({
        success: true,
        data: { payouts: pendingPayouts, totalPending }
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// Financial report
// router.get('/reports/financial',
//   auditLog('VIEW_FINANCIAL_REPORT'),
//   async (req, res) => {
//     try {
//       const { period = '30' } = req.query;
//       const days = parseInt(period);
//       const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

//       const [
//         totalOrders,
//         completedOrders,
//         disputedOrders,
//         totalRevenue,
//         totalPayouts,
//         totalRefunds,
//         totalWalletFunding
//       ] = await Promise.all([
//         Order.countDocuments({ createdAt: { $gte: since } }),
//         Order.countDocuments({ status: 'completed', createdAt: { $gte: since } }),
//         Order.countDocuments({
//           status: { $in: ['disputed', 'dispute_resolved'] },
//           createdAt: { $gte: since }
//         }),
//         Transaction.aggregate([
//           {
//             $match: {
//               transactionType: 'platform_fee',
//               status: 'completed',
//               createdAt: { $gte: since }
//             }
//           },
//           { $group: { _id: null, total: { $sum: '$amount' } } }
//         ]),
//         Transaction.aggregate([
//           {
//             $match: {
//               transactionType: 'payout',
//               status: 'completed',
//               createdAt: { $gte: since }
//             }
//           },
//           { $group: { _id: null, total: { $sum: '$amount' } } }
//         ]),
//         Transaction.aggregate([
//           {
//             $match: {
//               transactionType: 'refund',
//               status: 'completed',
//               createdAt: { $gte: since }
//             }
//           },
//           { $group: { _id: null, total: { $sum: '$amount' } } }
//         ]),
//         Transaction.aggregate([
//           {
//             $match: {
//               transactionType: 'wallet_funding',
//               status: 'completed',
//               createdAt: { $gte: since }
//             }
//           },
//           { $group: { _id: null, total: { $sum: '$amount' } } }
//         ])
//       ]);

//       res.json({
//         success: true,
//         data: {
//           period: `${days} days`,
//           orders: {
//             total: totalOrders,
//             completed: completedOrders,
//             disputed: disputedOrders,
//             completionRate: totalOrders > 0
//               ? `${((completedOrders / totalOrders) * 100).toFixed(1)}%`
//               : '0%'
//           },
//           financial: {
//             platformRevenue: totalRevenue[0]?.total || 0,
//             runnerPayouts: totalPayouts[0]?.total || 0,
//             refundsIssued: totalRefunds[0]?.total || 0,
//             walletFunding: totalWalletFunding[0]?.total || 0
//           }
//         }
//       });
//     } catch (error) {
//       res.status(500).json({ success: false, error: error.message });
//     }
//   }
// );

// All transactions (audit trail)
// router.get('/transactions',
//   auditLog('VIEW_ALL_TRANSACTIONS'),
//   async (req, res) => {
//     try {
//       const { page = 1, limit = 20, type, status } = req.query;
//       const query = {};
//       if (type) query.transactionType = type;
//       if (status) query.status = status;

//       const transactions = await Transaction.find(query)
//         .sort({ createdAt: -1 })
//         .skip((page - 1) * limit)
//         .limit(parseInt(limit));

//       const total = await Transaction.countDocuments(query);

//       res.json({
//         success: true,
//         data: { transactions, total, page: parseInt(page) }
//       });
//     } catch (error) {
//       res.status(500).json({ success: false, error: error.message });
//     }
//   }
// );

module.exports = router;