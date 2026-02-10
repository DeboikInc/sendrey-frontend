const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { validate, validateQuery } = require('../middleware/validation');
const { userValidation, userQueryValidation, userParamsValidation } = require('../validations/userValidation');
const { authenticate, authorize, auditLog, checkOwnership } = require('../middleware/auth');

router.get('/nearby-users',
  userController.getNearbyUsers
);

// Public routes (if any)
router.get('/public-profile/:userId',
  validate(userParamsValidation.userId, 'params'),
  userController.getPublicProfile
);

// Protected routes (require authentication)
router.use(authenticate);

// User profile routes
router.get('/profile',
  userController.getProfile
);

router.route('/locations')
  .get(userController.getMyLocations)
  .post(
    validate(userValidation.saveLocation),
    userController.saveLocation
  );

router.delete('/locations/:locationId',
  validate(userValidation.locationParams, 'params'),
  userController.deleteLocation
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


router.get('/search',
  validateQuery(userQueryValidation.listUsers),
  userController.searchUsers
);


router.get('/:userId',
  validate(userParamsValidation.userId, 'params'),
  checkOwnership('params.userId'), // Allow access to own profile or admin
  userController.getSingleUser
);

router.put('/:userId',
  validate(userParamsValidation.userId, 'params'),
  validate(userValidation.updateProfile, 'body'),
  checkOwnership('params.userId'),
  auditLog('UPDATE_USER'),
  userController.updateProfile
);

router.patch('/:userId/role',
  validate(userParamsValidation.userId, 'params'),
  validate(userValidation.updateRole),
  authorize(['admin', 'super-admin']), // Only admin can change roles
  auditLog('UPDATE_USER_ROLE'),
  userController.updateUserRole
);

// is available, online offline etc
router.patch('/:userId/status',
  validate(userParamsValidation.userId, 'params'),
  validate(userValidation.updateStatus),
  checkOwnership('params.userId'),
  auditLog('UPDATE_USER_STATUS'),
  userController.updateUserStatus
);

router.delete('/:userId',
  validate(userParamsValidation.userId, 'params'),
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