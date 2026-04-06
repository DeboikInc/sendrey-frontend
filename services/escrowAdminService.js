const Escrow = require('../models/Escrows');
const Order  = require('../models/Order');
const User   = require('../models/User');
const logger = require('../utils/logger');

class EscrowAdminService {

    /**
     * Fetch all funded escrows whose linked order has been cancelled.
     * Also returns recently refunded escrows for audit trail.
     */
    async getCancelledEscrows({ page = 1, limit = 20 } = {}) {
        const skip = (page - 1) * limit;

        // Step 1 — get all cancelled order IDs
        const cancelledOrders = await Order.find({ status: 'cancelled' })
            .select('_id orderId')
            .lean();

        const cancelledOrderIds = cancelledOrders.map(o => o._id);

        // Step 2 — find funded/pending escrows linked to those orders
        const query = {
            orderId: { $in: cancelledOrderIds },
            status:  { $in: ['funded', 'pending'] },
        };

        const [escrows, total] = await Promise.all([
            Escrow.find(query)
                .populate('userId',   'firstName lastName email phone')
                .populate('runnerId', 'firstName lastName email phone')
                .populate('orderId',  'orderId status cancellationReason cancelledAt cancelledBy')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            Escrow.countDocuments(query),
        ]);

        // Step 3 — fetch recent refunded escrows for audit trail
        const refunded = await Escrow.find({
            orderId: { $in: cancelledOrderIds },
            status:  'refunded',
        })
            .populate('userId',  'firstName lastName email phone')
            .populate('orderId', 'orderId status')
            .sort({ updatedAt: -1 })
            .limit(10)
            .lean();

        return {
            escrows,
            refunded,
            total,
            page:       parseInt(page),
            limit:      parseInt(limit),
            totalPages: Math.ceil(total / parseInt(limit)),
        };
    }

    /**
     * Fetch a single escrow by ID with full population.
     */
    async getEscrowById(escrowId) {
        const escrow = await Escrow.findById(escrowId)
            .populate('userId',   'firstName lastName email phone')
            .populate('runnerId', 'firstName lastName email phone')
            .populate('orderId')
            .lean();

        if (!escrow) throw new Error('Escrow not found');
        return escrow;
    }

    /**
     * Refund escrow total amount to the user's wallet balance.
     * Guards against double-refunds and invalid escrow states.
     */
    async refundToWallet(escrowId, adminId, reason = 'Order cancelled — refund issued by admin') {
        const escrow = await Escrow.findById(escrowId)
            .populate('userId',  'firstName lastName email')
            .populate('orderId', 'orderId status');

        if (!escrow) throw new Error('Escrow not found');

        if (escrow.status === 'refunded') {
            throw new Error('This escrow has already been refunded');
        }

        if (!['funded', 'pending'].includes(escrow.status)) {
            throw new Error(`Cannot refund escrow with status: ${escrow.status}`);
        }

        const refundAmount = escrow.totalAmount;
        const userId       = escrow.userId._id || escrow.userId;

        // Credit user wallet
        const user = await User.findByIdAndUpdate(
            userId,
            { $inc: { walletBalance: refundAmount } },
            { new: true }
        );

        if (!user) throw new Error('User not found');

        // Mark escrow as refunded and store audit metadata
        escrow.status   = 'refunded';
        escrow.metadata = {
            ...escrow.metadata,
            refundedAt:         new Date(),
            refundedBy:         adminId,
            refundReason:       reason,
            refundAmount,
            refundedTo:         'wallet',
            walletBalanceAfter: user.walletBalance,
        };
        await escrow.save();

        logger.info(`Admin ${adminId} refunded ₦${refundAmount} to user ${userId} wallet for escrow ${escrowId}`);

        return {
            escrowId:      escrow._id,
            refundAmount,
            walletBalance: user.walletBalance,
            escrowStatus:  escrow.status,
            user: {
                _id:       user._id,
                firstName: user.firstName,
                lastName:  user.lastName,
                email:     user.email,
            },
        };
    }
}

module.exports = new EscrowAdminService();