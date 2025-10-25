const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { validate, validateQuery } = require('../middleware/validation');
const { userValidation, userQueryValidation, userParamsValidation } = require('../validations/userValidation');
const { authenticate, authorize, auditLog, checkOwnership } = require('../middleware/auth');

// Public routes (if any)
router.get('/public-profile/:userId',
  validate(userParamsValidation.userId),
  userController.getProfile
);

// Protected routes (require authentication)
router.use(authenticate);

// User profile routes
router.get('/profile',
  userController.getProfile
);

router.put('/profile',
  validate(userValidation.updateProfile),
  auditLog('UPDATE_PROFILE'),
  userController.updateProfile
);

router.put('/notification-preferences',
  validate(userValidation.updateNotifications),
  userController.updateNotificationPreferences
);

// Admin only routes
router.get('/',
  authenticate,
  authorize(['sales', 'manager', 'admin', 'super-admin']),
  validateQuery(userQueryValidation.listUsers),
  userController.listUsers
);

router.get('/search',
  validateQuery(userQueryValidation.listUsers),
  userController.searchUsers
);

router.get('/:userId',
  validate(userParamsValidation.userId),
  checkOwnership('params.userId'), // Allow access to own profile or admin
  userController.getProfile
);

router.put('/:userId',
  validate(userParamsValidation.userId),
  validate(userValidation.updateProfile),
  checkOwnership('params.userId'),
  auditLog('UPDATE_USER'),
  userController.updateProfile
);

router.patch('/:userId/role',
  validate(userParamsValidation.userId),
  validate(userValidation.updateRole),
  authorize(['admin', 'super-admin']), // Only admin can change roles
  auditLog('UPDATE_USER_ROLE'),
  userController.updateUserRole
);

router.patch('/:userId/status',
  validate(userParamsValidation.userId),
  validate(userValidation.updateStatus),
  checkOwnership('params.userId'),
  auditLog('UPDATE_USER_STATUS'),
  userController.updateUserStatus
);

router.delete('/:userId',
  validate(userParamsValidation.userId),
  authorize(['super-admin']), // Only admin can delete users
  auditLog('DELETE_USER'),
  userController.deleteUser
);

router.post('/bulk/action',
  validate(userValidation.bulkAction),
  authorize(['admin', 'super-admin']),
  auditLog('BULK_USER_ACTION'),
  userController.bulkUserAction
);

router.post('/export',
  validate(userValidation.exportUsers),
  authorize(['admin', 'super-admin', 'manager', 'sales']),
  userController.exportUsers
);


module.exports = router;