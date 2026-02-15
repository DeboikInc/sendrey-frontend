const { sendPushNotification } = require('./utils/sendPushNotification');

app.post('/test-notification', async (req, res) => {
  const { fcmToken } = req.body;
  
  try {
    await sendPushNotification(fcmToken, {
      title: ' Test Notification',
      body: 'If you see this, push notifications work!',
      data: {
        type: 'test',
        chatId: 'test-123',
      },
      link: '/',
    });
    
    res.json({ success: true, message: 'Notification sent!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// curl -X POST http://localhost:4001/api/v1/test-notification \
//   -H "Content-Type: application/json" \
//   -d '{"fcmToken":"YOUR_FCM_TOKEN_HERE"}'