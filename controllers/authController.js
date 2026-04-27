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

const jwt = require('jsonwebtoken');

class AuthController extends BaseController {
  constructor() {
    super(authService);
    this.userService = userService;
    this.runnerService = runnerService;
    this.emailService = emailService;
    this.smsService = smsService;
  }

  setAuthCookies = async (res, accessToken, refreshToken) => {
    const isProd = process.env.NODE_ENV === 'production';

    res.cookie('token', accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax', // lax for local dev (http)
      maxAge: 15 * 60 * 1000 // 15 mins
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
  };



  // ─────────────────────────────────────────────
  // REGISTRATION
  // ─────────────────────────────────────────────

  register = async (req, res, next) => {
    console.log('Incoming user registration body:', req.body);
    try {
      const userData = req.body;
      const creatorRole = req.user?.role;

      const { user, token: tokens } = await authService.register(userData, creatorRole, 'user');

      // Skip verification for admins
      if (user.role === 'admin' || user.role === 'super-admin') {
        return this.created(res, {
          user: this._sanitizeUser(user),
          message: 'Admin registered successfully.',
          token: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        });
      }

      const verificationToken = await authService.generateVerificationToken(user._id, 'user');
      // const otp = await authService.generatePhoneVerificationOTP(user._id, userData.phone, 'user');
      const otp = await authService.generateEmailVerificationOTP(user._id, userData.email, 'user');

      logger.info('Sending EMAIL SMS', {
        to: userData.email,
        userId: user._id,
        userType: 'user',
        existing: !!user.existing,
        endpoint: 'register-user'
      });

      // Queue OTP SMS via Kafka
      // if (user.phone && !user.existing) {
      //   await sendSmsEvent({
      //     type: 'otp',
      //     to: user.phone,
      //     otp,
      //   });
      // }

      if (user.email && !user.existing) {
        await sendEmailEvent({
          type: 'otp',
          to: user.email,
          subject: 'Your Sendrey Verification Code',
          template: 'otpEmail',
          data: { name: user.firstName, otp },
        });
      }

      // send welcome email
      // if (user.email) {
      //   setImmediate(() => {
      //     const emailLinkToken = jwt.sign(
      //       { id: user._id, role: user.role },
      //       process.env.JWT_SECRET,
      //       { expiresIn: '7d' }
      //     );
      //     emailService.sendWelcomeEmail(
      //       { email: user.email, firstName: userData.firstName || user.firstName, name: userData.firstName || user.firstName },
      //       emailLinkToken,
      //     ).catch((err) => {
      //       console.error('Welcome email failed:', err.message);
      //     });
      //   });
      // }

      // Virtual account (non-blocking)
      try {
        await paymentService.createVirtualAccount(
          user._id, user.email, `${user.firstName} ${user.lastName}`
        );
      } catch (err) {
        console.error('Virtual account creation failed:', err.message);
      }

      this.setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

      logger.info(`User registered: ${user.phone}`);

      this.created(res, {
        user: this._sanitizeUser(user),
        message: 'Registration successful. Please check your email and phone for verification.',
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      });

    } catch (error) {
      logger.error('User registration error:', error);
      if (error.statusCode === 409) {
        return this.error(res, {
          message: 'Account already exists',
          userName: error.userName,
          userEmail: error.userEmail,
          userPhone: error.userPhone,
        }, 409);
      }
      next(error);
    }
  }

  registerRunner = async (req, res, next) => {
    console.log('Incoming runner registration body:', req.body);
    try {
      const runnerData = req.body;
      runnerData.role = 'runner';

      const { user: runner, token: tokens } = await authService.register(runnerData, null, 'runner');

      console.log('[registerRunner] runner.phone:', runner.phone, 'runnerData.phone:', runnerData.phone);

      const verificationToken = await authService.generateVerificationToken(runner._id, 'runner');
      // const otp = await authService.generatePhoneVerificationOTP(runner._id, runnerData.phone, 'runner');
      const otp = await authService.generateEmailVerificationOTP(runner._id, runnerData.email, 'runner');


      logger.info('Sending OTP SMS', {
        to: runnerData.phone,
        userId: runner._id,
        userType: 'runner',
        existing: !!runner.existing,
        endpoint: 'register-runner'
      });

      // Queue OTP SMS via Kafka
      // if (runnerData.phone && !runner.existing) {
      //   await sendSmsEvent({
      //     type: 'otp',
      //     to: runnerData.phone,
      //     otp,
      //   });
      // }

      if (runner.email) {
        await sendEmailEvent({
          type: 'otp',
          to: runner.email,
          subject: 'Your Sendrey Verification Code',
          template: 'otpEmail',
          data: { name: runner.firstName, otp },
        });
      }

      // welcome email
      // if (runner.email) {
      //   setImmediate(() => {
      //     const emailLinkToken = jwt.sign(
      //       { id: runner._id, role: runner.role },
      //       process.env.JWT_SECRET,
      //       { expiresIn: '7d' }
      //     );
      //     emailService.sendWelcomeEmail(
      //       { email: runner.email, firstName: runnerData.firstName || runner.firstName, name: runnerData.firstName || runner.firstName },
      //       emailLinkToken
      //     ).catch((err) => {
      //       console.error('Welcome email failed:', err.message);
      //     });
      //   })
      // }

      // Virtual account (non-blocking)
      if (!['admin', 'super-admin'].includes(runner.role)) {
        try {
          await paymentService.createVirtualAccount(
            runner._id, runner.email, `${runner.firstName} ${runner.lastName}`
          );
        } catch (err) {
          console.error('Virtual account creation failed:', err.message);
        }
      }

      this.setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

      logger.info(`Runner registered: ${runner.phone}`);

      this.created(res, {
        runner: this._sanitizeRunner(runner),
        message: 'Runner registration successful. Please verify your email or phone number.',
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      });

    } catch (error) {
      logger.error('User registration error:', error);
      if (error.statusCode === 409) {
        return this.error(res, {
          message: 'Account already exists',
          userName: error.userName,
          userEmail: error.userEmail,
          userPhone: error.userPhone,
          kycStatus: error.kycStatus,
        }, 409);
      }
      next(error);
    }
  }

  registerAdmin = async (req, res, next) => {
    try {
      const userData = { ...req.body, role: 'admin' };
      const { user, token: tokens } = await authService.register(userData, 'super-admin', 'user');

      logger.info(`Admin registered: ${user.email}`);


      // this.setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
      // remove tokens later
      return this.created(res, {
        user: this._sanitizeUser(user),
        message: 'Admin registered successfully.',
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      });
    } catch (error) {
      logger.error('Admin registration error:', error);
      next(error);
    }
  }


  // ─────────────────────────────────────────────
  // LOGIN
  // ─────────────────────────────────────────────

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
      const { refreshToken } = this.service.generateTokens(user);

      if (userType === 'user') {
        await User.findByIdAndUpdate(user._id, { refreshToken });
        await userService.updateLastLogin(user._id);
      } else {
        await Runner.findByIdAndUpdate(user._id, { refreshToken });
        await runnerService.updateLastLogin(user._id);
      }

      const response = userType === 'user' ? this._sanitizeUser(user) : this._sanitizeRunner(user);

      this.setAuthCookies(res, token, refreshToken);

      logger.info(`${userType} logged in: ${user.email || user.phone}`);

      this.success(res, {
        [userType]: response,
        userType,
        message: 'Login successful',
        accessToken: token,
        refreshToken,
      });

    } catch (error) {
      next(error);
    }
  }

  adminLogin = async (req, res, next) => {
    try {
      const { email, password } = req.body;

      console.log('adminLogin attempt:', { email, password: password?.length });
      const admin = await User.findOne({
        email,
        role: { $in: ['admin', 'super-admin'] }
      }).select('+password');

      const anyUser = await User.findOne({ email });
      console.log('anyUser found:', anyUser?.email, 'role:', anyUser?.role, 'isActive:', anyUser?.isActive);
      console.log('admin found:', !!admin);

      if (!admin) throw new Error('Invalid admin credentials');
      if (!admin.isActive) throw new Error('Admin account has been deactivated');

      const isPasswordValid = await bcrypt.compare(password, admin.password);
      if (!isPasswordValid) throw new Error('Invalid admin credentials');

      const { accessToken, refreshToken } = this.service.generateTokens(admin);
      await User.findByIdAndUpdate(admin._id, { refreshToken });
      await this.userService.updateLastLogin(admin._id);

      logger.info(`Admin logged in: ${email}`);

      // this.setAuthCookies(res, accessToken, refreshToken);
      this.success(res, {
        user: this._sanitizeUser(admin),
        token: accessToken,
        refreshToken,
        message: 'Admin login successful'
      });

    } catch (error) {
      logger.error('Admin login error:', error);
      next(error);
    }
  }

  logout = async (req, res, next) => {
    try {
      const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
      const userType = req.user.role === 'runner' ? 'runner' : 'user';

      await ActivityLogger.logLogout(req.user, req.ip, req.get('User-Agent'), userType);
      if (token) await authService.blacklistToken(token);

      res.clearCookie('token');
      res.clearCookie('refreshToken', { path: '/api/v1/auth/refresh-token' });

      logger.info(`${userType} logged out: ${req.user.email || req.user.phone}`);
      this.success(res, { message: 'Logged out successfully' });

    } catch (error) {
      logger.error('Logout error:', error);
      next(error);
    }
  }


  // ─────────────────────────────────────────────
  // TOKEN & SESSION
  // ─────────────────────────────────────────────

  refreshToken = async (req, res, next) => {
    try {
      // read from cookie, not req.body
      const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
      if (!refreshToken) return this.error(res, 'Refresh token required', 401);

      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

      // check both User and Runner since either could be refreshing
      let user = await User.findById(decoded.id).select('+refreshToken');
      let isRunner = false;

      if (!user) {
        user = await Runner.findById(decoded.id).select('+refreshToken');
        isRunner = true;
      }

      if (!user || user.refreshToken !== refreshToken) {
        return this.error(res, 'Invalid refresh token', 401);
      }

      const { accessToken, refreshToken: newRefresh } = this.service.generateTokens(user);

      const Model = isRunner ? Runner : User;
      await Model.findByIdAndUpdate(user._id, { refreshToken: newRefresh });

      // set new cookies
      this.setAuthCookies(res, accessToken, newRefresh);

      return this.success(res, {
        message: 'Token refreshed',
        accessToken,
        refreshToken: newRefresh,
      });
    } catch (err) {
      return this.error(res, 'Invalid or expired refresh token', 401);
    }
  }

  verifyEmailToken = async (req, res, next) => {
    try {
      const { token } = req.body;
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // console.log('JWT_SECRET in use:', process.env.JWT_SECRET);
      // console.log('token received:', token);

      // Team invite token — different flow
      if (decoded.type === 'team_invite') {
        let entity = await User.findById(decoded.id);
        let isRunner = false;
        if (!entity) { entity = await Runner.findById(decoded.id); isRunner = true; }
        if (!entity) return this.error(res, 'User not found', 404);

        const { accessToken, refreshToken } = this.service.generateTokens(entity);
        const Model = isRunner ? Runner : User;
        await Model.findByIdAndUpdate(entity._id, { refreshToken });

        this.setAuthCookies(res, accessToken, refreshToken);

        return this.success(res, {
          [isRunner ? 'runner' : 'user']: isRunner
            ? this._sanitizeRunner(entity)
            : this._sanitizeUser(entity),
          isVerified: entity.isPhoneVerified,
          isRunner,
          isTeamInvite: true,
          invite: entity.pendingBusinessInvite,
        });
      }

      // Normal email link token
      let entity = await User.findById(decoded.id);
      let isRunner = false;
      if (!entity) { entity = await Runner.findById(decoded.id); isRunner = true; }
      if (!entity) return this.error(res, 'User not found', 404);

      const { accessToken: sessionToken, refreshToken } = this.service.generateTokens(entity);
      const Model = isRunner ? Runner : User;
      await Model.findByIdAndUpdate(entity._id, { refreshToken });

      return this.success(res, {
        [isRunner ? 'runner' : 'user']: isRunner
          ? this._sanitizeRunner(entity)
          : this._sanitizeUser(entity),
        isVerified: entity.isPhoneVerified,
        isRunner,
      });

    } catch (err) {
      return this.error(res, 'Invalid or expired link', 400);
    }
  }

  me = async (req, res, next) => {
    try {
      const userId = req.user.id;
      const userType = req.user.role === 'runner' ? 'runner' : 'user';

      let entity;
      if (userType === 'runner') {
        entity = await Runner.findById(userId).lean();
      } else {
        entity = await User.findById(userId).lean();
      }

      if (!entity) return this.error(res, 'User not found', 404);

      return this.success(res, {
        [userType]: userType === 'runner' ? this._sanitizeRunner(entity) : this._sanitizeUser(entity),
        userType,
      });
    } catch (error) {
      next(error);
    }
  }

  runnerMe = async (req, res, next) => {
    try {
      const runner = await Runner.findById(req.user.id)
        .select('-password -refreshToken -verificationToken -resetPasswordToken -phoneVerificationOTP')
        .lean();

      if (!runner) return this.error(res, 'Runner not found', 404);

      const kycStatus = {
        overallStatus: runner.runnerStatus,
        nin: {
          status: runner.verificationDocuments?.nin?.status ?? 'not_submitted',
          verified: runner.verificationDocuments?.nin?.verified ?? false,
          submittedAt: runner.verificationDocuments?.nin?.submittedAt ?? null,
          verifiedAt: runner.verificationDocuments?.nin?.verifiedAt ?? null,
          rejectionReason: runner.verificationDocuments?.nin?.rejectionReason ?? null,
        },
        driverLicense: {
          status: runner.verificationDocuments?.driverLicense?.status ?? 'not_submitted',
          verified: runner.verificationDocuments?.driverLicense?.verified ?? false,
          submittedAt: runner.verificationDocuments?.driverLicense?.submittedAt ?? null,
          verifiedAt: runner.verificationDocuments?.driverLicense?.verifiedAt ?? null,
          expiryDate: runner.verificationDocuments?.driverLicense?.expiryDate ?? null,
          rejectionReason: runner.verificationDocuments?.driverLicense?.rejectionReason ?? null,
        },
        biometric: {
          status: runner.biometricVerification?.status ?? 'not_submitted',
          selfieVerified: runner.biometricVerification?.selfieVerified ?? false,
          livenessPassed: runner.biometricVerification?.livenessPassed ?? false,
          faceMatchScore: runner.biometricVerification?.faceMatchScore ?? null,
          submittedAt: runner.biometricVerification?.submittedAt ?? null,
          verifiedAt: runner.biometricVerification?.selfieVerifiedAt ?? null,
          rejectionReason: runner.biometricVerification?.rejectionReason ?? null,
        },
      };

      return this.success(res, { runner: this._sanitizeRunner(runner), kycStatus });
    } catch (error) {
      next(error);
    }
  };

  userMe = async (req, res, next) => {
    try {
      const user = await User.findById(req.user.id)
        .select('-password -refreshToken -verificationToken -resetPasswordToken -phoneVerificationOTP')
        .lean();

      if (!user) return this.error(res, 'User not found', 404);

      return this.success(res, { user: this._sanitizeUser(user) });
    } catch (error) {
      next(error);
    }
  }

  checkExistingUserOrRunner = async (req, res, next) => {
    try {
      const { email, userType = 'runner' } = req.body;
      const result = await authService.checkExistingUserOrRunner(email, userType);
      this.success(res, result);
    } catch (error) {
      next(error);
    }
  }


  sendReturningUserEmailOTP = async (req, res, next) => {
    try {
      const { email, userType = 'user', latitude, longitude } = req.body;

      const runner = await Runner.findOne({ email: email.toLowerCase() });
      if (!runner) return res.status(404).json({ message: 'Runner not found' });

      if (latitude && longitude) {
        await Runner.findByIdAndUpdate(runner._id, {
          latitude,
          longitude,
          location: { type: 'Point', coordinates: [longitude, latitude] }
        });
      }

      try {
        const { user, otp, kycStatus } = await authService.sendReturningUserOTP(email, userType);

        await sendEmailEvent({
          type: 'otp',
          to: user.email,
          subject: 'Your Sendrey Verification Code',
          template: 'returningUserVerification',
          data: { name: user.firstName, otp, year: new Date().getFullYear() },
        });

        logger.info(`Returning ${userType} OTP sent: ${email}`);
      } catch (innerErr) {
        // swallow — don't reveal whether account exists
        logger.warn(`sendReturningUserOTP silenced: ${innerErr.message}`);
      }

      // always return the same response regardless of outcome
      this.success(res, {
        message: 'If this account exists, an OTP has been sent.',
        fleetType: runner.fleetType,
      });

    } catch (error) {
      logger.error('Resend OTP for returning user error:', error);
      next(error);
    }
  }

  // ─────────────────────────────────────────────
  // PASSWORD
  // ─────────────────────────────────────────────

  forgotPassword = async (req, res, next) => {
    try {
      const { email, phone, userType = 'user' } = req.body;

      const resetToken = await authService.generatePasswordResetToken(email, phone, userType);
      if (!resetToken) {
        return this.success(res, { message: 'If the phone or email exists, password reset instructions have been sent' });
      }

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


  // ─────────────────────────────────────────────
  // EMAIL VERIFICATION
  // ─────────────────────────────────────────────

  verifyEmail = async (req, res, next) => {
    try {
      const { token, userType = 'user' } = req.body;
      const user = await authService.verifyEmail(token, userType);

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

  verifyEmailOTP = async (req, res, next) => {
    try {
      const { otp } = req.body;
      const userType = req.body.userType || 'user';
      console.log('[verifyEmailOTP] received:', { otp, userType, body: req.body });

      const user = await authService.verifyEmailOTPCode(otp, userType);
      logger.info(`${userType} email verified via OTP: ${user.email}`);

      const { accessToken, refreshToken } = this.service.generateTokens(user);

      const Model = userType === 'runner' ? Runner : User;
      await Model.findByIdAndUpdate(user._id, { refreshToken }); // persist token
      this.setAuthCookies(res, accessToken, refreshToken)

      this.success(res, {
        [userType]: userType === 'user' ? this._sanitizeUser(user) : this._sanitizeRunner(user),
        message: 'Email verified successfully',
        accessToken,
        refreshToken,
      });

    } catch (error) {
      logger.error('Email OTP verification error:', error);
      next(error);
    }
  }

  requestEmailVerification = async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { email, userType = 'user' } = req.body;

      const token = await authService.generateVerificationToken(userId, userType);

      await sendEmailEvent({
        type: 'email-verification',
        to: email,
        subject: 'Verify Your Sendrey Email',
        template: 'emailVerification',
        data: {
          name: req.user.firstName,
          verificationToken: token,
          verificationUrl: `${process.env.FRONTEND_URL}/verify-email?token=${token}`,
        },
      });

      logger.info(`Email verification token queued for ${userType}: ${email}`);
      this.success(res, { message: 'Verification email sent to your inbox' });

    } catch (error) {
      logger.error('Email verification request error:', error);
      next(error);
    }
  }

  resendEmailVerification = async (req, res, next) => {
    try {
      const { email, userType = 'user' } = req.body;
      const { user, token } = await authService.resendVerificationEmail(email, userType);

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
      logger.error('Resend email verification error:', error);
      if (error.statusCode) {
        return this.error(res, { message: error.message }, error.statusCode);
      }

      next(error);
    }
  }

  resendVerification = async (req, res, next) => {
    try {
      const { email, userType = 'user' } = req.body;
      const { user, token } = await authService.resendVerificationEmail(email, userType);

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


  // ─────────────────────────────────────────────
  // PHONE VERIFICATION
  // ─────────────────────────────────────────────

  requestPhoneVerification = async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { phone, userType = 'user' } = req.body;

      const otp = await authService.generatePhoneVerificationOTP(userId, phone, userType);

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

  resendPhoneVerification = async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { phone, userType = 'user' } = req.body;

      const otp = await authService.generatePhoneVerificationOTP(userId, phone, userType);

      await sendSmsEvent({
        type: 'otp',
        to: phone,
        otp,
      });

      logger.info(`Phone verification OTP resent for ${userType}: ${phone}`);
      this.success(res, { message: 'Verification code resent to your phone' });

    } catch (error) {
      logger.error('Resend phone verification error:', error);
      next(error);
    }
  }


  // ─────────────────────────────────────────────
  // SANITIZERS
  // ─────────────────────────────────────────────

  _sanitizeUser(user) {
    if (!user) return null;
    const userObj = user.toObject ? user.toObject() : { ...user };
    delete userObj.password; delete userObj.__v;
    delete userObj.verificationToken; delete userObj.verificationExpires;
    delete userObj.resetPasswordToken; delete userObj.resetPasswordExpires;
    delete userObj.phoneVerificationOTP; delete userObj.phoneVerificationExpires;

    userObj.hasPinSet = !!userObj.pin;
    delete userObj.pin;

    return userObj;
  }

  _sanitizeRunner(runner) {
    if (!runner) return null;
    const runnerObj = runner.toObject ? runner.toObject() : { ...runner };
    delete runnerObj.password; delete runnerObj.__v;
    delete runnerObj.verificationToken; delete runnerObj.verificationExpires;
    delete runnerObj.resetPasswordToken; delete runnerObj.resetPasswordExpires;
    delete runnerObj.phoneVerificationOTP; delete runnerObj.phoneVerificationExpires;

    runnerObj.hasPinSet = !!runnerObj.pin;
    delete runnerObj.pin;
    return runnerObj;
  }
}

module.exports = new AuthController();