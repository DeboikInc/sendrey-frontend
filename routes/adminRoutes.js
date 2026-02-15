const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const runnerController = require('../controllers/runnerController');
const { authenticate, authorize, auditLog } = require('../middleware/auth');
const { validate, validateQuery } = require('../middleware/validation');
const { userValidation, userQueryValidation, userParamsValidation } = require('../validations/userValidation');

const { getMetricsSummary, checkMetricsHealth } = require('../utils/metricsLogger');
const Metric = require('../models/Metric');

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

module.exports = router;