const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const Runner = require('../models/Runner');
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
        if (userData.email && existingUser.email === userData.email) {
          throw new Error('Email already registered');
        } else if (userData.phone && existingUser.phone === userData.phone) {
          throw new Error('Phone number already registered');
        }
      }

      // Handle role assignment
      let role = userType;

      if (userType === 'user') {

        if (userData.role === 'admin') {
          role = 'admin';
          if (!creatorUserRole || !['admin', 'super-admin'].includes(creatorUserRole)) {
            console.log('⚠️ Admin created without proper authorization');
          }
        }

        if (userData.role === 'super-admin' && !creatorUserRole) {
          const existingSuperAdmin = await Model.findOne({ role: 'super-admin' });
          if (existingSuperAdmin) {
            throw new Error('Super admin already exists');
          }
          role = 'super-admin';
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

      // Generate JWT token (skip for admins created by non-admins)
      let token;
      if (userType === 'user' && !['admin', 'super-admin'].includes(creatorUserRole)) {
        token = this.generateToken(user);
      } else if (userType === 'runner') {
        token = this.generateToken(user);
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
      const token = this.generateToken(user);

      return { user, token, userType };
    } catch (error) {
      logger.error('AuthService - Login error:', error);
      throw error;
    }
  }

  /**
   * Generate JWT token
   */
  generateToken(user) {
    return jwt.sign(
      {
        id: user._id,
        email: user.email,
        phone: user.phone,
        role: user.role,
        userType: user.role === 'runner' ? 'runner' : 'user' // Add userType to token
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );
  }

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

    const update = {
      phoneVerificationOTP: otp,
      phoneVerificationExpires: expires
    };
    
    if (phone) {
      update.phone = phone;
    }
    await Model.findByIdAndUpdate(userId, update);

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