const { kafka, KAFKA_ENABLED } = require('../config/kafka');
const { handlers } = require('../consumers/paymentConsumer');

const producer = KAFKA_ENABLED ? kafka.producer() : null;
let isConnected = false;

const topicMap = {
  'escrow.created':       'payments.escrow.created',
  'escrow.released':      'payments.escrow.released',
  'wallet.funded':        'payments.wallet.funded',
  'withdrawal':           'payments.withdrawal',
  'item_budget.released': 'payments.item_budget.released',
  'timeout.checked':      'payments.timeout.checked',
};

const connectProducer = async () => {
  if (!isConnected) {
    await producer.connect();
    isConnected = true;
  }
};

const sendPaymentEvent = async (type, data) => {
  if (!KAFKA_ENABLED) {
    const handler = handlers[type];
    if (!handler) return console.warn(`No handler for payment event: ${type}`);
    return await handler(data);
  }

  const topic = topicMap[type];
  if (!topic) return console.warn(`Unknown payment event type: ${type}`);

  try {
    await connectProducer();
    await producer.send({
      topic,
      messages: [{
        key: data.orderId?.toString() || data.userId?.toString() || null,
        value: JSON.stringify({ type, ...data, enqueuedAt: Date.now() }),
      }],
    });
  } catch (error) {
    console.error(`Kafka unavailable for [${type}], falling back:`, error.message);
    const handler = handlers[type];
    if (handler) await handler(data);
    else console.warn(`No handler for payment event: ${type}`);
  }
};

module.exports = { sendPaymentEvent, connectProducer };