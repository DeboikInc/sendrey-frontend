const BaseController = require('./baseController');
const disputeService = require('../services/disputeService');

class DisputeController extends BaseController {
  constructor() {
    super();
    this.raiseDispute = this.raiseDispute.bind(this);
    this.getRunnerDisputes = this.getRunnerDisputes.bind(this);
    // admin uses
    this.getDispute = this.getDispute.bind(this);
    this.resolveDispute = this.resolveDispute.bind(this);
    this.getAllDisputes = this.getAllDisputes.bind(this);
  }

  async raiseDispute(req, res) {
    try {
      const { orderId, chatId, reason, description, evidenceFiles } = req.body;
      const userId = req.user._id;
      const userType = req.user.userType || 'user';

      const dispute = await disputeService.raiseDispute({
        orderId,
        chatId,
        raisedBy: userType,
        raisedById: userId,
        reason,
        description,
        evidenceFiles
      });

      this.success(res, dispute);
    } catch (error) {
      console.error("dispute error", error.message, error)
      this.error(res, error.message);
    }
  }

  async resolveDispute(req, res) {
    try {
      const { disputeId } = req.params;
      const { outcome, releasePercentage, adminNote } = req.body;
      const resolvedBy = req.user._id;

      const result = await disputeService.resolveDispute({
        disputeId,
        outcome,
        releasePercentage,
        adminNote,
        resolvedBy
      });

      this.success(res, result);
    } catch (error) {
      this.error(res, error.message);
    }
  }

  async getRunnerDisputes(req, res) {
  try {
    const { runnerId } = req.params;
    const disputes = await disputeService.getDisputesByRunnerId(runnerId);
    this.success(res, { disputes });
  } catch (error) {
    this.error(res, error.message);
  }
}

  async getDispute(req, res) {
    try {
      const { orderId } = req.params;
      const dispute = await disputeService.getDisputeByOrderId(orderId);
      if (!dispute) return this.notFound(res, 'Dispute not found');
      this.success(res, dispute);
    } catch (error) {
      this.error(res, error.message);
    }
  }

  async getAllDisputes(req, res) {
    try {
      const { page = 1, limit = 20, status } = req.query;
      const result = await disputeService.getAllDisputes(
        parseInt(page),
        parseInt(limit),
        status
      );
      this.success(res, result);
    } catch (error) {
      this.error(res, error.message);
    }
  }
}

module.exports = new DisputeController();