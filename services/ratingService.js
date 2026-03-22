const Rating = require('../models/Rating');
const Runner = require('../models/Runner');
const Order = require('../models/Order');

/**
 * Submit rating after escrow release
 */
const submitRating = async ({ orderId, chatId, userId, runnerId, rating, feedback }) => {
  console.log('submitRating called with:', { orderId, chatId, userId, runnerId, rating, feedback });
  const order = await Order.findOne({ orderId });
  if (!order) throw new Error('Order not found');

  const completedStatuses = ['completed', 'task_completed', 'delivered'];
  if (!completedStatuses.includes(order.status)) {
    throw new Error('Can only rate after order is completed');
  }

  // Check isRated FIRST 
  if (order.isRated) throw new Error('You have already rated this order');

  if (rating < 1 || rating > 5) throw new Error('Rating must be between 1 and 5');

  const existingRating = await Rating.findOne({
    $or: [{ taskId: orderId }, { orderId }]
  });
  if (existingRating) throw new Error('You have already rated this order');

  try {
    const newRating = await Rating.create({
      taskId: orderId,
      orderId,
      chatId,
      userId,
      runnerId,
      rating,
      feedback: feedback?.trim() || null,
      submittedAt: new Date()
    });

    await updateRunnerRating(runnerId);
    await Order.findOneAndUpdate({ orderId }, { isRated: true });

    return newRating;
  } catch (error) {
    if (error.code === 11000) throw new Error('You have already rated this order');
    console.error('Error in submitRating:', error);
    throw error;
  }
};

/**
 * Recalculate and update runner's average rating
 */
const updateRunnerRating = async (runnerId) => {
  const ratings = await Rating.find({ runnerId });

  if (ratings.length === 0) return;

  const totalRating = ratings.reduce((sum, r) => sum + r.rating, 0);
  const averageRating = totalRating / ratings.length;

  await Runner.findByIdAndUpdate(runnerId, {
    rating: parseFloat(averageRating.toFixed(1)),
    totalRatings: ratings.length
  });

  console.log(`Runner ${runnerId} rating updated: ${averageRating.toFixed(1)}`);
};

/**
 * Get runner ratings
 */
const getRunnerRatings = async (runnerId, page = 1, limit = 10) => {
  const skip = (page - 1) * limit;

  const ratings = await Rating.find({ runnerId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('userId', 'firstName lastName avatar');

  const total = await Rating.countDocuments({ runnerId });
  const runner = await Runner.findById(runnerId).select('rating totalRatings');

  return {
    ratings,
    averageRating: runner?.rating || 0,
    totalRatings: runner?.totalRatings || total,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) }
  };
};

/**
 * Check if order can be rated
 */
const canRateOrder = async (orderId, userId) => {
  try {
    const order = await Order.findOne({ orderId });
    if (!order) return { canRate: false, reason: 'Order not found' };

    const completedStatuses = ['completed', 'task_completed', 'delivered'];
    if (!completedStatuses.includes(order.status)) {
      return { canRate: false, reason: 'Order not completed' };
    }

    // Check isRated first — most reliable single source of truth
    if (order.isRated) return { canRate: false, reason: 'Already rated' };

    // Check both fields to catch ratings from before the orderId field was added
    const existing = await Rating.findOne({
      $or: [{ taskId: orderId }, { orderId }]
    });
    if (existing) {
      // Also sync the flag if it somehow got out of sync
      await Order.findOneAndUpdate({ orderId }, { isRated: true });
      return { canRate: false, reason: 'Already rated' };
    }

    if (!order.userId) return { canRate: false, reason: 'Order has no user' };
    if (order.userId.toString() !== userId.toString()) {
      return { canRate: false, reason: 'Not authorized' };
    }

    return { canRate: true };
  } catch (err) {
    console.error('canRateOrder error:', err);
    throw err;
  }
};

module.exports = {
  submitRating,
  getRunnerRatings,
  canRateOrder,
  updateRunnerRating
};