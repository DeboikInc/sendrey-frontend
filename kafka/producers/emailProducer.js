const kafka = require('../config/kafka');

const producer = kafka.producer();
let isConnected = false;

const connectProducer = async () => {
  if (!isConnected) {
    await producer.connect();
    isConnected = true;
    console.log('Email producer connected');
  }
};

const sendEmailEvent = async (emailData) => {
  try {
    await connectProducer();

    await producer.send({
      topic: 'emails',
      messages: [{
        value: JSON.stringify({
          ...emailData,
          retryCount: emailData.retryCount || 0,
          enqueuedAt: Date.now(),
        })
      }]
    });

    console.log(`Email event queued: ${emailData.type} → ${emailData.to}`);
  } catch (error) {
    console.error('Failed to queue email event:', error);
    // Don't throw — request continues even if Kafka is momentarily down
  }
};

module.exports = { sendEmailEvent, connectProducer };