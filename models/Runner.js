const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { GENDER, ROLE, FLEET, EDUCATION, SERVICE_TYPE, RUNNER_STATUS, VERIFICATION_STATUS } = require('../config/constants');

const runnerSchema = new mongoose.Schema({

  email: {
    type: String,
    lowercase: true,
    trim: true,
    sparse: true
  },
  password: {
    type: String,
    select: false
  },
  firstName: {
    type: String,
    trim: true,
  },
  lastName: {
    type: String,
    trim: true,
  },
  phone: {
    type: String,
    trim: true,
    sparse: true,
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

  // Location & Availability
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      default: [0, 0]
    }
  },
  latitude: {
    type: Number,
    default: null
  },
  longitude: {
    type: Number,
    default: null
  },
  fcmToken: {
    type: String,
    default: null,
  },
  currentUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',  // references the User model
    default: null,
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  lastLocationUpdate: {
    type: Date,
    default: null
  },

  // Verification
  runnerStatus: {
    type: String,
    enum: RUNNER_STATUS,
    default: 'pending_verification'
  },
  verificationDocuments: {
    nin: {
      number: String,
      verified: { type: Boolean, default: false },
      verifiedAt: Date,
      verificationId: String,
      status: { type: String, enum: VERIFICATION_STATUS, default: 'not_submitted' },
      submittedAt: Date,
      documentPath: String,
      verificationData: mongoose.Schema.Types.Mixed,
      rejectedAt: Date,
      rejectionReason: String,
      verifiedBy: String
    },
    driverLicense: {
      number: String,
      verified: { type: Boolean, default: false },
      verifiedAt: Date,
      expiryDate: Date,
      status: { type: String, enum: VERIFICATION_STATUS, default: 'not_submitted' },
      submittedAt: Date,
      documentPath: String,
      verificationData: mongoose.Schema.Types.Mixed,
      rejectedAt: Date,
      rejectionReason: String,
      verifiedBy: String
    }
  },
  biometricVerification: {
    selfieVerified: { type: Boolean, default: false },
    selfieVerifiedAt: Date,
    selfieImage: String,
    livenessPassed: { type: Boolean, default: false },
    faceMatchScore: Number,
    provider: String,
    verificationId: String,
    status: { type: String, enum: VERIFICATION_STATUS, default: 'not_submitted' },
    submittedAt: Date,
    documentPath: String,
    verificationData: mongoose.Schema.Types.Mixed,
    rejectedAt: Date,
    rejectionReason: String,
    verifiedBy: String
  },

  // Account Status
  role: {
    type: String,
    enum: ROLE,
    default: 'runner'
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

  // Verification Tokens (same as user)
  verificationToken: String,
  verificationExpires: Date,
  resetPasswordToken: String,
  resetPasswordExpires: Date,
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
  },

  savedLocations: [{
    name: { type: String, required: true },
    address: { type: String, required: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    savedAt: { type: Date, default: Date.now }
  }],

  currentRequest: {
    serviceType: { type: String, enum: SERVICE_TYPE },
    fleetType: { type: String, enum: FLEET },
    // common
    deliveryLocation: { type: String },
    dropoffPhone: { type: String },
    specialInstructions: { type: String },

    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    timestamp: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ['idle', 'searching', 'active', 'awaiting_runner_connection', 'completed', 'cancelled'],
      default: 'awaiting_runner_connection'
    },

    // ERAND-SPECIFIC FIELDS
    marketLocation: { type: String },
    marketItems: { type: String },
    budget: { type: String },
    budgetFlexibility: { type: String, enum: ['stay within budget', 'can adjust slightly'] },
    marketCoordinates: {
      lat: { type: Number },
      lng: { type: Number }
    },

    // PICKUP-SPECIFIC FIELDS
    pickupLocation: { type: String },
    pickupItems: { type: String },
    pickupPhone: { type: String },
    pickupCoordinates: {
      lat: { type: Number },
      lng: { type: Number }
    },
  }

}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function (doc, ret) {
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

// Virtuals
runnerSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

runnerSchema.virtual('accountAge').get(function () {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24));
});

// Indexes
runnerSchema.index({ email: 1 });
runnerSchema.index({ phone: 1 }, { sparse: true });
runnerSchema.index({ role: 1 });
runnerSchema.index({ isActive: 1 });
runnerSchema.index({ isVerified: 1 });
runnerSchema.index({ createdAt: -1 });
runnerSchema.index({ lastLogin: -1 });
runnerSchema.index({ location: '2dsphere' });
runnerSchema.index({ role: 1, isOnline: 1, isAvailable: 1 });
runnerSchema.index({ serviceType: 1, fleetType: 1 });

// Pre-save middlewares
runnerSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    this.password = await bcrypt.hash(this.password, 12);
    next();
  } catch (error) {
    next(error);
  }
});

runnerSchema.pre('save', function (next) {
  if (this.isModified() && !this.isModified('lastActive')) {
    this.lastActive = new Date();
  }
  next();
});

runnerSchema.pre('save', function (next) {
  if (this.isModified('latitude') || this.isModified('longitude')) {
    if (this.latitude && this.longitude) {
      this.location = {
        type: 'Point',
        coordinates: [this.longitude, this.latitude]
      };
      this.lastLocationUpdate = new Date();
    }
  }
  next();
});

// Instance methods
runnerSchema.methods.correctPassword = async function (candidatePassword, userPassword) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

runnerSchema.methods.isLocked = function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

runnerSchema.methods.incrementLoginAttempts = async function () {
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $set: { failedLoginAttempts: 1 },
      $unset: { lockUntil: 1 }
    });
  }

  const updates = { $inc: { failedLoginAttempts: 1 } };

  if (this.failedLoginAttempts + 1 >= 5 && !this.isLocked()) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 };
  }

  return this.updateOne(updates);
};

runnerSchema.methods.getPublicProfile = function () {
  const publicProfile = {
    _id: this._id,
    firstName: this.firstName,
    lastName: this.lastName,
    avatar: this.avatar,
    bio: this.bio,
    createdAt: this.createdAt
  };

  if (this.isEmailPublic) {
    publicProfile.email = this.email;
  }
  if (this.isPhonePublic && this.phone) {
    publicProfile.phone = this.phone;
  }

  return publicProfile;
};

// Static methods
runnerSchema.statics.findByEmail = function (email) {
  return this.findOne({ email: email.toLowerCase() });
};

runnerSchema.statics.cleanupExpiredTokens = function () {
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

runnerSchema.statics.findNearbyRunners = async function ({
  latitude,
  longitude,
  serviceType,
  fleetType,
  maxDistance = 2000
}) {
  const query = {
    role: 'runner',
    isOnline: true,
    isAvailable: true,
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [longitude, latitude]
        },
        $maxDistance: maxDistance
      }
    }
  };

  if (serviceType) {
    query.serviceType = serviceType;
  }

  if (fleetType) {
    query.fleetType = fleetType;
  }

  const allRunners = await this.find({ role: 'runner' })
    .select('firstName lastName currentRequest latitude longitude')
    .limit(5)

  console.log('ACTUAL Runners IN DB (first 5):');
  allRunners.forEach(runner => {
    console.log(`  - ${runner.firstName}:`, {
      hasCurrentRequest: !!runner.currentRequest,
      serviceType: runner.currentRequest?.serviceType,
      fleetType: runner.currentRequest?.fleetType,
      status: runner.currentRequest?.status,
      lat: runner.latitude,
      lng: runner.longitude
    });
  });

  const results = await this.find(query)
    .select('firstName lastName phone currentRequest location latitude longitude avatar')
    .lean();

  // console.log('✅ Search returned:', results.length, 'users');

  return results;
};

// Query helpers
runnerSchema.query.active = function () {
  return this.where({ isActive: true });
};

runnerSchema.query.verified = function () {
  return this.where({ isVerified: true });
};

runnerSchema.query.search = function (searchTerm) {
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

module.exports = mongoose.model('Runner', runnerSchema);