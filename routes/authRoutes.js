const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { validate } = require('../middleware/validation');
const { authValidation } = require('../validations/authValidation');
const {
  authenticate,
  authenticateOptional,
  authorize,
  userRateLimit,
  auditLog
} = require('../middleware/auth');


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

router.post('/register-admin',
  // authenticate,
  // authorize(['admin', 'super-admin']),
  userRateLimit({ windowMs: 60 * 60 * 1000, maxRequests: 3 }), // 3 registrations per hour
  validate(authValidation.createAdmin),
  auditLog('REGISTER-ADMIN'),
  authController.register
);

router.post('/login',
  userRateLimit({ windowMs: 15 * 60 * 1000, maxRequests: 5 }), // 5 login attempts per 15 minutes
  validate(authValidation.login),
  auditLog('LOGIN'),
  authController.login
);

router.post('/admin/login',
  userRateLimit({ windowMs: 15 * 60 * 1000, maxRequests: 5 }),
  validate(authValidation.adminLogin),
  auditLog('ADMIN_LOGIN'),
  authController.adminLogin
);

router.post('/verify-email',
  validate(authValidation.verifyEmail),
  authController.verifyEmail
);

router.post('/resend-email-verification',
  userRateLimit({ windowMs: 60 * 60 * 1000, maxRequests: 3 }), // 3 resends per hour
  validate(authValidation.resendVerification),
  authController.resendVerification
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

// Protected routes
router.use(authenticate);

// Protected routes (require authentication)
router.post('/change-password',
  validate(authValidation.changePassword),
  auditLog('CHANGE_PASSWORD'),
  authController.changePassword
);

router.post('/request-phone-verification',
  validate(authValidation.requestPhoneVerification),
  authController.requestPhoneVerification
);

router.post('/verify-phone',
  validate(authValidation.verifyPhone),
  authController.verifyPhone
);

router.post('/resend-phone-verification',
  userRateLimit({ windowMs: 60 * 60 * 1000, maxRequests: 3 }), // 3 resends per hour
  // validate(authValidation.resendVerification),
  // authController.resendVerification
);

router.post('/logout',
  validate(authValidation.logout),
  auditLog('LOGOUT'),
  authController.logout
);

module.exports = router;