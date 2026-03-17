// kafka/producers/smsProducer.js
const kafka = require('../config/kafka');
const { sendSmsDirect } = require('../consumers/smsConsumer');

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
  // No Kafka broker configured — send directly
  if (!process.env.KAFKA_BROKER) {
    try {
      await sendSmsDirect(smsData);
    } catch (err) {
      console.error('Direct SMS failed:', err.message, err.stack);
    }
    return;
  }

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
    // Direct fallback: call consumer handler directly if Kafka is down
    console.log(`Kafka unavailable for SMS, calling consumer directly:`, error.message);

    try {
      await sendSmsDirect(smsData);
      console.log(`✅ Direct consumer call executed for SMS: ${smsData.type} → ${smsData.to}`);
    } catch (fallbackError) {
      console.error('❌ Direct consumer call failed:', fallbackError.message);
    }
  }
};

module.exports = { sendSmsEvent, connectProducer };