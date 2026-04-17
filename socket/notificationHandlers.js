const { sendPushNotification } = require('../utils/sendPushNotification');
const User = require('../models/User');
const Runner = require('../models/Runner');
const { logSocketAudit } = require('../utils/socketAudit');


/**
 * Send push notification for new message
 * Only if recipient is offline or not viewing the chat
 */
const sendMessageNotification = async (chatId, message, senderId, senderType) => {
  try {
    if (!chatId || !senderId || !senderType || senderId === 'system') {
      console.warn('sendMessageNotification: missing required fields, skipping');
      return;
    }

    // Extract userId and runnerId from chatId
    const parts = chatId.split('-runner-');
    const userId = parts[0]?.replace('user-', '');
    const runnerId = parts[1];

    if (!userId || !runnerId || userId === 'undefined' || runnerId === 'undefined') {
      console.warn('Bad chatId, skipping notification:', chatId);
      return;
    }

    let recipient;
    let recipientType;
    let senderName;

    // Determine recipient
    if (senderType === 'user') {
      recipient = await Runner.findById(runnerId);
      recipientType = 'runner';
      const sender = await User.findById(senderId);
      senderName = `${sender?.firstName || 'User'} ${sender?.lastName || ''}`;
    } else {
      recipient = await User.findById(userId);
      recipientType = 'user';
      const sender = await Runner.findById(senderId);
      senderName = `${sender?.firstName || 'Runner'} ${sender?.lastName || ''}`;
    }

    // Send push notification only if recipient is offline
    if (recipient && !recipient.isOnline && recipient.fcmToken) {
      const messagePreview = message.text
        ? (message.text.length > 50 ? message.text.substring(0, 50) + '...' : message.text)
        : message.type === 'image' ? '📷 Photo'
          : message.type === 'video' ? '🎥 Video'
            : message.type === 'audio' ? '🎵 Audio'
              : '📎 File';

      await sendPushNotification(recipient.fcmToken, {
        title: senderName,
        body: messagePreview,
        data: {
          type: 'message',
          chatId,
          messageId: message.id,
          senderId,
          senderType,
        },
        link: `/${recipientType}/chat/${chatId}`,
      });

      // console.log(`Message notification sent to ${recipientType} ${recipient._id}`);
    }
  } catch (error) {
    console.error('Error sending message notification:', error);
  }
};

/**
 * Send push notification for status update
 * Only if recipient is offline
 */
const sendStatusUpdateNotification = async (chatId, status, updatedBy, updatedByType) => {
  try {
    const parts = chatId.split('-runner-');
    const userId = parts[0]?.replace('user-', '');
    const runnerId = parts[1];

    // Status updates are sent to users only
    const user = await User.findById(userId);

    if (user && !user.isOnline && user.fcmToken) {
      const statusMessages = {
        'accepted': '✅ Runner accepted your request',
        'en_route_to_pickup': '🚗 Runner is on the way to pickup',
        'arrived_at_pickup': '📍 Runner has arrived at pickup location',
        'picked_up': '✅ Items picked up',
        'en_route_to_delivery': '🚚 Runner is on the way to you',
        'arrived_at_delivery': '📍 Runner has arrived',
        'delivered': '✅ Order delivered',
      };

      const message = statusMessages[status] || `Status updated to: ${status}`;

      await sendPushNotification(user.fcmToken, {
        title: '📦 Order Update',
        body: message,
        data: {
          type: 'status_update',
          chatId,
          status,
          updatedBy,
          updatedByType,
        },
        link: `/chat/${chatId}`,
      });

      // console.log(`Status update notification sent to user ${user._id}`);
    }
  } catch (error) {
    console.error('❌ Error sending status update notification:', error);
  }
};

module.exports = {
  sendMessageNotification,
  sendStatusUpdateNotification,
};