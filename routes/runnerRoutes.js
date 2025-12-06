const express = require('express');
const router = express.Router();
const runnerController = require('../controllers/runnerController');
const { authenticate, authorize, auditLog, checkOwnership } = require('../middleware/auth');
const { validate, validateQuery } = require('../middleware/validation');
const { userParamsValidation } = require('../validations/userValidation');


router.get('/nearby-runners',
  runnerController.getNearbyRunners.bind(runnerController)
);

router.use(authenticate);


router.get('/',
  authorize(['admin', 'super-admin', 'manager', 'user', 'runner']),
  runnerController.getRunners.bind(runnerController)
);


router.get('/online',
  authorize(['admin', 'super-admin', 'manager', 'user', 'runner']),
  runnerController.getOnlineRunners.bind(runnerController)
);

// GET /api/v1/runners/stats - Get runner statistics
router.get('/stats',
  authorize(['admin', 'super-admin', 'manager']),
  runnerController.getRunnerStats.bind(runnerController)
);


router.get('/service/:serviceType',
  validate(userParamsValidation.serviceType, 'params'),
  authorize(['admin', 'super-admin', 'manager', 'user', 'runner']),
  runnerController.getRunnersByServiceType.bind(runnerController)
);


router.post('/update-location',
  authorize(['runner', 'admin', 'super-admin']),
  auditLog('UPDATE_RUNNER_LOCATION'),
  runnerController.updateRunnerLocation.bind(runnerController)
);

router.post('/set-online-status',
  authorize(['runner', 'admin', 'super-admin']),
  auditLog('UPDATE_RUNNER_STATUS'),
  runnerController.setRunnerOnlineStatus.bind(runnerController)
);

module.exports = router;