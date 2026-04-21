const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { GENDER, ROLE, SERVICE_TYPE, FLEET_TYPE, TOTAL_MAX_DISTANCE } = require('../config/constants');

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
    select: false
  },
  pin: {
    type: String,
    select: false,
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

  refreshToken: { type: String, default: null },

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
  accountType: {
    type: String,
    enum: ["personal", "business"],
    default: "personal"
  },

  pendingBusinessInvite: {
    businessOwnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    businessName: { type: String },
    inviterName: { type: String },
    role: { type: String },
    invitedAt: { type: Date },
  },

  teamMembership: {
    businessOwnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    role: { type: String, enum: ['admin', 'manager', 'staff'] },
    status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' },
  },

  businessProfile: {
    businessName: String,
    convertedAt: Date,
    members: [{
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      role: {
        type: String,
        enum: ["admin", "manager", "staff"],
        default: "staff",
      },
      joinedAt: { type: Date, default: Date.now },
      status: { type: String, enum: ["pending", "accepted", "declined"], default: "pending" },
    },
    ],
    scheduledConversations: [{
      label: { type: String },
      cronExpression: { type: String },
      scheduledAt: { type: Date },
      isActive: { type: Boolean, default: true },
      lastTriggeredAt: { type: Date },
      status: {
        type: String,
        enum: ['pending', 'triggered', 'skipped', 'modified'],
        default: 'pending'
      }
    }],
  },

  lastExpenseSummaryAt: { type: Date, default: null },

  // Location
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

  // Account Status
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
  isEmailVerified: {
    type: Boolean,
    default: false
  },

  fcmToken: {
    type: String,
    default: null,
  },

  termsAccepted: {
    version: { type: String, default: null },
    acceptedAt: { type: Date, default: null },
    ipAddress: { type: String, default: null },
  },

  currentRunnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Runner',  // references the Runner model
    default: null,
  },

  // Verification Tokens
  verificationToken: String,
  verificationExpires: Date,
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  phoneVerificationOTP: String,
  phoneVerificationExpires: Date,
  emailVerificationOTP: { type: String, },
  emailVerificationExpires: { type: Date },

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

  serviceType: {
    type: String,
    enum: ['pick-up', 'run-errand']
  },

  fleetType: {
    type: String,
    enum: ['cycling', 'bike', 'car', 'van', 'pedestrian']
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
    fleetType: { type: String, enum: FLEET_TYPE },

    deliveryLocation: { type: String },
    deliveryCoordinates: {
      lat: { type: Number },
      lng: { type: Number }
    },

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
    pickupPhone: { type: String },
    pickupItems: { type: String },
    pickupCoordinates: {
      lat: { type: Number },
      lng: { type: Number }
    },
    businessAccount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    createdByMember: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
  },
  pendingPrompts: [
    {
      message: { type: String },
      type: { type: String, default: 'general' }, // 'general' | 'expense_report'
      reportId: { type: mongoose.Schema.Types.ObjectId, ref: 'ExpenseReport', default: null },
      createdAt: { type: Date, default: Date.now },
      read: { type: Boolean, default: false },
    },
  ],

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
      delete ret.emailVerificationOTP;
      delete ret.emailVerificationExpires;
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
      delete ret.emailVerificationOTP;
      delete ret.emailVerificationExpires;
      delete ret.failedLoginAttempts;
      delete ret.lockUntil;
      return ret;
    }
  }
});

// Virtuals
userSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

userSchema.virtual('accountAge').get(function () {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24));
});

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ phone: 1 }, { sparse: true });
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ isVerified: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ lastLogin: -1 });
userSchema.index({ location: '2dsphere' });

// Pre-save middlewares
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    this.password = await bcrypt.hash(this.password, 12);
    next();
  } catch (error) {
    next(error);
  }
});

userSchema.pre('save', function (next) {
  if (this.isModified() && !this.isModified('lastActive')) {
    this.lastActive = new Date();
  }
  next();
});

userSchema.pre('save', function (next) {
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
userSchema.methods.correctPassword = async function (candidatePassword, userPassword) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

userSchema.methods.isLocked = function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

userSchema.methods.incrementLoginAttempts = async function () {
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

userSchema.methods.getPublicProfile = function () {
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
userSchema.statics.findByEmail = function (email) {
  return this.findOne({ email: email.toLowerCase() });
};

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
      phoneVerificationExpires: 1,
      emailVerificationOTP: 1,
      emailVerificationExpires: 1,
    }
  });
};

// Query helpers
userSchema.query.active = function () {
  return this.where({ isActive: true });
};

userSchema.query.verified = function () {
  return this.where({ isVerified: true });
};

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

// helper functions 
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // meters
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// findNearbyUsers method
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

userSchema.statics.findNearbyUsers = async function ({
  latitude,
  longitude,
  serviceType,
  fleetType,
}) {
  console.log('findNearbyUsers called with:', { latitude, longitude, serviceType, fleetType });
  const TOTAL_MAX = TOTAL_MAX_DISTANCE;

  const query = {
    role: 'user',
    isActive: true,
    'currentRequest.status': 'awaiting_runner_connection',
  };

  if (serviceType) query['currentRequest.serviceType'] = serviceType;
  if (fleetType) query['currentRequest.fleetType'] = fleetType;

  const results = await this.find(query)
    .select('firstName lastName phone currentRequest location latitude longitude avatar isPhoneVerified isEmailVerified')
    .lean();

  console.log('DB query results before distance filter:', results.length);
  console.log('Query used:', JSON.stringify(query));

  return results.filter((user) => {
    const req = user.currentRequest;
    if (!req) return false;

    const isErrand = req.serviceType === 'run-errand';
    const pickupCoords = isErrand ? req.marketCoordinates : req.pickupCoordinates;

    if (!pickupCoords?.lat || !pickupCoords?.lng) return false;

    // Rule 1: runner → pickup/market must be ≤ 1km (applies to ALL fleet types)
    const runnerToPickup = haversineDistance(latitude, longitude, pickupCoords.lat, pickupCoords.lng);
    if (runnerToPickup > TOTAL_MAX) return false;

    // only for pedestrian — total route runner→pickup + pickup→delivery ≤ 1km
    if (req.fleetType === 'pedestrian') {
      const deliveryCoords = req.deliveryCoordinates;
      if (!deliveryCoords?.lat || !deliveryCoords?.lng) return false; // pedestrian must have delivery coords

      const pickupToDelivery = haversineDistance(
        pickupCoords.lat, pickupCoords.lng,
        deliveryCoords.lat, deliveryCoords.lng
      );
      return (runnerToPickup + pickupToDelivery) <= TOTAL_MAX;
    }

    return true;
  });
};

module.exports = mongoose.model('User', userSchema);