// controllers/admin/escrowAdminController.js
const BaseController      = require('./baseController');
const escrowAdminService  = require('../services/escrowAdminService');
const logger              = require('../utils/logger');

class EscrowAdminController extends BaseController {
    constructor() {
        super(null);
        this.getCancelledEscrows = this.getCancelledEscrows.bind(this);
        this.getEscrowDetails    = this.getEscrowDetails.bind(this);
        this.refundToWallet      = this.refundToWallet.bind(this);
    }

    // GET /api/v1/admin/escrows/cancelled
    async getCancelledEscrows(req, res) {
        try {
            const { page, limit } = req.query;
            const result = await escrowAdminService.getCancelledEscrows({ page, limit });
            return this.success(res, result);
        } catch (err) {
            logger.error('getCancelledEscrows error:', err);
            return this.error(res, err.message);
        }
    }

    // GET /api/v1/admin/escrows/:escrowId
    async getEscrowDetails(req, res) {
        try {
            const escrow = await escrowAdminService.getEscrowById(req.params.escrowId);
            return this.success(res, { escrow });
        } catch (err) {
            logger.error('getEscrowDetails error:', err);
            if (err.message === 'Escrow not found') return this.notFound(res, err.message);
            return this.error(res, err.message);
        }
    }

    // POST /api/v1/admin/escrows/:escrowId/refund
    async refundToWallet(req, res) {
        try {
            const adminId = req.user.id || req.user._id;
            const { reason } = req.body;
            const result = await escrowAdminService.refundToWallet(
                req.params.escrowId,
                adminId,
                reason
            );
            return this.success(
                res,
                result,
                `₦${result.refundAmount.toLocaleString()} refunded to ${result.user.firstName}'s wallet`
            );
        } catch (err) {
            logger.error('refundToWallet error:', err);
            if (err.message === 'Escrow not found')      return this.notFound(res, err.message);
            if (err.message.includes('already been'))    return this.badRequest(res, err.message);
            if (err.message.includes('Cannot refund'))   return this.badRequest(res, err.message);
            return this.error(res, err.message);
        }
    }
}

module.exports = new EscrowAdminController();