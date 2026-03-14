// controllers/orderController.js
const BaseController = require('./baseController');
const Order = require('../models/Order');
const logger = require('../utils/logger');

class OrderController extends BaseController {
  constructor() {
    super(null);
    this.getRunnerOrders = this.getRunnerOrders.bind(this);
    this.adminGetAllOrders = this.adminGetAllOrders.bind(this);
    this.getOrderByChatId = this.getOrderByChatId.bind(this);
  }

  async getOrderByChatId(req, res) {
    try {
      const { chatId } = req.params;
      const order = await Order.findOne({ chatId });
      if (!order) return this.notFound(res, 'No order found for this chat');
      this.success(res, order);
    } catch (err) {
      this.error(res, err.message);
    }
  }

  // GET /orders/runner/:runnerId
  async getRunnerOrders(req, res) {
    try {
      const { runnerId } = req.params;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      const [orders, total] = await Promise.all([
        Order.find({ runnerId })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .select('orderId serviceType status paymentStatus itemBudget createdAt cancelledAt completedAt userId')
          .populate('userId', 'currentRequest.marketItems currentRequest.budget currentRequest.pickupItems')
          .lean(),
        Order.countDocuments({ runnerId }),
      ]);

      return this.success(res, {
        orders,
        page,
        hasMore: skip + orders.length < total,
        total,
      });
    } catch (err) {
      logger.error('getRunnerOrders error:', err);
      return this.error(res, err.message);
    }
  }

  // GET /admin/orders
  async adminGetAllOrders(req, res) {
    try {
      const {
        page = 1, limit = 20,
        status, paymentStatus,
        runnerId, userId,
        from, to,
      } = req.query;

      const skip = (page - 1) * limit;
      const query = {};

      if (status) query.status = status;
      if (paymentStatus) query.paymentStatus = paymentStatus;
      if (runnerId) query.runnerId = runnerId;
      if (userId) query.userId = userId;
      if (from || to) {
        query.createdAt = {};
        if (from) query.createdAt.$gte = new Date(from);
        if (to) query.createdAt.$lte = new Date(to);
      }

      const [orders, total] = await Promise.all([
        Order.find(query)
          .populate('userId', 'firstName lastName phone email')
          .populate('runnerId', 'firstName lastName phone email')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        Order.countDocuments(query),
      ]);

      return this.success(res, {
        orders,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        hasMore: skip + orders.length < total,
      });
    } catch (err) {
      logger.error('adminGetAllOrders error:', err);
      return this.error(res, err.message);
    }
  }
}

module.exports = new OrderController();