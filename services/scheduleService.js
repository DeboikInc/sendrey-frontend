const cron = require('node-cron');
const User = require('../models/User');
const { sendPushNotification } = require('./notificationService');

const startScheduler = (io) => {
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      const fiveMinWarning = new Date(now.getTime() + 5 * 60 * 1000);
      const sixMinWarning = new Date(now.getTime() + 6 * 60 * 1000);
      const windowEnd = new Date(now.getTime() + 60 * 1000);

      const users = await User.find({
        accountType: 'business',
        'businessProfile.scheduledConversations': {
          $elemMatch: {
            isActive: true,
            scheduledAt: { $gte: now, $lte: sixMinWarning }
          }
        }
      }).populate('businessProfile.members.userId', 'firstName _id');

      for (const user of users) {
        for (const schedule of user.businessProfile.scheduledConversations) {
          if (!schedule.isActive) continue;
          const due = new Date(schedule.scheduledAt);

          const isDue = due >= now && due <= windowEnd;
          const isFiveMinWarning = due >= fiveMinWarning && due <= sixMinWarning;

          // ── 5 min warning — notify all members ──────────────────────────
          if (isFiveMinWarning) {
            const members = user.businessProfile.members || [];

            for (const member of members) {
              const memberId = member.userId?._id || member.userId;
              if (!memberId) continue;

              await sendPushNotification({
                recipientId: memberId,
                recipientType: 'user',
                title: '⏰ Upcoming Scheduled Delivery',
                body: `"${schedule.label}" is scheduled in 5 minutes.`,
                data: {
                  type: 'schedule_warning',
                  scheduleId: schedule._id.toString(),
                  label: schedule.label
                }
              });
            }

            console.log(`[scheduler] 5-min warning sent for ${schedule.label} to ${members.length} members`);
          }

          // ── Due — notify all members + show prompt to admin ─────────────
          if (isDue) {
            const members = user.businessProfile.members || [];

            for (const member of members) {
              const memberId = member.userId?._id || member.userId;
              if (!memberId) continue;

              await sendPushNotification({
                recipientId: memberId,
                recipientType: 'user',
                title: '🕐 Scheduled Delivery Now',
                body: `It's time for "${schedule.label}". Open Sendrey to proceed.`,
                data: {
                  type: 'schedule_reminder',
                  scheduleId: schedule._id.toString(),
                  label: schedule.label
                }
              });
            }

            // socket prompt only to the admin
            io.to(`user-${user._id}`).emit('scheduleReminder', {
              scheduleId: schedule._id,
              label: schedule.label,
              message: `It's time for your scheduled delivery: "${schedule.label}". Would you like to proceed?`
            });

            // deactivate so it doesn't fire again
            await User.updateOne(
              {
                _id: user._id,
                'businessProfile.scheduledConversations._id': schedule._id
              },
              {
                $set: {
                  'businessProfile.scheduledConversations.$.isActive': false
                }
              }
            );

            console.log(`[scheduler] Reminder sent and deactivated for ${schedule.label}`);
          }
        }
      }
    } catch (err) {
      console.error('[scheduler] Error:', err.message);
    }
  });

  console.log('[scheduler] Schedule checker running');
};

module.exports = { startScheduler };