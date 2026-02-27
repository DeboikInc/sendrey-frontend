const { startEmailConsumer } = require('./emailConsumer');
const { startSmsConsumer } = require('./smsConsumer');
const { startPaymentConsumer } = require('./paymentConsumer');

const startAllConsumers = async () => {
  try {
    console.log('Starting Kafka consumers...');
    
    await Promise.all([
      startEmailConsumer(),
      startSmsConsumer(),
      startPaymentConsumer(),
      
    ]);
    
    console.log(' All Kafka consumers started');
  } catch (error) {
    console.log('❌ Failed to start Kafka consumers:', error);
    process.exit(1);
  }
};

module.exports = { startAllConsumers };