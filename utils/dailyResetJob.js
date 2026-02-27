const cron = require('node-cron');
const Runner = require('../models/Runner');
const logger = require('./logger');

/**
 * Cron job that runs at midnight every day to reset daily errand counts
 * and restore isAvailable for approved_limited runners
 */
const startDailyResetJob = () => {
  // Run at midnight every day (0 0 * * *)
  cron.schedule('0 0 * * *', async () => {
    try {
      console.log('🕐 Running daily errand count reset...');
      
      const result = await Runner.updateMany(
        { 
          runnerStatus: 'approved_limited',
          dailyErrandCount: { $gt: 0 }
        },
        {
          $set: {
            dailyErrandCount: 0,
            lastErrandResetDate: new Date(),
            isAvailable: true
          }
        }
      );

      logger.info(`Daily reset complete: ${result.modifiedCount} runners reset`);
      console.log(`Reset ${result.modifiedCount} runners to 0 errands, isAvailable: true`);
      
    } catch (error) {
      logger.error('Daily reset job error:', error);
      console.error('Daily reset failed:', error);
    }
  });

  console.log(' Daily reset cron job started (runs at midnight)');
};

module.exports = { startDailyResetJob };