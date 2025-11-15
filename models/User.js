const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { GENDER, ROLE, FLEET, EDUCATION, SERVICE_TYPE } = require('../config/constants');

const userSchema = new mongoose.Schema({
  // Authentication & Basic Info
  email: {
    type: String,
    lowercase: true,
    trim: true,
    sparse: true
  },
  password: {
    type: String,
    select: false // Don't include in queries by default
  },
  firstName: {
    type: String,
    trim: true,
  },
  lastName: {
    type: String,
    trim: true,
  },
  // Contact Information
  phone: {
    type: String,
    trim: true,
    sparse: true, // Allows multiple null values but enforces uniqueness for non-null
  },
  buidingName: {
    type: String,
    trim: true,
  },
  flatNumber: {
    type: String,
    trim: true,
  },
  nearestBusStop: {
    type: String,
    trim: true,
  },
  fleetType: {
    type: String,
    enum: FLEET,
    default: 'pedestrian'
  },
  serviceType: {
    type: String,
    enum: SERVICE_TYPE,
    default: 'pick-up'
  },
  levelOfEducation: {
    type: String,
    enum: EDUCATION,
    default: 'graduate'
  },
  nameOfInstitution: {
    type: String,
    trim: true,
  },

  // Profile Information
  avatar: {
    type: String,
    default: null
  },
  bio: {
    type: String,
    default: ''
  },
  dateOfBirth: {
    type: Date,
  },
  gender: {
    type: String,
    enum: {
      values: GENDER,
      message: 'Gender is either male, or female'
    },
    default: 'male'
  },
  // Location & Preferences
  timezone: {
    type: String,
    default: 'UTC',
    maxlength: [50, 'Timezone cannot exceed 50 characters']
  },

  // Account Status & Verification
  role: {
    type: String,
    enum: ROLE,
    default: 'user'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  isPhoneVerified: {
    type: Boolean,
    default: false
  },

  // Email Verification
  verificationToken: String,
  verificationExpires: Date,

  // Password Reset
  resetPasswordToken: String,
  resetPasswordExpires: Date,

  // Phone Verification
  phoneVerificationOTP: String,
  phoneVerificationExpires: Date,

  // Privacy Settings
  isEmailPublic: {
    type: Boolean,
    default: false
  },
  isPhonePublic: {
    type: Boolean,
    default: false
  },

  // Notification Preferences
  notificationPreferences: {
    email: {
      marketing: { type: Boolean, default: true },
      security: { type: Boolean, default: true },
      updates: { type: Boolean, default: true },
      newsletter: { type: Boolean, default: true }
    },
    push: {
      messages: { type: Boolean, default: true },
      updates: { type: Boolean, default: true },
      promotions: { type: Boolean, default: false }
    },
    sms: {
      security: { type: Boolean, default: true },
      promotions: { type: Boolean, default: false }
    }
  },

  // Address Information
  address: {
    type: String, maxlength: 255
  },

  // Activity Tracking
  lastLogin: {
    type: Date,
    default: Date.now
  },
  loginCount: {
    type: Number,
    default: 0
  },
  failedLoginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: Date,

  // Account Statistics
  profileViews: {
    type: Number,
    default: 0
  },
  lastActive: {
    type: Date,
    default: Date.now
  }

}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function (doc, ret) {
      // Remove sensitive fields when converting to JSON
      delete ret.password;
      delete ret.verificationToken;
      delete ret.verificationExpires;
      delete ret.resetPasswordToken;
      delete ret.resetPasswordExpires;
      delete ret.phoneVerificationOTP;
      delete ret.phoneVerificationExpires;
      delete ret.failedLoginAttempts;
      delete ret.lockUntil;
      return ret;
    }
  },
  toObject: {
    virtuals: true,
    transform: function (doc, ret) {
      // Remove sensitive fields when converting to object
      delete ret.password;
      delete ret.verificationToken;
      delete ret.verificationExpires;
      delete ret.resetPasswordToken;
      delete ret.resetPasswordExpires;
      delete ret.phoneVerificationOTP;
      delete ret.phoneVerificationExpires;
      delete ret.failedLoginAttempts;
      delete ret.lockUntil;
      return ret;
    }
  }
});

// Virtual for full name
userSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for account age
userSchema.virtual('accountAge').get(function () {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24));
});

// Indexes for better query performance
userSchema.index({ email: 1 });
userSchema.index({ phone: 1 }, { sparse: true });
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ isVerified: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ lastLogin: -1 });

// Pre-save middleware to hash password
userSchema.pre('save', async function (next) {
  // Only run this function if password was modified
  if (!this.isModified('password')) return next();

  try {
    // Hash password with cost of 12
    this.password = await bcrypt.hash(this.password, 12);
    next();
  } catch (error) {
    next(error);
  }
});

// Pre-save middleware to update lastActive
userSchema.pre('save', function (next) {
  if (this.isModified() && !this.isModified('lastActive')) {
    this.lastActive = new Date();
  }
  next();
});

// Instance method to check if password is correct
userSchema.methods.correctPassword = async function (candidatePassword, userPassword) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

// Instance method to check if account is locked
userSchema.methods.isLocked = function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

// Instance method to increment failed login attempts
userSchema.methods.incrementLoginAttempts = async function () {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $set: { failedLoginAttempts: 1 },
      $unset: { lockUntil: 1 }
    });
  }

  // Otherwise, increment
  const updates = { $inc: { failedLoginAttempts: 1 } };

  // Lock the account if we've reached max attempts and it's not already locked
  if (this.failedLoginAttempts + 1 >= 5 && !this.isLocked()) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 }; // 2 hours
  }

  return this.updateOne(updates);
};

// Instance method to check if user has social account
userSchema.methods.hasSocialAccount = function (provider) {
  return !!(this.social && this.social[provider] && this.social[provider].id);
};

// Instance method to get public profile
userSchema.methods.getPublicProfile = function () {
  const publicProfile = {
    _id: this._id,
    firstName: this.firstName,
    lastName: this.lastName,
    avatar: this.avatar,
    bio: this.bio,
    createdAt: this.createdAt
  };

  // Only include email/phone if user has made them public
  if (this.isEmailPublic) {
    publicProfile.email = this.email;
  }
  if (this.isPhonePublic && this.phone) {
    publicProfile.phone = this.phone;
  }

  return publicProfile;
};

// Static method to find user by email
userSchema.statics.findByEmail = function (email) {
  return this.findOne({ email: email.toLowerCase() });
};

// Static method to find user by social ID
userSchema.statics.findBySocialId = function (provider, socialId) {
  return this.findOne({ [`social.${provider}.id`]: socialId });
};

// Static method to get users count by role
userSchema.statics.getUsersCountByRole = function () {
  return this.aggregate([
    {
      $group: {
        _id: '$role',
        count: { $sum: 1 }
      }
    }
  ]);
};

// Static method to get recently active users
userSchema.statics.getRecentlyActive = function (days = 7) {
  const date = new Date();
  date.setDate(date.getDate() - days);

  return this.find({
    lastActive: { $gte: date },
    isActive: true
  }).select('firstName lastName email lastActive');
};

// Static method to cleanup expired tokens
userSchema.statics.cleanupExpiredTokens = function () {
  const now = new Date();

  return this.updateMany({
    $or: [
      { verificationExpires: { $lt: now } },
      { resetPasswordExpires: { $lt: now } },
      { phoneVerificationExpires: { $lt: now } }
    ]
  }, {
    $unset: {
      verificationToken: 1,
      verificationExpires: 1,
      resetPasswordToken: 1,
      resetPasswordExpires: 1,
      phoneVerificationOTP: 1,
      phoneVerificationExpires: 1
    }
  });
};

// Query helper to filter active users
userSchema.query.active = function () {
  return this.where({ isActive: true });
};

// Query helper to filter verified users
userSchema.query.verified = function () {
  return this.where({ isVerified: true });
};

// Query helper to search by name or email
userSchema.query.search = function (searchTerm) {
  if (!searchTerm) return this;

  const regex = new RegExp(searchTerm, 'i');
  return this.where({
    $or: [
      { firstName: regex },
      { lastName: regex },
      { email: regex }
    ]
  });
};

module.exports = mongoose.model('User', userSchema);