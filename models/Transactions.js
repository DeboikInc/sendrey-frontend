const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  walletId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Wallet',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['credit', 'debit', 'escrow_lock', 'escrow_release', 'refund', 'payout'],
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'reversed'],
    default: 'pending'
  },
  reference: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  // Payment processor references
  stripePaymentIntentId: {
    type: String,
    default: null
  },
  stripeChargeId: {
    type: String,
    default: null
  },
  // Related records
  escrowId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Escrow',
    default: null
  },
  taskId: {
    type: String,
    default: null
  },
  // Balance tracking
  balanceBefore: {
    type: Number,
    default: null
  },
  balanceAfter: {
    type: Number,
    default: null
  },
  // Metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  // Error tracking
  errorMessage: {
    type: String,
    default: null
  },
  // Timestamps
  completedAt: {
    type: Date,
    default: null
  },
  failedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Indexes
transactionSchema.index({ walletId: 1, createdAt: -1 });
transactionSchema.index({ type: 1, status: 1 });
transactionSchema.index({ reference: 1 }, { unique: true });

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;