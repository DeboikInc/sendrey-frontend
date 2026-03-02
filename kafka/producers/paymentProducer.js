const kafka = require('../config/kafka');
const { handlers } = require('./paymentConsumer');

const producer = kafka.producer();
let isConnected = false;

const connectProducer = async () => {
  if (!isConnected) {
    await producer.connect();
    isConnected = true;
    console.log('Payment producer connected');
  }
};

/**
 * Payment topics:
 *  - payments.escrow.created   → escrow funded, notify runner + user
 *  - payments.escrow.released  → funds released to runner
 *  - payments.wallet.funded    → user topped up wallet
 *  - payments.withdrawal       → runner requested withdrawal
 *  - payments.item_budget.released → item budget released mid-task
 *  - payments.timeout.checked  → cron fired escrow timeout sweep
 */

const sendPaymentEvent = async (type, data) => {
  try {
    await connectProducer();

    const topicMap = {
      'escrow.created':         'payments.escrow.created',
      'escrow.released':        'payments.escrow.released',
      'wallet.funded':          'payments.wallet.funded',
      'withdrawal':             'payments.withdrawal',
      'item_budget.released':   'payments.item_budget.released',
      'timeout.checked':        'payments.timeout.checked',
    };

    const topic = topicMap[type];
    if (!topic) {
      console.warn(`Unknown payment event type: ${type}`);
      return;
    }

    await producer.send({
      topic,
      messages: [{
        key: data.userId?.toString() || data.orderId?.toString() || null,
        value: JSON.stringify({
          type,
          ...data,
          enqueuedAt: Date.now(),
        }),
      }],
    });

    console.log(`Payment event queued [${type}]:`, data.orderId || data.escrowId || data.userId);
  } catch (error) {
    // Direct fallback: call consumer handlers directly if Kafka is down
    console.log(`Kafka unavailable for [${type}], calling consumer directly:`, error.message);
    
    const handler = handlers[type];
    if (handler) {
      await handler(data);
      console.log(`Direct consumer call executed for [${type}]`);
    } else {
      console.warn(`No handler found for event type: ${type}`);
    }
  }
};

module.exports = { sendPaymentEvent, connectProducer };