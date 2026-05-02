const mongoose = require('mongoose');

const disputeSchema = new mongoose.Schema({
  disputeId: {
    type: String,
    unique: true,
  },
  orderId: {
    type: String,
    index: true
  },
  chatId: {
    type: String,
  },
  taskId: {
    type: String,
    required: true,
    index: true
  },
  escrowId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Escrow',
    required: false
  },
  initiatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'initiatedByModel'
  },
  initiatedByModel: {
    type: String,
    required: true,
    enum: ['User', 'Runner']
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  runnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Runner',
    required: true
  },
  reason: {
    type: String,
    required: true,
    enum: [
      'item_mismatch',
      'item_damage',
      'delivery_delay',
      'non_delivery',
      'pricing_dispute',
      'quality_issue',
      'runner_behavior',
      'user_unavailable',
      'payment_issue',
      'other'
    ]
  },
  description: {
    type: String,
    required: true
  },
  evidence: [{
    type: {
      type: String,
      enum: ['image', 'document', 'text']
    },
    url: String,
    description: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  status: {
    type: String,
    enum: ['open', 'under_review', 'resolved', 'closed'],
    default: 'open'
  },

  escrowPaused: {        // track if escrow is paused
    type: Boolean,
    default: true
  },

  isFinal: {             // no appeals after resolution
    type: Boolean,
    default: false
  },

  lockedRunnerAmount: {
    type: Number,
  },

  resolution: {
    type: {
      outcome: {
        type: String,
        enum: ['full_release', 'partial_release', 'full_refund', 'partial_refund']
      },
      amountToUser: Number,
      amountToRunner: Number,
      releasePercentage: Number,
      notes: String,
      resolvedBy: String,
      resolvedAt: Date,
      notifiedAt: Date
    },
    
    default: undefined  // Don't set resolution at all until resolved
  },

  messages: [{
    from: {
      type: String,
      enum: ['user', 'runner', 'admin', 'system']
    },
    message: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// readable dispute ID generator
disputeSchema.statics.generateDisputeId = function () {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `DSP-${timestamp}-${random}`;
};

// Indexes
disputeSchema.index({ taskId: 1 });
disputeSchema.index({ orderId: 1 });
disputeSchema.index({ userId: 1, status: 1 });
disputeSchema.index({ runnerId: 1, status: 1 });
disputeSchema.index({ status: 1, createdAt: -1 });

const Dispute = mongoose.model('Dispute', disputeSchema);

module.exports = Dispute;