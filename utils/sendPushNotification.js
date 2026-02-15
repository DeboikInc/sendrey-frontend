const admin = require('../config/firebaseAdmin');

const sendPushNotification = async (fcmToken, notification) => {
  if (!fcmToken) {
    console.warn(' No FCM token provided');
    return null;
  }

  const message = {
    notification: {
      title: notification.title,
      body: notification.body,
    },
    data: notification.data || {},
    token: fcmToken,
    webpush: {
      notification: {
        icon: '/logo192.png',
        badge: '/logo192.png',
        requireInteraction: true,
      },
      fcmOptions: {
        link: notification.link || '/',
      },
    },
  };

  try {
    const response = await admin.messaging().send(message);
    console.log(' Push notification sent:', response);
    return response;
  } catch (error) {
    console.error('Error sending push notification:', error);
    
    // Handle invalid token
    if (error.code === 'messaging/invalid-registration-token' ||
        error.code === 'messaging/registration-token-not-registered') {
      console.log('Invalid FCM token');
      return { error: 'invalid_token' };
    }
    
    throw error;
  }
};

module.exports = { sendPushNotification };