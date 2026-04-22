const { kafka, KAFKA_ENABLED } = require('../config/kafka');
const { sendSmsDirect } = require('../consumers/smsConsumer');

const producer = KAFKA_ENABLED ? kafka.producer() : null;
let isConnected = false;

const connectProducer = async () => {
  if (!isConnected) {
    await producer.connect();
    isConnected = true;
  }
};

const sendSmsEvent = async (smsData) => {
  if (!KAFKA_ENABLED) {
    return await sendSmsDirect(smsData);
  }

  try {
    await connectProducer();
    await producer.send({
      topic: 'sms',
      messages: [{ value: JSON.stringify({ ...smsData, retryCount: 0, enqueuedAt: Date.now() }) }],
    });
  } catch (error) {
    console.error(`Kafka unavailable for SMS, falling back:`, error.message);
    await sendSmsDirect(smsData);
  }
};

module.exports = { sendSmsEvent, connectProducer };