// controllers/admin/escrowAdminController.js
const BaseController = require('./baseController');
const Escrow = require('../models/Escrows');
const Order = require('../models/Order');
const User = require('../models/User');
const logger = require('../utils/logger');

class EscrowAdminController extends BaseController {
    constructor() {
        super(null);
        this.getCancelledEscrows = this.getCancelledEscrows.bind(this);
        this.getEscrowDetails    = this.getEscrowDetails.bind(this);
        this.refundToWallet      = this.refundToWallet.bind(this);
    }

    // GET /admin/escrows/cancelled
    // Returns all funded escrows whose linked order has been cancelled
    async getCancelledEscrows(req, res) {
        try {
            const { page = 1, limit = 20 } = req.query;
            const skip = (page - 1) * limit;

            // Find all cancelled orders
            const cancelledOrders = await Order.find({ status: 'cancelled' })
                .select('_id orderId')
                .lean();

            const cancelledOrderIds = cancelledOrders.map(o => o._id);

            // Find funded escrows linked to those cancelled orders
            const [escrows, total] = await Promise.all([
                Escrow.find({
                    orderId:  { $in: cancelledOrderIds },
                    status:   { $in: ['funded', 'pending'] }, // not yet refunded
                })
                    .populate('userId',   'firstName lastName email phone')
                    .populate('runnerId', 'firstName lastName email phone')
                    .populate('orderId',  'orderId status cancellationReason cancelledAt cancelledBy')
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(parseInt(limit))
                    .lean(),

                Escrow.countDocuments({
                    orderId: { $in: cancelledOrderIds },
                    status:  { $in: ['funded', 'pending'] },
                }),
            ]);

            // Also include already-refunded escrows for audit trail
            const refunded = await Escrow.find({
                orderId: { $in: cancelledOrderIds },
                status:  'refunded',
            })
                .populate('userId',   'firstName lastName email phone')
                .populate('orderId',  'orderId status')
                .sort({ updatedAt: -1 })
                .limit(10)
                .lean();

            return this.success(res, {
                escrows,
                refunded,
                total,
                page:       parseInt(page),
                limit:      parseInt(limit),
                totalPages: Math.ceil(total / parseInt(limit)),
            });
        } catch (err) {
            logger.error('getCancelledEscrows error:', err);
            return this.error(res, err.message);
        }
    }

    // GET /admin/escrows/:escrowId
    async getEscrowDetails(req, res) {
        try {
            const { escrowId } = req.params;

            const escrow = await Escrow.findById(escrowId)
                .populate('userId',   'firstName lastName email phone')
                .populate('runnerId', 'firstName lastName email phone')
                .populate('orderId')
                .lean();

            if (!escrow) return this.notFound(res, 'Escrow not found');

            return this.success(res, { escrow });
        } catch (err) {
            logger.error('getEscrowDetails error:', err);
            return this.error(res, err.message);
        }
    }

    // POST /admin/escrows/:escrowId/refund
    // Refunds the escrow total amount to the user's wallet balance
    async refundToWallet(req, res) {
        try {
            const { escrowId } = req.params;
            const { reason = 'Order cancelled — refund issued by admin' } = req.body;
            const adminId = req.user.id || req.user._id;

            const escrow = await Escrow.findById(escrowId)
                .populate('userId',  'firstName lastName email')
                .populate('orderId', 'orderId status');

            if (!escrow) return this.notFound(res, 'Escrow not found');

            if (escrow.status === 'refunded') {
                return this.badRequest(res, 'This escrow has already been refunded');
            }

            if (!['funded', 'pending'].includes(escrow.status)) {
                return this.badRequest(res, `Cannot refund escrow with status: ${escrow.status}`);
            }

            const refundAmount = escrow.totalAmount;

            // ✅ Credit user's wallet balance
            const user = await User.findByIdAndUpdate(
                escrow.userId._id || escrow.userId,
                { $inc: { walletBalance: refundAmount } },
                { new: true }
            );

            if (!user) return this.notFound(res, 'User not found');

            // ✅ Mark escrow as refunded
            escrow.status = 'refunded';
            escrow.metadata = {
                ...escrow.metadata,
                refundedAt:     new Date(),
                refundedBy:     adminId,
                refundReason:   reason,
                refundAmount,
                refundedTo:     'wallet',
                walletBalanceAfter: user.walletBalance,
            };
            await escrow.save();

            logger.info(`Admin ${adminId} refunded ₦${refundAmount} to user ${user._id} wallet for escrow ${escrowId}`);

            return this.success(res, {
                escrowId:           escrow._id,
                refundAmount,
                walletBalance:      user.walletBalance,
                escrowStatus:       escrow.status,
                user: {
                    _id:       user._id,
                    firstName: user.firstName,
                    lastName:  user.lastName,
                    email:     user.email,
                },
            }, `₦${refundAmount.toLocaleString()} refunded to ${user.firstName}'s wallet`);
        } catch (err) {
            logger.error('refundToWallet error:', err);
            return this.error(res, err.message);
        }
    }
}

module.exports = new EscrowAdminController();