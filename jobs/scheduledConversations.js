// jobs/scheduledConversations.js
const cron = require('node-cron');
const User = require('../models/User');

// stores active cron jobs so we can cancel them if a schedule is deleted
const activeJobs = new Map();

const registerScheduledConversation = (businessOwnerId, label, cronExpression) => {
  const jobId = `${businessOwnerId}-${label}`;

  // cancel the existing job first if re-registering
  if (activeJobs.has(jobId)) {
    activeJobs.get(jobId).stop();
    activeJobs.delete(jobId);
  }

  if (!cron.validate(cronExpression)) {
    console.warn(`Invalid cron expression for "${label}": ${cronExpression}`);
    return;
  }

  const job = cron.schedule(cronExpression, async () => {
    try {
      // we don't have a chat system to call directly here, so we store
      // a pending prompt on the user — the frontend polls or websocket picks it up
      await User.findByIdAndUpdate(
        businessOwnerId,
        {
          $push: {
            pendingPrompts: {
              message: `It's time for your "${label}". Would you like me to proceed?`,
              createdAt: new Date(),
            }
          },
          $set: {
            'businessProfile.scheduledConversations.$[elem].lastTriggeredAt': new Date()
          }
        },
        {
          arrayFilters: [{ 'elem.label': label }]
        }
      );

      console.log(`Scheduled prompt triggered for: ${label}`);
    } catch (err) {
      console.error(`Failed to trigger scheduled conversation "${label}":`, err.message);
    }
  });

  activeJobs.set(jobId, job);
  console.log(`Scheduled job registered: "${label}" (${cronExpression})`);
};

// called once on server startup — restores all jobs that were active before restart
const restoreAllScheduledJobs = async () => {
  try {
    const businesses = await User.find({
      accountType: 'business',
      'businessProfile.scheduledConversations.isActive': true,
    });

    for (const business of businesses) {
      for (const sc of business.businessProfile.scheduledConversations) {
        if (sc.isActive) {
          registerScheduledConversation(business._id, sc.label, sc.cronExpression);
        }
      }
    }

    console.log(`Restored scheduled jobs for ${businesses.length} business accounts`);
  } catch (err) {
    console.error('Failed to restore scheduled jobs:', err.message);
  }
};

module.exports = { registerScheduledConversation, restoreAllScheduledJobs };