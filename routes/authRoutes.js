const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { validate } = require('../middleware/validation');
const { authValidation } = require('../validations/authValidation');

router.post('/register',
  validate(authValidation.register),
  authController.register
);

router.post('/login',
  validate(authValidation.login),
  authController.login
);

router.post('/forgot-password',
  validate(authValidation.forgotPassword),
  authController.forgotPassword
);

router.post('/reset-password',
  validate(authValidation.resetPassword),
  authController.resetPassword
);

module.exports = router;