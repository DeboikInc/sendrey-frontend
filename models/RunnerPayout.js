const mongoose = require('mongoose');

const receiptSchema = new mongoose.Schema({
  receiptUrl: { type: String, required: true },
  vendorName: { type: String },
  amountSpent: { type: Number },
  changeAmount: { type: Number },
  submittedAt: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  rejectionReason: { type: String, default: null },
  reviewedAt: { type: Date, default: null },
  reviewedBy: { type: String, default: null },
}, { _id: true });

const runnerPayoutSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true, index: true },
  chatId: { type: String, required: true, index: true },
  runnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Runner', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  escrowId: { type: mongoose.Schema.Types.ObjectId, ref: 'Escrow', default: null },

  itemBudget: { type: Number, required: true, min: 0 },
  amountSpent: { type: Number, default: null },
  changeAmount: { type: Number, default: null },
  vendorName: { type: String, default: null },

  bankDetails: {
    bankName: { type: String, default: null },
    accountNumber: { type: String, default: null },
    accountName: { type: String, default: null },
  },

  receiptUrl: { type: String, default: null },

  // Full history of every receipt submission
  receiptHistory: [receiptSchema],

  // Runner must submit receipt via payout system to unlock runner fee
  // If false at task_completed, runner forfeits delivery earnings
  usedPayoutSystem: { type: Boolean, default: false },

  status: {
    type: String,
    enum: ['pending', 'submitted', 'approved', 'rejected'],
    default: 'pending'
  },

  submittedAt: { type: Date, default: null },
  approvedAt: { type: Date, default: null },
  rejectionReason: { type: String, default: null },
  notes: { type: String, default: null }

}, { timestamps: true });

runnerPayoutSchema.index({ runnerId: 1, status: 1 });
runnerPayoutSchema.index({ orderId: 1, status: 1 });
runnerPayoutSchema.index({ chatId: 1 });
runnerPayoutSchema.index({ orderId: 1, runnerId: 1 }, { unique: true });

module.exports = mongoose.model('RunnerPayout', runnerPayoutSchema);