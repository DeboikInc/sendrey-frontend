const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const runnerController = require('../controllers/runnerController');
const { authenticate, authorize, auditLog } = require('../middleware/auth');
const { validate, validateQuery } = require('../middleware/validation');
const { userValidation, userQueryValidation, userParamsValidation } = require('../validations/userValidation');

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

module.exports = router;