const mongoose = require('mongoose');
const { TASK_TYPES, } = require('../config/constants');
const { PLATFORM_FEE_PERCENTAGE } = require('../config/pricing');

const escrowSchema = new mongoose.Schema({
    taskId: {
        type: String,
        required: true,
        unique: true,
        index: true
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
    taskType: {
        type: String,
        enum: Object.values(TASK_TYPES),
        required: true
    },
    // Amounts
    itemBudget: {
        type: Number,
        default: 0, // 0 for pickup/delivery tasks
        min: 0
    },
    deliveryFee: {
        type: Number,
        required: true,
        min: 0
    },
    totalAmount: {
        type: Number,
        required: true,
        min: 0
    },

    providerFee: { type: Number, default: 0 },
    netPlatformFee: { type: Number, default: 0 },


    platformFee: {
        type: Number,
        required: true,
        min: 0
    },
    runnerPayout: {
        type: Number,
        required: true,
        min: 0
    },
    // Status tracking
    status: {
        type: String,
        enum: [
            'pending',           // Created but not funded
            'funded',            // User paid, escrow active
            'item_approved',     // User approved items (shopping only)
            'delivery_pending',  // Awaiting delivery confirmation
            'released',          // Funds released to runner
            'disputed',          // Dispute raised
            'refunded',          // Refunded to user
            'partially_released' // Partial release after dispute
        ],
        default: 'pending'
    },
    paymentStatus: {
        type: String,
        enum: ['unpaid', 'paid', 'failed'],
        default: 'unpaid'
    },
    // Release tracking
    itemBudgetReleased: {
        type: Boolean,
        default: false
    },
    deliveryFeeReleased: {
        type: Boolean,
        default: false
    },
    // Approval tracking (for shopping tasks)
    itemsApprovedAt: {
        type: Date,
        default: null
    },
    deliveryConfirmedAt: {
        type: Date,
        default: null
    },
    // Payment references
    stripePaymentIntentId: {
        type: String,
        default: null
    },
    vendorPaymentReference: {
        type: String,
        default: null
    },
    // Dispute tracking
    disputeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Dispute',
        default: null
    },
    // Metadata
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },


    timeoutAt: { type: Date, default: null },           // Auto-confirm after 48hr
    lockedWalletBalance: { type: Number, default: 0 },  // Prevents withdrawals
    orderId: {                                          // Link to Order model
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        default: null
    }


}, {
    timestamps: true
});

// Indexes for faster queries
escrowSchema.index({ userId: 1, status: 1 });
escrowSchema.index({ runnerId: 1, status: 1 });
escrowSchema.index({ status: 1, createdAt: -1 });

// Virtual for checking if fully released
escrowSchema.virtual('isFullyReleased').get(function () {
    if (this.taskType === 'shopping') {
        return this.itemBudgetReleased && this.deliveryFeeReleased;
    }
    return this.deliveryFeeReleased;
});

// Calculate platform fee (57% of delivery fee)
escrowSchema.statics.calculateFees = function (deliveryFee) {
    const platformFee = Math.round(deliveryFee * PLATFORM_FEE_PERCENTAGE);
    const runnerPayout = deliveryFee - platformFee;

    return {
        platformFee,
        runnerPayout,
        platformFeePercentage: PLATFORM_FEE_PERCENTAGE * 100
    };
};

const Escrow = mongoose.model('Escrow', escrowSchema);

module.exports = Escrow;