const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const Runner = require('../models/Runner');
const Wallet = require('../models/Wallet')
const config = require('../config');
const logger = require('../utils/logger');

class AuthService {
  /**
   * Register new user or runner
   */
  async register(userData, creatorUserRole, userType = 'user') {
    try {
      // Determine which model to use
      const Model = userType === 'runner' ? Runner : User;

      // Check if user/runner already exists
      const conditions = [];
      if (userData.email) conditions.push({ email: userData.email });
      if (userData.phone) conditions.push({ phone: userData.phone });

      const existingUser = conditions.length
        ? await Model.findOne({ $or: conditions })
        : null;

      if (existingUser) {
        if (!existingUser.isVerified) {
          const token = this.generateTokens(existingUser);
          return { user: existingUser, token, existing: true };
        }
        const err = new Error('Account already exists');
        err.statusCode = 409;
        err.userName = existingUser.firstName;
        err.userEmail = existingUser.email;
        err.userPhone = existingUser.phone;
        console.log('Existing user', existingUser.firstName)

        // runnerkycs
        err.kycStatus = {
          isVerified: existingUser.isVerified,
          isEmailVerified: existingUser.isEmailVerified,
          ninStatus: existingUser.verificationDocuments?.nin?.status || 'not_submitted',
          driverLicenseStatus: existingUser.verificationDocuments?.driverLicense?.status || 'not_submitted',
          selfieVerified: existingUser.biometricVerification?.selfieVerified || false,
          selfieStatus: existingUser.biometricVerification?.status || 'not_submitted',
        };

        console.log('Existing user found during registration:', {
            isVerified: existingUser.isVerified,
            isEmailVerified: existingUser.isEmailVerified,
            ninStatus: existingUser.verificationDocuments?.nin?.status || 'not_submitted',
            driverLicenseStatus: existingUser.verificationDocuments?.driverLicense?.status || 'not_submitted',
            selfieVerified: existingUser.biometricVerification?.selfieVerified || false,
            selfieStatus: existingUser.biometricVerification?.status || 'not_submitted',
        });
        throw err;
      }

      // Handle role assignment
      let role = userType;

      if (userType === 'user') {
        if (userData.role === 'admin' || userData.role === 'super-admin') {
          // Only allow if request comes from an existing admin
          if (!creatorUserRole || !['admin', 'super-admin'].includes(creatorUserRole)) {
            // Silently downgrade to regular user instead of throwing
            role = 'user';
          } else if (userData.role === 'admin') {
            role = 'admin';
          } else if (userData.role === 'super-admin') {
            const existingSuperAdmin = await Model.findOne({ role: 'super-admin' });
            if (existingSuperAdmin) {
              throw new Error('Super admin already exists');
            }
            role = 'super-admin';
          }
        }
      } else if (userType === 'runner') {
        // Runner-specific role handling
        role = 'runner'; // Always 'runner' for runner model
      }

      const userDataWithLocation = {
        ...userData,
        role,
        isAvailable: true,
        isOnline: true,
        isVerified: ['admin', 'super-admin'].includes(role) ? true : false,
        isActive: true
      };

      if (userData.latitude && userData.longitude) {
        userDataWithLocation.location = {
          type: 'Point',
          coordinates: [userData.longitude, userData.latitude]
        };
      }

      // Create user/runner
      const user = await Model.create(userDataWithLocation);

      // Create wallet for users and runners only (not admins)
      if (!['admin', 'super-admin'].includes(role)) {
        await Wallet.create({
          userId: user._id,
          userType: userType === 'runner' ? 'runner' : 'user',
          balance: 0,
          lockedBalance: 0,
        });
      }

      // Generate JWT token (skip for admins created by non-admins)
      let token;
      if (['admin', 'super-admin'].includes(role)) {
        // always generate token for admins
        token = this.generateTokens(user);
      } else if (userType === 'runner') {
        token = this.generateTokens(user);
      } else {
        // regular user
        token = this.generateTokens(user);
      }

      return { user, token };
    } catch (error) {
      logger.error(`AuthService - ${userType} Register error:`, error);
      throw error;
    }
  }

  /**
   * Single login for both user and runner (auto-detect)
   */
  async login(email, phone, password) {
    try {
      // Try to find as user first
      let user = await User.findOne({
        $or: [
          { email: email || '' },
          { phone: phone || '' }
        ]
      }).select('+password');

      let userType = 'user';

      // If not found as user, try as runner
      if (!user) {
        user = await Runner.findOne({
          $or: [
            { email: email || '' },
            { phone: phone || '' }
          ]
        }).select('+password');
        userType = 'runner';
      }

      if (!user) {
        throw new Error('Invalid credentials or account does not exist');
      }

      // Check if account is active
      if (!user.isActive) {
        throw new Error('Account has been deactivated');
      }

      // Check verification status (skip for admins)
      if (userType === 'user' && !['admin', 'super-admin'].includes(user.role) && !user.isVerified) {
        throw new Error('Please verify your email before logging in');
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        throw new Error('Invalid credentials');
      }

      // Generate JWT token
      const token = this.generateTokens(user);

      return { user, token, userType };
    } catch (error) {
      logger.error('AuthService - Login error:', error);
      throw error;
    }
  }

  /**
   * Generate JWT token
   */
  generateToken = (user) => {
    return jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );
  };

  generateTokens = (user) => {
    const accessToken = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );
    const refreshToken = jwt.sign(
      { id: user._id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.JWT_REFRESH_TOKEN_EXPIRES_IN }
    );
    return { accessToken, refreshToken };
  };

  /**
   * Generate email verification token
   */
  async generateVerificationToken(userId, userType = 'user') {
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const Model = userType === 'runner' ? Runner : User;

    await Model.findByIdAndUpdate(userId, {
      verificationToken: token,
      verificationExpires: expires
    });

    return token;
  }

  /**
   * Verify email with token
   */
  async verifyEmail(token, userType = 'user') {
    const Model = userType === 'runner' ? Runner : User;

    const user = await Model.findOne({
      verificationToken: token,
      verificationExpires: { $gt: Date.now() }
    });

    if (!user) {
      throw new Error('Invalid or expired verification token');
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationExpires = undefined;
    await user.save();

    return user;
  }

  /**
 * Generate OTP for email verification
 */
  async generateEmailVerificationOTP(userId, email, userType = 'user') {
    const otp = crypto.randomInt(100000, 999999).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const Model = userType === 'runner' ? Runner : User;

    const updated = await Model.findByIdAndUpdate(userId, {
      emailVerificationOTP: otp,
      emailVerificationExpires: expires,
    }, { new: true }).select('+emailVerificationOTP');

    console.log('[generateEmailVerificationOTP] saved OTP:', updated?.emailVerificationOTP);

    return otp;
  }

  /**
   * Verify email OTP
   */
  async verifyEmailOTPCode(otp, userType = 'user') {
    const Model = userType === 'runner' ? Runner : User;

    const all = await Model.find({ emailVerificationExpires: { $gt: Date.now() } })
      .lean();
    console.log('[verifyEmailOTPCode] active OTP docs:', all.map(u => ({
      id: u._id,
      email: u.email,
      otp: u.emailVerificationOTP,
      expires: u.emailVerificationExpires,
      incomingOtp: otp,
      match: u.emailVerificationOTP === otp,
    })));

    const user = await Model.findOne({
      emailVerificationOTP: otp,
      emailVerificationExpires: { $gt: Date.now() }
    }).lean();

    if (!user) {
      throw new Error('Invalid or expired OTP');
    }

    await Model.findByIdAndUpdate(user._id, {
      $set: { isVerified: true, isEmailVerified: true },
      $unset: { emailVerificationOTP: 1, emailVerificationExpires: 1 }
    });

    // fetch clean doc to return
    return Model.findById(user._id);
  }

  async sendReturningUserOTP(email, userType = 'user') {
    const Model = userType === 'runner' ? Runner : User;

    const user = await Model.findOne({ email });
    if (!user) throw new Error('Account not found');

    const otp = await this.generateEmailVerificationOTP(user._id, email, userType);

    const kycStatus = userType === 'runner' ? {
      isVerified: user.isVerified,
      isEmailVerified: user.isEmailVerified,
      // isPhoneVerified: user.isPhoneVerified,
      ninStatus: user.verificationDocuments?.nin?.status || 'not_submitted',
      driverLicenseStatus: user.verificationDocuments?.driverLicense?.status || 'not_submitted',
      selfieVerified: user.biometricVerification?.selfieVerified || false,
    } : {
      isVerified: user.isVerified,
      // isPhoneVerified: user.isPhoneVerified,
      isEmailVerified: user.isEmailVerified,
    };

    return { user, otp, kycStatus };
  }

  async checkExistingUserOrRunner(email, userType = 'runner') {
    const Model = userType === 'runner' ? Runner : User;
    const user = await Model.findOne({ email });
    if (!user) throw new Error('Account not found');

    return {
      userName: user.firstName,
      kycStatus: {
        isVerified: user.isVerified,
        isEmailVerified: user.isEmailVerified,
        ninStatus: user.verificationDocuments?.nin?.status || 'not_submitted',
        driverLicenseStatus: user.verificationDocuments?.driverLicense?.status || 'not_submitted',
        selfieVerified: user.biometricVerification?.selfieVerified || false,
      }
    };
  }

  /**
   * Generate password reset token
   */
  async generatePasswordResetToken(email, phone, userType = 'user') {
    const Model = userType === 'runner' ? Runner : User;

    const user = await Model.findOne({
      $or: [
        { email: email || '' },
        { phone: phone || '' }
      ]
    });

    if (!user) {
      // Don't reveal if user exists
      return;
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    user.resetPasswordToken = token;
    user.resetPasswordExpires = expires;
    await user.save();

    return token;
  }

  /**
   * Reset password with token
   */
  async resetPassword(token, newPassword, userType = 'user') {
    const Model = userType === 'runner' ? Runner : User;

    const user = await Model.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      throw new Error('Invalid or expired reset token');
    }

    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    return user;
  }

  /**
   * Change password for authenticated user/runner
   */
  async changePassword(userId, currentPassword, newPassword, userType = 'user') {
    const Model = userType === 'runner' ? Runner : User;

    const user = await Model.findById(userId).select('+password');

    if (!user) {
      throw new Error(`${userType} not found`);
    }

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      throw new Error('Current password is incorrect');
    }

    user.password = newPassword;
    await user.save();

    return user;
  }

  /**
   * Resend verification email
   */
  async resendVerificationEmail(email, userType = 'user') {
    const Model = userType === 'runner' ? Runner : User;

    const user = await Model.findOne({ email: email || '' });

    if (!user) {
      throw new Error(`${userType} not found`);
    }

    if (user.isVerified) {
      throw new Error('Email is already verified');
    }

    const token = await this.generateVerificationToken(user._id, userType);
    return { user, token };
  }

  /**
   * Generate OTP for phone verification
   */
  async generatePhoneVerificationOTP(userId, phone, userType = 'user') {
    const otp = crypto.randomInt(100000, 999999).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const Model = userType === 'runner' ? Runner : User;

    await Model.findByIdAndUpdate(userId, {
      phoneVerificationOTP: otp,
      phoneVerificationExpires: expires,
    });

    return otp;
  }

  /**
   * Verify phone OTP
   */
  async verifyPhoneOTP(userId, otp, userType = 'user') {
    const Model = userType === 'runner' ? Runner : User;

    const user = await Model.findOne({
      _id: userId,
      phoneVerificationOTP: otp,
      phoneVerificationExpires: { $gt: Date.now() }
    });

    if (!user) {
      throw new Error('Invalid or expired OTP');
    }

    user.isPhoneVerified = true;
    user.phoneVerificationOTP = undefined;
    user.phoneVerificationExpires = undefined;
    await user.save();

    return user;
  }

  /**
   * Blacklist token (for logout)
   */
  async blacklistToken(token) {
    logger.info(`Token blacklisted: ${token.substring(0, 20)}...`);
    return true;
  }

}

module.exports = new AuthService();