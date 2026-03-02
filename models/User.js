const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { GENDER, ROLE, SERVICE_TYPE, FLEET_TYPE } = require('../config/constants');

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
  accountType:{
    type:String,
    enum:["personal","business"],
    default:"personal"
  },
  businessProfile:{
  businessName:String,
  convertedAt: Date,
  members:[{
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      role: {
        type: String,
        enum: ["admin", "manager", "staff"],
        default: "staff",
      },
      joinedAt: { type: Date, default: Date.now },
    },
  ],
  scheduledConversations: [{
    label: { type: String },
    cronExpression: { type: String },
    isActive: { type: Boolean, default: true },
    lastTriggeredAt: { type: Date },
  }],
  },
 

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

  fcmToken: {
    type: String,
    default: null,
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
      phoneVerificationExpires: 1
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

// findNearbyUsers method
userSchema.statics.findNearbyUsers = async function ({
  latitude,
  longitude,
  serviceType,
  fleetType,
  maxDistance = 50000
}) {
  const query = {
    role: 'user',
    isActive: true,
    'currentRequest.status': 'awaiting_runner_connection',
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
    query['currentRequest.serviceType'] = serviceType;
  }

  // Add fleetType to currentRequest  
  if (fleetType) {
    query['currentRequest.fleetType'] = fleetType;
  }

  // console.log(' USER SEARCH QUERY:', JSON.stringify(query, null, 2));
  // const allUsers = await this.find({ role: 'user' })
  //   .select('firstName lastName currentRequest latitude longitude')
  //   .limit(5)

  // console.log(' ACTUAL USERS IN DB (first 5):');
  // allUsers.forEach(user => {
  //   console.log(`  - ${user.firstName}:`, {
  //     hasCurrentRequest: !!user.currentRequest,
  //     serviceType: user.currentRequest?.serviceType,
  //     fleetType: user.currentRequest?.fleetType,
  //     status: user.currentRequest?.status,
  //     lat: user.latitude,
  //     lng: user.longitude
  //   });
  // });

  const results = await this.find(query)
    .select('firstName lastName phone currentRequest location latitude longitude avatar')
    .lean();

  // console.log('Search returned:', results.length, 'users');

  return results;
};

module.exports = mongoose.model('User', userSchema);