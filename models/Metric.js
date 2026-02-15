const mongoose = require('mongoose');

const metricSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['message', 'status_update', 'file_upload', 'call', 'socket_error'],
    required: true
  },
  status: {
    type: String,
    enum: ['success', 'failed'],
    required: true
  },
  latency: {
    type: Number, // in milliseconds
    default: null
  },
  chatId: {
    type: String,
    default: null
  },
  userId: {
    type: String,
    default: null
  },
  userType: {
    type: String,
    enum: ['user', 'runner', 'system'],
    default: null
  },
  error: {
    type: String,
    default: null
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed, // For any extra data
    default: null
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Index for faster queries
metricSchema.index({ type: 1, timestamp: -1 });
metricSchema.index({ status: 1, timestamp: -1 });

// Auto-delete metrics older than 30 days (optional)
metricSchema.index({ timestamp: 1 }, { expireAfterSeconds: 2592000 }); // 30 days

const Metric = mongoose.model('Metric', metricSchema);

module.exports = Metric;