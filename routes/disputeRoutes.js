// disputeRoutes
const express = require('express');
const router = express.Router();
const disputeController = require('../controllers/disputeController');
const { authenticate, auditLog } = require('../middleware/auth');

router.post('/raise', authenticate,
    auditLog('RAISE_DISPUTE'),
    disputeController.raiseDispute);

router.get(
    '/runner/:runnerId',
    authenticate,
    auditLog('GET_RUNNER_DISPUTES'),
    disputeController.getRunnerDisputes
);

router.get(
    '/order/:orderId',
    auditLog('GET_DISPUTE'),
    authenticate, disputeController.getDispute);


module.exports = router;