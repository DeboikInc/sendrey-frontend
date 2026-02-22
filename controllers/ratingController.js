const BaseController = require('./baseController');
const ratingService = require('../services/ratingService');

class RatingController extends BaseController {
  constructor() {
    super();
    this.submitRating = this.submitRating.bind(this);
    this.getRunnerRatings = this.getRunnerRatings.bind(this);
    this.canRateOrder = this.canRateOrder.bind(this);
  }

  async submitRating(req, res) {
    try {
      const { orderId, chatId, runnerId, rating, feedback } = req.body;
      const userId = req.user._id;

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
      const userId = req.user._id;
      const result = await ratingService.canRateOrder(orderId, userId);
      this.success(res, result);
    } catch (error) {
      this.error(res, error.message);
    }
  }
}

module.exports = new RatingController();