const mongoose = require('mongoose');
const { TASK_TYPES, SERVICE_TYPE } = require('../config/constants');

const orderSchema = new mongoose.Schema({
    // IDs
    orderId: {
        type: String,
        required: true,
        unique: true,
        index: true,
        default: () => Order.generateOrderId()
    },
    chatId: {
        type: String,
        required: true,
        index: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    runnerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Runner',
        required: true,
        index: true
    },

    // Order type
    serviceType: {
        type: String,
        enum: [SERVICE_TYPE.RUN_ERRAND, SERVICE_TYPE.DELIVERY],
        required: true
    },
    taskType: {
        type: String,
        enum: Object.values(TASK_TYPES),
        required: true
    },

    // Locations
    pickupLocation: {
        address: String,
        latitude: Number,
        longitude: Number,
        contactName: String,
        contactPhone: String
    },
    deliveryLocation: {
        address: String,
        latitude: Number,
        longitude: Number,
        contactName: String,
        contactPhone: String
    },

    // Shopping details (for run-errand)
    marketLocation: {
        address: String,
        latitude: Number,
        longitude: Number
    },

    marketCoordinates: {
        lat: { type: Number, default: null },
        lng: { type: Number, default: null }
    },
    pickupCoordinates: {
        lat: { type: Number, default: null },
        lng: { type: Number, default: null }
    },
    deliveryCoordinates: {
        lat: { type: Number, default: null },
        lng: { type: Number, default: null }
    },

    itemsList: [{
        name: String,
        quantity: Number,
        estimatedPrice: Number
    }],
    itemBudget: {
        type: Number,
        default: 0
    },

    // Pricing
    deliveryFee: {
        type: Number,
        required: true
    },
    totalAmount: {
        type: Number,
        required: true
    },
    platformFee: {
        type: Number,
        required: true
    },
    runnerPayout: {
        type: Number,
        required: true
    },

    // Payment & Escrow
    escrowId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Escrow',
        default: null
    },
    paymentStatus: {
        type: String,
        enum: ['unpaid', 'paid', 'failed', 'refunded'],
        default: 'unpaid'
    },

    // Approval (for shopping tasks)
    approvalStatus: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'not_required'],
        default: 'not_required'
    },
    submittedItems: [{
        name: String,
        price: Number,
        quantity: Number,
        imageUrl: String
    }],
    receiptImageUrl: {
        type: String,
        default: null
    },
    itemsApprovedAt: {
        type: Date,
        default: null
    },

    // Status tracking
    status: {
        type: String,
        enum: [
            'pending_payment',
            'payment_failed',
            'paid',
            'accepted',
            'shopping',
            'items_submitted',
            'items_approved',
            'en_route_to_pickup',
            'arrived_at_pickup',
            'picked_up',
            'en_route_to_delivery',
            'arrived_at_delivery',
            'delivered',
            'completed',
            'cancelled',
            'disputed'
        ],
        default: 'pending_payment'
    },
    statusHistory: [{
        status: String,
        timestamp: { type: Date, default: Date.now },
        triggeredBy: { type: String, enum: ['user', 'runner', 'system'] },
        triggeredById: String,
        note: String

    }],

    // Delivery confirmation
    deliveryConfirmedAt: {
        type: Date,
        default: null
    },

    deliveryConfirmedBy: {
        type: String,
        enum: ['user', 'system', null],
        default: null
    },

    // Special instructions
    specialInstructions: {
        type: String,
        default: null
    },

    // Dispute
    disputeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Dispute',
        default: null
    },
    hasDispute: {
        type: Boolean,
        default: false
    },

    // Rating
    ratingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Rating',
        default: null
    },
    isRated: {
        type: Boolean,
        default: false
    },

    // Tracking
    runnerLocation: {
        latitude: Number,
        longitude: Number,
        lastUpdated: Date
    },
    estimatedDeliveryTime: {
        type: Date,
        default: null
    },

    // Metadata
    fleetType: {
        type: String,
        default: null
    },
    cancellationReason: {
        type: String,
        default: null
    },
    cancelledBy: {
        type: String,
        enum: ['user', 'runner', 'system', null],
        default: null
    },
    cancelledAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: {
        paidAt: Date,
        acceptedAt: Date,
        itemsSubmittedAt: Date,
        itemsApprovedAt: Date,
        deliveredAt: Date,
        completedAt: Date,
        disputedAt: Date,
        archivedAt: Date,
    },
});

// Indexes
orderSchema.index({ userId: 1, status: 1 });
orderSchema.index({ runnerId: 1, status: 1 });
orderSchema.index({ chatId: 1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ orderId: 1 }, { unique: true });

// Static method to generate unique order ID
orderSchema.statics.generateOrderId = function () {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 7);
    return `ORD-${timestamp}-${random}`.toUpperCase();
};

// Method to update status
orderSchema.methods.updateStatus = async function (newStatus, triggeredBy = 'system') {
    this.statusHistory.push({
        status: this.status,
        timestamp: new Date(),
        triggeredBy
    });

    this.status = newStatus;
    await this.save();

    return this;
};

// Method to check if order can be cancelled
orderSchema.methods.canBeCancelled = function () {
    const cancellableStatuses = [
        'pending_payment',
        'paid',
        'accepted',
        'shopping',
        'items_submitted'
    ];
    return cancellableStatuses.includes(this.status);
};

// Method to check if order needs item approval
orderSchema.methods.needsItemApproval = function () {
    return this.taskType === 'shopping' && this.approvalStatus === 'pending';
};

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;