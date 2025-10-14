const mongoose = require('mongoose');
const { ACTIVITIES, SEVERITY, STATUS } = require('../config/constants');

const activitySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  action: {
    type: String,
    required: true,
    enum: ACTIVITIES
  },
  description: {
    type: String,
    required: true
  },
  ipAddress: {
    type: String,
    required: true
  },
  userAgent: {
    type: String,
    default: ''
  },
  location: {
    country: String,
    city: String,
    region: String
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  },
  severity: {
    type: String,
    enum: SEVERITY,
    default: 'low'
  },
  status: {
    type: String,
    enum: STATUS,
    default: 'success'
  }
}, {
  timestamps: true
});

// Index for efficient querying
activitySchema.index({ userId: 1, createdAt: -1 });
activitySchema.index({ action: 1, createdAt: -1 });
activitySchema.index({ createdAt: -1 });

// Static methods
activitySchema.statics.getUserActivities = function (userId, limit = 50, skip = 0) {
  return this.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip)
    .lean();
};

activitySchema.statics.getRecentActivities = function (userId, hours = 24) {
  const date = new Date();
  date.setHours(date.getHours() - hours);

  return this.find({
    userId,
    createdAt: { $gte: date }
  }).sort({ createdAt: -1 }).lean();
};

activitySchema.statics.getActivitiesByAction = function (userId, action, limit = 50) {
  return this.find({ userId, action })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

activitySchema.statics.getSecurityActivities = function (userId, limit = 50) {
  const securityActions = [
    'login', 'logout', 'password_change', 'email_change',
    'password_reset_request', 'password_reset_success',
    'two_factor_enabled', 'two_factor_disabled'
  ];

  return this.find({
    userId,
    action: { $in: securityActions }
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

activitySchema.statics.cleanupOldActivities = function (days = 90) {
  const date = new Date();
  date.setDate(date.getDate() - days);

  return this.deleteMany({ createdAt: { $lt: date } });
};

module.exports = mongoose.model('Activity', activitySchema);