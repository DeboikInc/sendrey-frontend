const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema({
  taskId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  orderId: {
    type: String,
    default: null,
    index: true
  },
  runnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Runner',
    required: true,
    index: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  feedback: {
    type: String,
    default: null,
    maxlength: 500
  },
  // Rating categories (optional)
  categories: {
    timeliness: {
      type: Number,
      min: 1,
      max: 5,
      default: null
    },
    accuracy: {
      type: Number,
      min: 1,
      max: 5,
      default: null
    }
  },
  // Flags
  edited: {
    type: Boolean,
    default: false
  },
  visible: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes
ratingSchema.index({ runnerId: 1, createdAt: -1 });
ratingSchema.index({ userId: 1 });
ratingSchema.index({ rating: 1 });

// Static method to update runner's average rating
ratingSchema.statics.updateRunnerRating = async function (runnerId) {
  const Runner = mongoose.model('Runner');

  const stats = await this.aggregate([
    { $match: { runnerId: new mongoose.Types.ObjectId(runnerId), visible: true } },
    {
      $group: {
        _id: null,
        avgRating: { $avg: '$rating' },
        totalRatings: { $sum: 1 }
      }
    }
  ]);

  if (stats.length > 0) {
    await Runner.findByIdAndUpdate(runnerId, {
      rating: parseFloat(stats[0].avgRating.toFixed(2)),
      totalRatings: stats[0].totalRatings
    });
  }
};

// Post-save hook to update runner rating
ratingSchema.post('save', async function () {
  await this.constructor.updateRunnerRating(this.runnerId);
});

const Rating = mongoose.model('Rating', ratingSchema);

module.exports = Rating;