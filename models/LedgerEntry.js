const mongoose = require('mongoose');

const ledgerEntrySchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    runnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Runner' },

    type: {
        type: String,
        enum: [
            'deposit',          // wallet funded via VA or card
            'escrow_lock',      // funds moved into escrow at payment
            'escrow_release',   // delivery fee paid out to runner
            'item_budget',      // item budget released after approval
            'platform_earning', // platform cut recorded
            'provider_fee',     // paystack fee recorded
            'withdrawal',       // runner withdrew to bank
            'refund',           // money returned to user
        ],
        required: true,
    },

    // Amounts — user always sees grossAmount, provider fee never surprises them
    grossAmount: { type: Number, required: true },
    netAmount: { type: Number, required: true },
    providerFee: { type: Number, default: 0 },
    platformFee: { type: Number, default: 0 },
    netPlatformFee: { type: Number, default: 0 },
    runnerFee: { type: Number, default: 0 },

    provider: {
        type: String,
        enum: ['paystack', 'wallet', 'system'],
        required: true,
    },
    providerReference: { type: String },

    orderId: { type: String },
    escrowId: { type: mongoose.Schema.Types.ObjectId, ref: 'Escrow' },
    chatId: { type: String },

    description: { type: String },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'reversed'],
        default: 'completed',
    },
    metadata: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

ledgerEntrySchema.index({ userId: 1, createdAt: -1 });
ledgerEntrySchema.index({ orderId: 1 });
ledgerEntrySchema.index({ type: 1, status: 1 });
ledgerEntrySchema.index({ providerReference: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('LedgerEntry', ledgerEntrySchema);