const Escrow      = require('../models/Escrows');
const Order       = require('../models/Order');
const User        = require('../models/User');
const Wallet      = require('../models/Wallet');
const logger      = require('../utils/logger');
const emailService = require('./emailService');

class EscrowAdminService {

    /**
     * Fetch all funded escrows whose linked order has been cancelled.
     * Also returns recently refunded escrows for audit trail.
     */
    async getCancelledEscrows({ page = 1, limit = 20 } = {}) {
        const skip = (page - 1) * limit;

        const cancelledOrders = await Order.find({ status: 'cancelled' })
            .select('_id orderId')
            .lean();

        const cancelledOrderIds = cancelledOrders.map(o => o._id);

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
     * Refund escrow total amount to the user's Wallet document.
     * Uses wallet.credit() which also creates a Transaction record.
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

        // ✅ Find the user's wallet document
        const wallet = await Wallet.findOne({ userId, userType: 'user' });

        if (!wallet) {
            throw new Error(`No wallet found for user ${userId}. User may need to create a wallet first.`);
        }

        if (wallet.status !== 'active') {
            throw new Error(`User wallet is ${wallet.status} — cannot process refund`);
        }

        // ✅ Credit the wallet using the model's credit() method
        // This also creates a Transaction record automatically
        await wallet.credit(
            refundAmount,
            `REFUND-${escrow._id}`,
            {
                type:     'escrow_refund',
                escrowId: escrow._id,
                orderId:  escrow.orderId?._id || escrow.orderId,
                reason,
                refundedBy: adminId,
            }
        );

        // ✅ Mark escrow as refunded with full audit metadata
        escrow.status   = 'refunded';
        escrow.metadata = {
            ...escrow.metadata,
            refundedAt:         new Date(),
            refundedBy:         adminId,
            refundReason:       reason,
            refundAmount,
            refundedTo:         'wallet',
            walletId:           wallet._id,
            walletBalanceAfter: wallet.balance,
        };
        await escrow.save();

        logger.info(
            `Admin ${adminId} refunded ₦${refundAmount} to wallet ${wallet._id} ` +
            `(user ${userId}) for escrow ${escrowId}`
        );

        // ✅ Send notification email — non-blocking, errors logged not thrown
        try {
            const user = await User.findById(userId).select('firstName lastName email').lean();
            if (user) await emailService.sendRefundNotification(user, escrow);
        } catch (emailErr) {
            logger.error('Refund notification email failed:', emailErr.message);
        }

        return {
            escrowId:      escrow._id,
            refundAmount,
            walletBalance: wallet.balance,
            escrowStatus:  escrow.status,
            user: {
                _id:       escrow.userId._id,
                firstName: escrow.userId.firstName,
                lastName:  escrow.userId.lastName,
                email:     escrow.userId.email,
            },
        };
    }
}

module.exports = new EscrowAdminService();