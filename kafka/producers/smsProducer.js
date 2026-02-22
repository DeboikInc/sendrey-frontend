const kafka = require('../config/kafka');

const producer = kafka.producer();
let isConnected = false;

const connectProducer = async () => {
  if (!isConnected) {
    await producer.connect();
    isConnected = true;
    console.log('SMS producer connected');
  }
};

const sendSmsEvent = async (smsData) => {
  try {
    await connectProducer();

    await producer.send({
      topic: 'sms',
      messages: [{
        value: JSON.stringify({
          ...smsData,
          retryCount: smsData.retryCount || 0,
          enqueuedAt: Date.now(),
        })
      }]
    });

    console.log(`SMS event queued: ${smsData.type} → ${smsData.to}`);
  } catch (error) {
    console.error('Failed to queue SMS event:', error);
    // Don't throw — request continues even if Kafka is momentarily down
  }
};

module.exports = { sendSmsEvent, connectProducer };