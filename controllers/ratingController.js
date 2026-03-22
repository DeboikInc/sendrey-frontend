const BaseController = require('./baseController');
const ratingService = require('../services/ratingService');
const mongoose = require('mongoose');

class RatingController extends BaseController {
  constructor() {
    super();
    this.submitRating = this.submitRating.bind(this);
    this.getRunnerRatings = this.getRunnerRatings.bind(this);
    this.canRateOrder = this.canRateOrder.bind(this);
  }

  async submitRating(req, res) {
    try {
      const { orderId, chatId, rating, feedback } = req.body;
      const userId = req.user._id;

      const runnerId = req.body.runnerId
        ? new mongoose.Types.ObjectId(req.body.runnerId)
        : null;

      if (!runnerId) return this.error(res, 'runnerId is required');

      const submitNewRating = await ratingService.submitRating({
        orderId,
        chatId,
        userId,
        runnerId,
        rating,
        feedback
      });

      this.success(res, submitNewRating);
    } catch (error) {
      this.error(res, error.message);
    }
  }

  async getRunnerRatings(req, res) {
    try {
      const { runnerId } = req.params;
      const { page = 1, limit = 10 } = req.query;

      const result = await ratingService.getRunnerRatings(
        runnerId,
        parseInt(page),
        parseInt(limit)
      );

      this.success(res, result);
    } catch (error) {
      this.error(res, error.message);
    }
  }

  async canRateOrder(req, res) {
    try {
      const { orderId } = req.params;
      const userId = req.user?._id;

      if (!userId) return this.error(res, 'Unauthorized');
      if (!orderId) return this.error(res, 'orderId is required');

      const result = await ratingService.canRateOrder(orderId, userId);
      this.success(res, result);
    } catch (error) {
      console.error('canRateOrder controller error:', error);
      this.error(res, error.message);
    }
  }
}

module.exports = new RatingController();