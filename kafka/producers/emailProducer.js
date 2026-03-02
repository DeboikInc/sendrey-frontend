// kafka/producers/emailProducer.js
const kafka = require('../config/kafka');
const { sendEmailDirect } = require('../consumers/emailConsumer'); 

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
    // Direct fallback: call consumer handler directly if Kafka is down
    console.log(`Kafka unavailable for email, calling consumer directly:`, error.message);
    
    try {
      await sendEmailDirect(emailData);
      console.log(`✅ Direct consumer call executed for email: ${emailData.type} → ${emailData.to}`);
    } catch (fallbackError) {
      console.error('❌ Direct consumer call failed:', fallbackError.message);
    }
  }
};

module.exports = { sendEmailEvent, connectProducer };