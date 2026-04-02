// authRoutes
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { validate } = require('../middleware/validation');
const { authValidation } = require('../validations/authValidation');
const {
  authenticate,
  userRateLimit,
  auditLog
} = require('../middleware/auth');


// router.get('/check-runner', authController.checkExistingUserOrRunner);

router.post('/send-returning-user-otp',
  userRateLimit({ windowMs: 60 * 60 * 1000, maxRequests: 3 }),
  authController.sendReturningUserEmailOTP
);

router.post('/register-runner',
  userRateLimit({ windowMs: 60 * 60 * 1000, maxRequests: 3 }), // 3 registrations per hour
  validate(authValidation.registerRunner),
  auditLog('REGISTER-RUNNER'),
  authController.registerRunner
);

router.post('/register-user',
  userRateLimit({ windowMs: 60 * 60 * 1000, maxRequests: 3 }), // 3 registrations per hour
  validate(authValidation.registerUser),
  auditLog('REGISTER-USER'),
  authController.register
);

router.post('/login',
  userRateLimit({ windowMs: 15 * 60 * 1000, maxRequests: 5 }), // 5 login attempts per 15 minutes
  validate(authValidation.login),
  auditLog('LOGIN'),
  authController.login
);


router.post('/verify-email',
  validate(authValidation.verifyEmail),
  authController.verifyEmail
);

router.post(
  '/verify-email-token',
  authController.verifyEmailToken
);

router.post(
  '/refresh-token',
  authController.refreshToken
);

router.get('/me', authenticate, authController.me);

router.post('/verify-email-otp',
  validate(authValidation.verifyEmailOTP),
  authController.verifyEmailOTP
);

router.post('/forgot-password',
  userRateLimit({ windowMs: 60 * 60 * 1000, maxRequests: 3 }), // 3 requests per hour
  validate(authValidation.forgotPassword),
  authController.forgotPassword
);

router.post('/reset-password',
  validate(authValidation.resetPassword),
  authController.resetPassword
);


router.post('/verify-phone',
  // authenticate,
  validate(authValidation.verifyPhone),
  authController.verifyPhone
);

router.post('/request-phone-verification',
  // authenticate,
  validate(authValidation.requestPhoneVerification),
  authController.requestPhoneVerification
);


router.post('/resend-phone-verification',
  // authenticate,
  userRateLimit({ windowMs: 60 * 60 * 1000, maxRequests: 3 }), // 3 resends per hour
  validate(authValidation.resendVerification),
  authController.resendPhoneVerification
);

// Protected routes (require authentication)
router.post('/change-password',
  validate(authValidation.changePassword),
  auditLog('CHANGE_PASSWORD'),
  authController.changePassword
);


// emails
router.post('/request-email-verification',
  // authenticate,
  validate(authValidation.requestEmailVerification),
  authController.requestEmailVerification
);


router.post('/resend-email-verification',
  // authenticate,
  userRateLimit({ windowMs: 60 * 60 * 1000, maxRequests: 3 }), // 3 resends per hour
  validate(authValidation.resendVerification),
  authController.resendEmailVerification
);

router.post('/logout',
  validate(authValidation.logout),
  auditLog('LOGOUT'),
  authController.logout
);

module.exports = router;