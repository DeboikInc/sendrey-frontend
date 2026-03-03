const express = require('express');
const router = express.Router();
const pinController = require('../controllers/pinControllers');
const { authenticate, authorize, auditLog } = require('../middleware/auth');
const { requireOtpVerified } = require('../middleware/otpMiddleware');

router.post(
    '/set-pin',
    authenticate,
    auditLog('SET_PIN'),
    pinController.setPin);

router.post(
    '/verify-pin',
    authenticate,
    auditLog('VERIFY_PIN'),
    pinController.verifyPin);

router.put(
    '/reset-pin', 
    authenticate,
    auditLog('RESET_PIN'),
    pinController.resetPin);

router.put(
    '/forgot-pin', 
    authenticate,
    auditLog('FORGOT_PIN'),
    requireOtpVerified, 
    pinController.forgotPin);

module.exports = router;