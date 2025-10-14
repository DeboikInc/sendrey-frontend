const BaseController = require('./baseController');
const authService = require('../services/authService');
const userService = require('../services/userService');
const emailService = require('../services/emailService');
const smsService = require('../services/smsService');
const logger = require('../utils/logger');
const ActivityLogger = require('../utils/activityLogger');


class AuthController extends BaseController {
  constructor() {
    super(authService);
    this.userService = userService;
    this.emailService = emailService;
    this.smsService = smsService;

    // Bind methods to maintain 'this' context
    this.register = this.register.bind(this);
    this.login = this.login.bind(this);
    this.verifyEmail = this.verifyEmail.bind(this);
    this.forgotPassword = this.forgotPassword.bind(this);
    this.resetPassword = this.resetPassword.bind(this);
    this.changePassword = this.changePassword.bind(this);
    this.logout = this.logout.bind(this);
    this.resendVerification = this.resendVerification.bind(this);
    this.requestPhoneVerification = this.requestPhoneVerification.bind(this);
    this.verifyPhone = this.verifyPhone.bind(this);
  }

  /**
   * Register a new user
   */
  async register(req, res, next) {
    try {
      const userData = req.body;
      const userRole = req.user?.role
      // Create user
      const { user, token } = await authService.register(userData, userRole);

      // Generate verification token
      const verificationToken = await authService.generateVerificationToken(user._id);

      const otp = await authService.generatePhoneVerificationOTP(user._id, userData.phone);

      // Send email token and
      // Send OTP via SMS
      userData.email ? await emailService.sendEmailVerification(user, verificationToken) : await smsService.sendOTP(userData.phone, otp);

      // Remove sensitive data from response
      const userResponse = this._sanitizeUser(user);

      logger.info(`User registered successfully: ${user.phone}`);

      this.created(res, {
        user: userResponse,
        token,
        message: 'Registration successful. Please check your email for verification.'
      });

    } catch (error) {
      logger.error('Registration error:', error);
      next(error);
    }
  }

  /**
   * Login user
   */
  async login(req, res, next) {
    try {
      const { email, password, phone } = req.body;

      // Authenticate user
      const { user, token } = await authService.login(email, password, phone);

      const ip = req.ip;
      const userAgent = req.get('User-Agent');

      const otp = await authService.generatePhoneVerificationOTP(user._id, phone);

      // Send OTP via SMS and email
      userData.email ? await emailService.sendOTPEmail(user, otp) : await smsService.sendOTP(phone, otp);

      // Update last login
      await userService.updateLastLogin(user._id);

      // Log successful login
      await ActivityLogger.logLogin(user, ip, userAgent, 'success');

      // Remove sensitive data from response
      const userResponse = this._sanitizeUser(user);

      logger.info(`User logged in: ${user.email}`);

      this.success(res, {
        user: userResponse,
        token,
        message: 'Login successful'
      });

    } catch (error) {
      try {
        const user = await userService.getUserByEmail(email).catch(() => null);
        if (user) {
          await ActivityLogger.logLogin(user, req.ip, req.get('User-Agent'), 'failed');
        }
      } catch (logError) {
        logger.error('Failed to log login attempt:', logError);
      }
      next(error);
    }
  }

  /**
   * Verify email address
   */
  async verifyEmail(req, res, next) {
    try {
      const { token } = req.body;

      const user = await authService.verifyEmail(token);

      // Send confirmation email
      await emailService.sendEmail(
        user.email,
        'Email Verified Successfully',
        'emailVerified',
        { name: user.name }
      );

      logger.info(`Email verified: ${user.email}`);

      this.success(res, {
        user: this._sanitizeUser(user),
        message: 'Email verified successfully'
      });

    } catch (error) {
      logger.error('Email verification error:', error);
      next(error);
    }
  }

  /**
   * Forgot password - send reset email
   */
  async forgotPassword(req, res, next) {
    try {
      const { email, phone } = req.body;

      // Generate password reset token
      const resetToken = await authService.generatePasswordResetToken(email, phone);

      // Get user for email
      const user = await userService.getUserByEmail(email, phone);

      // If user has phone, send SMS notification
      if (user.email) {
        // Send password reset email
        await emailService.sendPasswordResetEmail(user, resetToken);
      } else {
        // send password reset sms
        await smsService.sendPasswordResetSMS(phone, resetToken)
      }

      logger.info(`Password reset requested for: ${phone}`);

      this.success(res, {
        message: 'Password reset instructions sent to your phone'
      });

    } catch (error) {
      // Don't reveal if email exists or not
      logger.error('Forgot password error:', error);
      this.success(res, {
        message: 'If the phone or email exists, password reset instructions have been sent'
      });
    }
  }

  /**
   * Reset password with token
   */
  async resetPassword(req, res, next) {
    try {
      const { token, newPassword } = req.body;

      const user = await authService.resetPassword(token, newPassword);

      if (user.email) {
        // Send confirmation email
        await emailService.sendEmail(
          user.email,
          'Password Reset Successful',
          'passwordResetSuccess',
          { name: user.name }
        );
      } else {
        // Send SMS notification
        await smsService.sendSMS(
          user.phone,
          'alert',
          {
            message: 'Your password has been reset successfully. If you did not do this, please contact support immediately.'
          }
        );
      }

      logger.info(`Password reset successful for: ${user.phone}`);

      this.success(res, {
        message: 'Password reset successfully'
      });

    } catch (error) {
      logger.error('Reset password error:', error);
      next(error);
    }
  }

  /**
   * Change password (authenticated user)
   */
  async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user.id;

      const user = await authService.changePassword(userId, currentPassword, newPassword);

      if (user.email) {
        // Send notification email
        await emailService.sendEmail(
          user.email,
          'Password Changed',
          'passwordChanged',
          { name: user.name }
        );
      } else {

        // Send SMS notification
        await smsService.sendSMS(
          user.phone,
          'alert',
          {
            message: 'Your password has been changed successfully.'
          }
        );
      }

      logger.info(`Password changed for user: ${user.phone}`);

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
  async resendVerification(req, res, next) {
    try {
      const { email } = req.body;

      const { user, token } = await authService.resendVerificationEmail(email);

      // Send verification email
      await emailService.sendEmail(
        user.email,
        'Verify Your Email',
        'emailVerification',
        {
          name: user.name,
          verificationUrl: `${process.env.FRONTEND_URL}/verify-email?token=${token}`
        }
      );

      logger.info(`Verification email resent to: ${email}`);

      this.success(res, {
        message: 'Verification email sent successfully'
      });

    } catch (error) {
      logger.error('Resend verification error:', error);
      next(error);
    }
  }

  /**
   * Logout user (optional - for token blacklisting)
   */
  async logout(req, res, next) {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      await ActivityLogger.logLogout(req.user, req.ip, req.get('User-Agent'));

      if (token) {
        await authService.blacklistToken(token);
      }

      logger.info(`User logged out: ${req.user.email}`);

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
  async requestPhoneVerification(req, res, next) {
    try {
      const userId = req.user.id;
      const { phone } = req.body;

      const otp = await authService.generatePhoneVerificationOTP(userId, phone);

      // Send OTP via SMS
      await smsService.sendOTP(phone, otp);

      logger.info(`Phone verification OTP sent to: ${phone}`);

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
  async verifyPhone(req, res, next) {
    try {
      const userId = req.user.id;
      const { otp } = req.body;

      const user = await authService.verifyPhoneOTP(userId, otp);

      logger.info(`Phone verified for user: ${user.email}`);

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
}

module.exports = new AuthController();