const Rating = require('../models/Rating');
const Runner = require('../models/Runner');
const Order = require('../models/Order');

/**
 * Submit rating after escrow release
 */
const submitRating = async ({
  orderId,
  chatId,
  userId,
  runnerId,
  rating,
  feedback
}) => {
  console.log('submitRating called with:', { orderId, chatId, userId, runnerId, rating, feedback });
  // Verify order is completed
  const order = await Order.findOne({ orderId });

  console.log('Order found:', order?.orderId, '| status:', order?.status, '| isRated:', order?.isRated);
  if (!order) throw new Error('Order not found');

  // if (order.status !== 'completed') {
  //   throw new Error('Can only rate after order is completed');
  // }

  // Prevent duplicate ratings
  const existingRating = await Rating.findOne({ orderId });
  console.log('Existing rating:', existingRating?._id || 'none');
  if (existingRating) throw new Error('You have already rated this order');

  // Validate rating
  if (rating < 1 || rating > 5) throw new Error('Rating must be between 1 and 5');

  try {
    // Create rating
    console.log('Creating rating with taskId:', orderId, '| rating:', rating);

    const newRating = await Rating.create({
      taskId: orderId,
      chatId,
      userId,
      runnerId,
      rating,
      feedback: feedback?.trim() || null,
      submittedAt: new Date()
    });

    // Update runner's average rating
    await updateRunnerRating(runnerId);

    // Mark order as rated
    await Order.findOneAndUpdate(
      { orderId },
      { isRated: true }
    );

    console.log(`Rating submitted for order ${orderId}: ${rating.rating}/5`);

    return newRating;
  } catch (error) {

    console.error('Error in submitRating:', error);
    throw new Error('Failed to submit rating');
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
  const order = await Order.findOne({ orderId });
  if (!order) return { canRate: false, reason: 'Order not found' };

  // if (order.status !== 'completed') return { canRate: false, reason: 'Order not completed' };

  const existing = await Rating.findOne({ taskId: orderId });
  if (existing) return { canRate: false, reason: 'Already rated' };

  if (order.userId.toString() !== userId.toString()) return { canRate: false, reason: 'Not authorized' };
  return { canRate: true };
};

module.exports = {
  submitRating,
  getRunnerRatings,
  canRateOrder,
  updateRunnerRating
};