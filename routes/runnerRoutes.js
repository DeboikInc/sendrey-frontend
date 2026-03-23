// ratingRoutes
const express = require('express');
const router = express.Router();
const runnerController = require('../controllers/runnerController');
const { authenticate, authorize, auditLog, userRateLimit } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { userParamsValidation, userValidation } = require('../validations/userValidation');
const upload = require('../middleware/upload');

// Protected routes (require authentication)
router.use(authenticate);

// get nearby runners for users 
router.get('/nearby-runners',
  authorize(['user']),
  auditLog('GET_NEARBY_RUNNERS'),
  runnerController.getNearbyRunners);

// Runner profile routes (authenticated runners only)
router.get('/profile',
  authorize(['runner']),
  runnerController.getProfile
);


router.put('/update-profile',
  authorize(['runner']),
  upload.single('avatar'),
  validate(userValidation.updateProfile),
  userRateLimit({ windowMs: 60 * 60 * 1000, maxRequests: 10 }),
  auditLog('UPDATE_RUNNER_PROFILE'),
  runnerController.updateProfile
);

// Runner operations (authenticated runners only)
router.post('/update-location',
  authorize(['runner']),
  auditLog('UPDATE_RUNNER_LOCATION'),
  runnerController.updateRunnerLocation
);

router.post('/set-online-status',
  authorize(['runner']),
  auditLog('UPDATE_RUNNER_STATUS'),
  runnerController.setRunnerOnlineStatus
);

// Verification (authenticated runners only)
router.post('/verification/documents/:documentType',
  authorize(['runner']),
  auditLog('SUBMIT_RUNNER_DOCUMENT'),
  runnerController.updateVerificationDocuments
);

router.post('/verification/biometric',
  authorize(['runner']),
  auditLog('SUBMIT_RUNNER_BIOMETRIC'),
  runnerController.updateBiometricVerification
);

// Public runner listings (authenticated users can see runners)
router.get('/',
  authorize(['user', 'runner']), // Users and runners can see runners
  runnerController.getRunners
);

router.get('/online',
  authorize(['user', 'runner']),
  runnerController.getOnlineRunners
);

router.get('/service/:serviceType',
  validate(userParamsValidation.serviceType, 'params'),
  authorize(['user', 'runner']),
  runnerController.getRunnersByServiceType
);

router.patch(
    '/:runnerId/avatar',
    authorize(['runner']),
    upload.single('avatar'),
    userRateLimit({ windowMs: 60 * 60 * 1000, maxRequests: 3 }),
    auditLog('UPDATE_RUNNER_AVATAR'),
    runnerController.updateAvatar
);

module.exports = router;