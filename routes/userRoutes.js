// userRoutes
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { validate, validateQuery } = require('../middleware/validation');
const { userValidation, userQueryValidation, userParamsValidation } = require('../validations/userValidation');
const { authenticate, authorize, auditLog, checkOwnership } = require('../middleware/auth');
const { isRunner } = require('../middleware/roleCheck');
const  upload  = require('../middleware/upload');

// Public routes (if any)
router.get('/public-profile/:userId',
  validate(userParamsValidation.userId, 'params'),
  userController.getPublicProfile
);

// Protected routes (require authentication)
router.use(authenticate);

router.get('/nearby-users',
  isRunner,
  userController.getNearbyUsers
);

// User profile routes
router.get('/profile',
  userController.getProfile
);
router.post('/update-location',
  validate(userValidation.saveLocation),
  userController.saveLocation
)

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
  upload.single('avatar'),
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

// is available, online offline etc
router.patch('/:userId/status',
  validate(userParamsValidation.userId, 'params'),
  validate(userValidation.updateStatus),
  checkOwnership('params.userId'),
  auditLog('UPDATE_USER_STATUS'),
  userController.updateUserStatus
);



module.exports = router;