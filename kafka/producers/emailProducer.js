const { kafka, KAFKA_ENABLED } = require('../config/kafka');
const { sendEmailDirect } = require('../consumers/emailConsumer');

const producer = KAFKA_ENABLED ? kafka.producer() : null;
let isConnected = false;

const connectProducer = async () => {
  if (!isConnected) {
    await producer.connect();
    isConnected = true;
  }
};

const sendEmailEvent = async (emailData) => {
  if (!KAFKA_ENABLED) {
    return await sendEmailDirect(emailData); // zero overhead
  }

  try {
    await connectProducer();
    await producer.send({
      topic: 'emails',
      messages: [{ value: JSON.stringify({ ...emailData, retryCount: 0, enqueuedAt: Date.now() }) }],
    });
  } catch (error) {
    console.error(`Kafka unavailable for email, falling back:`, error.message);
    await sendEmailDirect(emailData);
  }
};

module.exports = { sendEmailEvent, connectProducer };