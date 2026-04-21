const mongoose = require('mongoose');
const Transaction = require('./Transactions')
const walletSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    unique: true,
    index: true
  },
  userType: {
    type: String,
    enum: ['user', 'runner'],
    required: true
  },
  balance: {
    type: Number,
    default: 0,
    min: 0
  },
  // Stripe Connect Account (for runners to receive payouts)
  stripeAccountId: {
    type: String,
    default: null
  },
  // Virtual account for funding (via Stripe)
  virtualAccountNumber: {
    type: String,
    default: null
  },
  virtualAccountBank: {
    type: String,
    default: null
  },
  // Status
  status: {
    type: String,
    enum: ['active', 'suspended', 'closed'],
    default: 'active'
  },
  // Limits
  dailyLimit: {
    type: Number,
    default: 100000 // ₦100,000
  },
  monthlyLimit: {
    type: Number,
    default: 1000000 // ₦1,000,000
  },
  // Metadata
  kycVerified: {
    type: Boolean,
    default: false
  },
  lastTransactionAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Method to credit wallet
walletSchema.methods.credit = async function(amount, reference, metadata = {}) {
  this.balance += amount;
  this.lastTransactionAt = new Date();
  await this.save();
  
  // Create transaction record
  await Transaction.create({
    walletId: this._id,
    type: 'credit',
    amount,
    status: 'completed',
    reference,
    metadata,
    balanceAfter: this.balance
  });
  
  return this;
};

// Method to debit wallet
walletSchema.methods.debit = async function(amount, reference, metadata = {}) {
  if (this.balance < amount) {
    throw new Error('Insufficient wallet balance');
  }
  
  this.balance -= amount;
  this.lastTransactionAt = new Date();
  await this.save();
  
  // Create transaction record
  await Transaction.create({
    walletId: this._id,
    type: 'debit',
    amount,
    status: 'completed',
    reference,
    metadata,
    balanceAfter: this.balance
  });
  
  return this;
};

const Wallet = mongoose.model('Wallet', walletSchema);

module.exports = Wallet;