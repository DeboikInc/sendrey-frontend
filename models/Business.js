const mongoose = require('mongoose');
const {BUSINESS_STATUS} = require('../config/constants')

const businessSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true, // one suggestion record per user
  },

  status: {
    type: String,
    enum: BUSINESS_STATUS,
    default: "active"
  },

  // how many times we've suggested business to this user
  suggestionCount: { type: Number, default: 0 },

  // last time we sent a suggestion (push or in-app)
  lastSuggestedAt: { type: Date, default: null },

  // user explicitly said "not interested" — cooldown before suggesting again
  dismissedAt: { type: Date, default: null },

  // user clicked "continue" and started conversion
  convertedAt: { type: Date, default: null },

  // permanently opted out ("not interested" X times)
  optedOut: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Business', businessSchema);