const mongoose = require('mongoose');

const platformEarningsSchema = new mongoose.Schema({
  orderId: {
    type: String,
    required: true,
    index: true
  },
  escrowId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Escrow',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  type: {
    type: String,
    enum: ['platform_fee', 'cancellation_fee', 'dispute_resolution'],
    default: 'platform_fee'
  },
  // For future Paystack transfer to platform account
  paystackTransferCode: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['pending', 'settled'],
    default: 'pending'
  },
  settledAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

platformEarningsSchema.index({ status: 1, createdAt: -1 });

const PlatformEarnings = mongoose.model('PlatformEarnings', platformEarningsSchema);
module.exports = PlatformEarnings;