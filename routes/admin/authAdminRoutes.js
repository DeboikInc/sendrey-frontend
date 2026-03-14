const express = require('express');
const router = express.Router();
const authController = require('../../controllers/authController');
const { validate } = require('../../middleware/validation');
const { authValidation } = require('../../validations/authValidation');
const {
  authenticate,
  authenticateOptional,
  authorize,
  userRateLimit,
  auditLog
} = require('../../middleware/auth');
const { isAdmin } = require('../../middleware/roleCheck')

// router.use(isAdmin)

router.post('/register-admin',
  userRateLimit({ windowMs: 60 * 60 * 1000, maxRequests: 5 }), // 3 registrations per hour
  validate(authValidation.createAdmin),
  auditLog('REGISTER-ADMIN'),
  authController.registerAdmin 
);

router.post('/logout',
  validate(authValidation.logout),
  auditLog('ADMIN_LOGOUT'),
  authController.logout
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

router.post('/login',
  userRateLimit({ windowMs: 15 * 60 * 1000, maxRequests: 5 }),
  validate(authValidation.adminLogin),
  auditLog('ADMIN_LOGIN'),
  authController.adminLogin
);

router.use(authenticate)

router.post('/change-password',
  validate(authValidation.changePassword),
  auditLog('CHANGE_PASSWORD'),
  authController.changePassword
);


module.exports = router;