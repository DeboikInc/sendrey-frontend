const BaseController = require('./baseController');
const authService = require('../services/authService');
const userService = require('../services/userService');
const runnerService = require('../services/runnerService');
const emailService = require('../services/emailService');
const smsService = require('../services/smsService');
const paymentService = require('../services/paymentServices');

const logger = require('../utils/logger');
const ActivityLogger = require('../utils/activityLogger');
const User = require('../models/User');
const Runner = require('../models/Runner');
const bcrypt = require('bcryptjs');

const { sendEmailEvent } = require('../kafka/producers/emailProducer');
const { sendSmsEvent } = require('../kafka/producers/smsProducer');

class AuthController extends BaseController {
  constructor() {
    super(authService);
    this.userService = userService;
    this.runnerService = runnerService;
    this.emailService = emailService;
    this.smsService = smsService;
  }

  register = async (req, res, next) => {
    console.log('Incoming user registration body:', req.body);
    try {
      const userData = req.body;
      const creatorRole = req.user?.role;

      const { user, token } = await authService.register(userData, creatorRole, 'user');

      // Skip verification for admins
      if (user.role === 'admin' || user.role === 'super-admin') {
        return this.created(res, {
          user: this._sanitizeUser(user),
          message: 'Admin registered successfully.',
          token
        });
      }

      // Generate tokens
      const verificationToken = await authService.generateVerificationToken(user._id, 'user');
      const otp = await authService.generatePhoneVerificationOTP(user._id, userData.phone, 'user');

      // Queue verification email via Kafka
      if (user.email) {
        await sendEmailEvent({
          type: 'email-verification',
          to: user.email,
          subject: 'Verify your Sendrey account',
          template: 'emailVerification',
          data: {
            name: user.firstName,
            verificationToken,
            verificationUrl: `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`,
          },
        });
      }

      // Queue OTP SMS via Kafka
      if (user.phone) {
        await sendSmsEvent({
          type: 'otp',
          to: user.phone,
          otp,
        });
      }

      // Virtual account (non-blocking)
      try {
        await paymentService.createVirtualAccount(
          user._id, user.email, `${user.firstName} ${user.lastName}`
        );
      } catch (err) {
        console.error('Virtual account creation failed:', err.message);
      }

      logger.info(`User registered: ${user.phone}`);

      this.created(res, {
        user: this._sanitizeUser(user),
        message: 'Registration successful. Please check your email and phone for verification.',
        token
      });

    } catch (error) {
      logger.error('User registration error:', error);
      next(error);
    }
  }

  registerRunner = async (req, res, next) => {
    console.log('Incoming runner registration body:', req.body);
    try {
      const runnerData = req.body;
      runnerData.role = 'runner';

      const { user: runner, token } = await authService.register(runnerData, null, 'runner');

      const verificationToken = await authService.generateVerificationToken(runner._id, 'runner');
      const otp = await authService.generatePhoneVerificationOTP(runner._id, runnerData.phone, 'runner');

      // Queue verification email via Kafka
      if (runner.email) {
        await sendEmailEvent({
          type: 'email-verification',
          to: runner.email,
          subject: 'Verify your Sendrey runner account',
          template: 'emailVerification',
          data: {
            name: runner.firstName,
            verificationToken,
            verificationUrl: `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`,
          },
        });
      }

      // Queue OTP SMS via Kafka
      if (runner.phone) {
        await sendSmsEvent({
          type: 'otp',
          to: runner.phone,
          otp,
        });
      }

      // Virtual account (non-blocking)
      try {
        await paymentService.createVirtualAccount(
          runner._id, runner.email, `${runner.firstName} ${runner.lastName}`
        );
      } catch (err) {
        console.error('Virtual account creation failed:', err.message);
      }

      logger.info(`Runner registered: ${runner.phone}`);

      this.created(res, {
        runner: this._sanitizeRunner(runner),
        message: 'Runner registration successful. Please verify your phone number.',
        token
      });

    } catch (error) {
      logger.error('Runner registration error:', error);
      next(error);
    }
  }

  login = async (req, res, next) => {
    try {
      const { email, password, phone } = req.body;

      let user = await User.findOne({
        $or: [{ email: email || '' }, { phone: phone || '' }]
      }).select('+password');

      let userType = 'user';

      if (!user) {
        user = await Runner.findOne({
          $or: [{ email: email || '' }, { phone: phone || '' }]
        }).select('+password');
        userType = 'runner';
      }

      if (!user) throw new Error('Invalid credentials');

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) throw new Error('Invalid credentials');

      const token = this.service.generateToken(user);

      if (userType === 'user') {
        await userService.updateLastLogin(user._id);
      } else {
        await runnerService.updateLastLogin(user._id);
      }

      const response = userType === 'user' ? this._sanitizeUser(user) : this._sanitizeRunner(user);

      logger.info(`${userType} logged in: ${user.email || user.phone}`);

      this.success(res, {
        [userType]: response,
        token,
        userType,
        message: 'Login successful'
      });

    } catch (error) {
      next(error);
    }
  }

  adminLogin = async (req, res, next) => {
    try {
      const { email, password } = req.body;

      const admin = await User.findOne({
        email,
        role: { $in: ['admin', 'super-admin'] }
      }).select('+password');

      if (!admin) throw new Error('Invalid admin credentials');
      if (!admin.isActive) throw new Error('Admin account has been deactivated');

      const isPasswordValid = await bcrypt.compare(password, admin.password);
      if (!isPasswordValid) throw new Error('Invalid admin credentials');

      const token = this.service.generateToken(admin);
      await this.userService.updateLastLogin(admin._id);

      logger.info(`Admin logged in: ${email}`);

      this.success(res, {
        user: this._sanitizeUser(admin),
        token,
        message: 'Admin login successful'
      });

    } catch (error) {
      logger.error('Admin login error:', error);
      next(error);
    }
  }

  verifyEmail = async (req, res, next) => {
    try {
      const { token, userType = 'user' } = req.body;
      const user = await authService.verifyEmail(token, userType);

      // Queue confirmation email via Kafka
      if (user.email) {
        await sendEmailEvent({
          type: 'email-verified',
          to: user.email,
          subject: 'Email Verified Successfully',
          template: 'emailVerified',
          data: { name: user.firstName },
        });
      }

      logger.info(`${userType} email verified: ${user.email || user.phone}`);

      this.success(res, {
        [userType]: userType === 'user' ? this._sanitizeUser(user) : this._sanitizeRunner(user),
        message: 'Email verified successfully'
      });

    } catch (error) {
      logger.error('Email verification error:', error);
      next(error);
    }
  }

  forgotPassword = async (req, res, next) => {
    try {
      const { email, phone, userType = 'user' } = req.body;

      const resetToken = await authService.generatePasswordResetToken(email, phone, userType);
      if (!resetToken) {
        // User not found — don't reveal
        return this.success(res, { message: 'If the phone or email exists, password reset instructions have been sent' });
      }

      // Queue via Kafka — email takes priority, fall back to SMS
      if (email) {
        await sendEmailEvent({
          type: 'password-reset',
          to: email,
          subject: 'Reset your Sendrey password',
          template: 'passwordReset',
          data: {
            resetToken,
            resetUrl: `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`,
            expiresIn: '1 hour',
          },
        });
      } else if (phone) {
        await sendSmsEvent({
          type: 'password-reset',
          to: phone,
          resetToken,
        });
      }

      logger.info(`Password reset requested for ${userType}: ${email || phone}`);

      this.success(res, { message: 'If the phone or email exists, password reset instructions have been sent' });

    } catch (error) {
      logger.error('Forgot password error:', error);
      this.success(res, { message: 'If the phone or email exists, password reset instructions have been sent' });
    }
  }

  resetPassword = async (req, res, next) => {
    try {
      const { token, newPassword, userType = 'user' } = req.body;
      const user = await authService.resetPassword(token, newPassword, userType);

      // Queue confirmation via Kafka
      if (user.email) {
        await sendEmailEvent({
          type: 'password-reset-success',
          to: user.email,
          subject: 'Password Reset Successful',
          template: 'passwordResetSuccess',
          data: { name: user.firstName },
        });
      } else if (user.phone) {
        await sendSmsEvent({
          type: 'alert',
          to: user.phone,
          message: 'Your Sendrey password has been reset successfully. If you did not do this, contact support immediately.',
        });
      }

      logger.info(`Password reset successful for ${userType}: ${user.email || user.phone}`);
      this.success(res, { message: 'Password reset successfully' });

    } catch (error) {
      logger.error('Reset password error:', error);
      next(error);
    }
  }

  changePassword = async (req, res, next) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user.id;
      const userType = req.user.role === 'runner' ? 'runner' : 'user';

      const user = await authService.changePassword(userId, currentPassword, newPassword, userType);

      // Queue confirmation via Kafka
      if (user.email) {
        await sendEmailEvent({
          type: 'password-changed',
          to: user.email,
          subject: 'Password Changed',
          template: 'passwordChanged',
          data: { name: user.firstName },
        });
      } else if (user.phone) {
        await sendSmsEvent({
          type: 'alert',
          to: user.phone,
          message: 'Your Sendrey password has been changed successfully.',
        });
      }

      logger.info(`Password changed for ${userType}: ${user.email || user.phone}`);
      this.success(res, { message: 'Password changed successfully' });

    } catch (error) {
      logger.error('Change password error:', error);
      next(error);
    }
  }

  resendVerification = async (req, res, next) => {
    try {
      const { email, userType = 'user' } = req.body;
      const { user, token } = await authService.resendVerificationEmail(email, userType);

      // Queue via Kafka
      if (user.email) {
        await sendEmailEvent({
          type: 'email-verification',
          to: user.email,
          subject: 'Verify Your Sendrey Account',
          template: 'emailVerification',
          data: {
            name: user.firstName,
            verificationToken: token,
            verificationUrl: `${process.env.FRONTEND_URL}/verify-email?token=${token}`,
          },
        });
      }

      logger.info(`Verification email resent to ${userType}: ${email}`);
      this.success(res, { message: 'Verification email sent successfully' });

    } catch (error) {
      logger.error('Resend verification error:', error);
      next(error);
    }
  }

  logout = async (req, res, next) => {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      const userType = req.user.role === 'runner' ? 'runner' : 'user';

      await ActivityLogger.logLogout(req.user, req.ip, req.get('User-Agent'), userType);
      if (token) await authService.blacklistToken(token);

      logger.info(`${userType} logged out: ${req.user.email || req.user.phone}`);
      this.success(res, { message: 'Logged out successfully' });

    } catch (error) {
      logger.error('Logout error:', error);
      next(error);
    }
  }

  requestPhoneVerification = async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { phone, userType = 'user' } = req.body;

      const otp = await authService.generatePhoneVerificationOTP(userId, phone, userType);

      // Queue OTP via Kafka
      await sendSmsEvent({
        type: 'otp',
        to: phone,
        otp,
      });

      logger.info(`Phone verification OTP queued for ${userType}: ${phone}`);
      this.success(res, { message: 'Verification code sent to your phone' });

    } catch (error) {
      logger.error('Phone verification request error:', error);
      next(error);
    }
  }

  verifyPhone = async (req, res, next) => {
    try {
      const userId = req.user.id;
      const userType = req.user.role === 'runner' ? 'runner' : 'user';
      const { otp } = req.body;

      const user = await authService.verifyPhoneOTP(userId, otp, userType);

      logger.info(`Phone verified for ${userType}: ${user.email || user.phone}`);
      this.success(res, {
        user: this._sanitizeUser(user),
        message: 'Phone number verified successfully'
      });

    } catch (error) {
      logger.error('Phone verification error:', error);
      next(error);
    }
  }

  _sanitizeUser(user) {
    if (!user) return null;
    const userObj = user.toObject ? user.toObject() : { ...user };
    delete userObj.password; delete userObj.__v;
    delete userObj.verificationToken; delete userObj.verificationExpires;
    delete userObj.resetPasswordToken; delete userObj.resetPasswordExpires;
    delete userObj.phoneVerificationOTP; delete userObj.phoneVerificationExpires;
    return userObj;
  }

  _sanitizeRunner(runner) {
    if (!runner) return null;
    const runnerObj = runner.toObject ? runner.toObject() : { ...runner };
    delete runnerObj.password; delete runnerObj.__v;
    delete runnerObj.verificationToken; delete runnerObj.verificationExpires;
    delete runnerObj.resetPasswordToken; delete runnerObj.resetPasswordExpires;
    delete runnerObj.phoneVerificationOTP; delete runnerObj.phoneVerificationExpires;
    return runnerObj;
  }
}

module.exports = new AuthController();