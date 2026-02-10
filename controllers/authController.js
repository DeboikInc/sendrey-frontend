const BaseController = require('./baseController');
const authService = require('../services/authService');
const userService = require('../services/userService');
const runnerService = require('../services/runnerService');
const emailService = require('../services/emailService');
const smsService = require('../services/smsService');
const logger = require('../utils/logger');
const ActivityLogger = require('../utils/activityLogger');
const User = require('../models/User');
const Runner = require('../models/Runner');
const bcrypt = require('bcryptjs');

class AuthController extends BaseController {
  constructor() {
    super(authService);
    this.userService = userService;
    this.runnerService = runnerService;
    this.emailService = emailService;
    this.smsService = smsService;
  }

  /**
   * Register a new user (regular user)
   */
  register = async (req, res, next) => {
    console.log('Incoming user registration body:', req.body);
    console.log('normal user registration enpoint being called')
    try {
      const userData = req.body;
      const creatorRole = req.user?.role;

      // Create user
      const { user, token } = await authService.register(userData, creatorRole, 'user');

      // Skip email/OTP verification for admins
      if (user.role === 'admin' || user.role === 'super-admin') {
        const userResponse = this._sanitizeUser(user);

        logger.info(`Admin registered successfully: ${user.email || user.phone}`);

        return this.created(res, {
          user: userResponse,
          message: 'Admin registered successfully.',
          token
        });
      }

      // Regular user flow - send verification email/OTP
      const verificationToken = await authService.generateVerificationToken(user._id, 'user');
      const otp = await authService.generatePhoneVerificationOTP(user._id, userData.phone, 'user');

      // Send email token
      try {
        if (user.email) {
          await emailService.sendEmailVerification(user, verificationToken);
        }
      } catch (emailError) {
        logger.warn('Failed to send verification email:', emailError.message);
      }

      // Send OTP via SMS
      try {
        if (user.phone) {
          console.log("Sending OTP to user");
          await smsService.sendOTP(userData.phone, otp);
          console.log("OTP sent to you", otp);
        }
      } catch (smsError) {
        logger.warn('Failed to send OTP via SMS:', smsError.message);
      }

      // Remove sensitive data from response
      const userResponse = this._sanitizeUser(user);

      logger.info(`User registered successfully: ${user.phone}`);

      this.created(res, {
        user: userResponse,
        message: 'Registration successful. Please check your email for verification.',
        token
      });

    } catch (error) {
      logger.error('User registration error:', error);
      next(error);
    }
  }

  /**
   * Register a new runner
   */
  registerRunner = async (req, res, next) => {
    console.log('Incoming runner registration body:', req.body);
    console.log('normal runner registration enpoint being called')
    try {
      const runnerData = req.body;

      // Ensure role is set to runner
      runnerData.role = 'runner';

      // Create runner
      const { user: runner, token } = await authService.register(runnerData, null, 'runner');


      // Send verification OTP for phone
      const otp = await authService.generatePhoneVerificationOTP(runner._id, runnerData.phone, 'runner');

      // Send email token
      // try {
      //   if (runner.email) {
      //     await emailService.sendEmailVerification(runner, verificationToken);
      //   }
      // } catch (emailError) {
      //   logger.warn('Failed to send verification email:', emailError.message);
      // }

      // Send OTP via SMS
      try {
        if (runner.phone) {
          console.log("Sending OTP to runner");
          await smsService.sendOTP(runnerData.phone, otp);
          console.log("your otp verification code is", otp)
        }
      } catch (smsError) {
        console.log('failed to send otp', error)
        logger.warn('Failed to send OTP to runner via SMS:', smsError.message);
      }

      // Remove sensitive data from response
      const runnerResponse = this._sanitizeRunner(runner);

      logger.info(`Runner registered successfully: ${runner.phone}`);

      this.created(res, {
        runner: runnerResponse,
        message: 'Runner registration successful. Please verify your phone number.',
        token
      });

    } catch (error) {
      logger.error('Runner registration error:', error);
      next(error);
    }
  }

  /**
   * Login user or runner
   */
  login = async (req, res, next) => {
    try {
      const { email, password, phone } = req.body;

      // Try to find user first, then runner
      let user = await User.findOne({
        $or: [{ email: email || '' }, { phone: phone || '' }]
      }).select('+password');

      let userType = 'user';

      // If not found as user, try as runner
      if (!user) {
        user = await Runner.findOne({
          $or: [{ email: email || '' }, { phone: phone || '' }]
        }).select('+password');
        userType = 'runner';
      }

      if (!user) {
        throw new Error('Invalid credentials');
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        throw new Error('Invalid credentials');
      }

      // Generate token
      const token = this.service.generateToken(user);

      // Update last login based on type
      if (userType === 'user') {
        await userService.updateLastLogin(user._id);
      } else {
        await runnerService.updateLastLogin(user._id);
      }

      // Remove sensitive data
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

  /**
   * Admin login
   */
  adminLogin = async (req, res, next) => {
    try {
      const { email, password } = req.body;

      // Find admin user (only in User model)
      const admin = await User.findOne({
        $or: [
          { email },
        ],
        role: { $in: ['admin', 'super-admin'] }
      }).select('+password');

      if (!admin) {
        throw new Error('Invalid admin credentials');
      }

      if (!admin.isActive) {
        throw new Error('Admin account has been deactivated');
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, admin.password);
      if (!isPasswordValid) {
        throw new Error('Invalid admin credentials');
      }

      // Generate token
      const token = this.service.generateToken(admin);

      // Update last login
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

  /**
   * Verify email address (for users only)
   */
  verifyEmail = async (req, res, next) => {
    try {
      const { token, userType = 'user' } = req.body;

      const user = await authService.verifyEmail(token, userType);

      // Send confirmation email (only for users with email)
      if (user.email && userType === 'user') {
        await emailService.sendEmail(
          user.email,
          'Email Verified Successfully',
          'emailVerified',
          { name: user.name }
        );
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

  /**
   * Forgot password - send reset email/SMS
   */
  forgotPassword = async (req, res, next) => {
    try {
      const { email, phone, userType = 'user' } = req.body;

      // Generate password reset token
      const resetToken = await authService.generatePasswordResetToken(email, phone, userType);

      // Get user/runner
      let user;
      if (userType === 'user') {
        user = await userService.getUserByEmail(email, phone);
      } else {
        user = await runnerService.getRunnerByEmail(email, phone);
      }

      // Send reset instructions
      if (user.email) {
        await emailService.sendPasswordResetEmail(user, resetToken);
      } else if (user.phone) {
        await smsService.sendPasswordResetSMS(phone, resetToken);
      }

      logger.info(`Password reset requested for ${userType}: ${email || phone}`);

      this.success(res, {
        message: 'Password reset instructions sent'
      });

    } catch (error) {
      // Don't reveal if email/phone exists or not
      logger.error('Forgot password error:', error);
      this.success(res, {
        message: 'If the phone or email exists, password reset instructions have been sent'
      });
    }
  }

  /**
   * Reset password with token
   */
  resetPassword = async (req, res, next) => {
    try {
      const { token, newPassword, userType = 'user' } = req.body;

      const user = await authService.resetPassword(token, newPassword, userType);

      // Send confirmation
      if (user.email) {
        await emailService.sendEmail(
          user.email,
          'Password Reset Successful',
          'passwordResetSuccess',
          { name: user.name }
        );
      } else if (user.phone) {
        await smsService.sendSMS(
          user.phone,
          'alert',
          {
            message: 'Your password has been reset successfully. If you did not do this, please contact support immediately.'
          }
        );
      }

      logger.info(`Password reset successful for ${userType}: ${user.email || user.phone}`);

      this.success(res, {
        message: 'Password reset successfully'
      });

    } catch (error) {
      logger.error('Reset password error:', error);
      next(error);
    }
  }

  /**
   * Change password (authenticated user/runner)
   */
  changePassword = async (req, res, next) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user.id;
      const userType = req.user.role === 'runner' ? 'runner' : 'user';

      const user = await authService.changePassword(userId, currentPassword, newPassword, userType);

      // Send notification
      if (user.email) {
        await emailService.sendEmail(
          user.email,
          'Password Changed',
          'passwordChanged',
          { name: user.name }
        );
      } else if (user.phone) {
        await smsService.sendSMS(
          user.phone,
          'alert',
          {
            message: 'Your password has been changed successfully.'
          }
        );
      }

      logger.info(`Password changed for ${userType}: ${user.email || user.phone}`);

      this.success(res, {
        message: 'Password changed successfully'
      });

    } catch (error) {
      logger.error('Change password error:', error);
      next(error);
    }
  }

  /**
   * Resend verification email
   */
  resendVerification = async (req, res, next) => {
    try {
      const { email, userType = 'user' } = req.body;

      const { user, token } = await authService.resendVerificationEmail(email, userType);

      // Send verification email (only for users with email)
      if (user.email && userType === 'user') {
        await emailService.sendEmail(
          user.email,
          'Verify Your Email',
          'emailVerification',
          {
            name: user.name,
            verificationUrl: `${process.env.FRONTEND_URL}/verify-email?token=${token}`
          }
        );
      }

      logger.info(`Verification email resent to ${userType}: ${email}`);

      this.success(res, {
        message: 'Verification email sent successfully'
      });

    } catch (error) {
      logger.error('Resend verification error:', error);
      next(error);
    }
  }

  /**
   * Logout user/runner
   */
  logout = async (req, res, next) => {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      const userType = req.user.role === 'runner' ? 'runner' : 'user';

      await ActivityLogger.logLogout(req.user, req.ip, req.get('User-Agent'), userType);

      if (token) {
        await authService.blacklistToken(token);
      }

      logger.info(`${userType} logged out: ${req.user.email || req.user.phone}`);

      this.success(res, {
        message: 'Logged out successfully'
      });

    } catch (error) {
      logger.error('Logout error:', error);
      next(error);
    }
  }

  /**
   * Request OTP for phone verification
   */
  requestPhoneVerification = async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { phone, userType = 'user' } = req.body;

      const otp = await authService.generatePhoneVerificationOTP(userId, phone, userType);

      // Send OTP via SMS
      await smsService.sendOTP(phone, otp);

      logger.info(`Phone verification OTP sent to ${userType}: ${phone}`);

      this.success(res, {
        message: 'Verification code sent to your phone'
      });

    } catch (error) {
      logger.error('Phone verification request error:', error);
      next(error);
    }
  }

  /**
   * Verify phone number with OTP
   */
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

  /**
   * Remove sensitive data from user object
   */
  _sanitizeUser(user) {
    if (!user) return null;

    const userObj = user.toObject ? user.toObject() : { ...user };

    delete userObj.password;
    delete userObj.__v;
    delete userObj.verificationToken;
    delete userObj.verificationExpires;
    delete userObj.resetPasswordToken;
    delete userObj.resetPasswordExpires;
    delete userObj.phoneVerificationOTP;
    delete userObj.phoneVerificationExpires;

    return userObj;
  }

  /**
   * Remove sensitive data from runner object
   */
  _sanitizeRunner(runner) {
    if (!runner) return null;

    const runnerObj = runner.toObject ? runner.toObject() : { ...runner };

    delete runnerObj.password;
    delete runnerObj.__v;
    delete runnerObj.verificationToken;
    delete runnerObj.verificationExpires;
    delete runnerObj.resetPasswordToken;
    delete runnerObj.resetPasswordExpires;
    delete runnerObj.phoneVerificationOTP;
    delete runnerObj.phoneVerificationExpires;

    return runnerObj;
  }
}

module.exports = new AuthController();