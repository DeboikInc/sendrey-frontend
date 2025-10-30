const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const config = require('../config');
const logger = require('../utils/logger');

class AuthService {
  /**
   * Register new user
   */
  async register(userData, userRole) {
    try {
      // Check if user already exists
      const conditions = [];

      if (userData.email) conditions.push({ email: userData.email });
      if (userData.phone) conditions.push({ phone: userData.phone });

      const existingUser = conditions.length
        ? await User.findOne({ $or: conditions })
        : null;

      if (existingUser) {
        if (userData.email && existingUser.email === userData.email) {
          throw new Error('Email already registered');
        } else if (userData.phone && existingUser.phone === userData.phone) {
          throw new Error('Phone number already registered');
        }
      }

      // Create user
      const user = new User(userData);
      await user.save();

      let token;

      if (!['manager', 'admin', 'super-admin'].includes(userRole)) {
        // Generate JWT token
        token = this.generateToken(user)
      }

      return { user, token };
    } catch (error) {
      logger.error('AuthService - Register error:', error);
      throw error;
    }
  }

  /**
   * Login user
   */
  async login(email, phone, password) {
    try {
      // Find user
      const user = await User.findOne({
        $or: [
          { email },
          { phone }
        ]
      }).select('+password');

      if (!user) {
        throw new Error('Invalid credentials or user does not exist');
      }

      // Check if user is verified
      if (!user.isVerified) {
        throw new Error('Please verify your email before logging in');
      }

      // Check if user is active
      if (!user.isActive) {
        throw new Error('Account has been deactivated');
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        throw new Error('Invalid credentials');
      }

      // Generate JWT token
      const token = this.generateToken(user)

      return { user, token };
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
        role: user.role
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );
  }

  /**
   * Generate email verification token
   */
  async generateVerificationToken(userId) {
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await User.findByIdAndUpdate(userId, {
      verificationToken: token,
      verificationExpires: expires
    });

    return token;
  }

  /**
   * Verify email with token
   */
  async verifyEmail(token) {
    const user = await User.findOne({
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
  async generatePasswordResetToken(email, phone) {
    const user = await User.findOne({
      $or: [
        { email },
        { phone }
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
  async resetPassword(token, newPassword) {
    const user = await User.findOne({
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
   * Change password for authenticated user
   */
  async changePassword(userId, currentPassword, newPassword) {
    const user = await User.findById(userId).select('+password');

    if (!user) {
      throw new Error('User not found');
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
  async resendVerificationEmail(email) {
    const user = await User.findOne({ email });

    if (!user) {
      throw new Error('User not found');
    }

    if (user.isVerified) {
      throw new Error('Email is already verified');
    }

    const token = await this.generateVerificationToken(user._id);
    return { user, token };
  }

  /**
   * Generate OTP for phone verification
   */
  async generatePhoneVerificationOTP(userId, phone) {
    const otp = crypto.randomInt(100000, 999999).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await User.findByIdAndUpdate(userId, {
      phoneVerificationOTP: otp,
      phoneVerificationExpires: expires,
      phone
    });

    return otp;
  }

  /**
   * Verify phone OTP
   */
  async verifyPhoneOTP(userId, otp) {
    const user = await User.findOne({
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
    // In a real application, you might want to store blacklisted tokens
    // in Redis or database. This is a simple implementation.
    logger.info(`Token blacklisted: ${token.substring(0, 20)}...`);
    return true;
  }

}

module.exports = new AuthService();