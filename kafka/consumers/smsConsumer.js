const kafka = require('../config/kafka');
const smsService = require('../../services/smsService');

const consumer = kafka.consumer({ groupId: 'sms-group' });
const producer = kafka.producer();

const MAX_RETRIES = 3;

const startSmsConsumer = async () => {
  await consumer.connect();
  await producer.connect();

  await consumer.subscribe({ topic: 'sms', fromBeginning: false });
  await consumer.subscribe({ topic: 'sms-retry', fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const smsData = JSON.parse(message.value.toString());
      const retryCount = smsData.retryCount || 0;

      console.log(`Processing SMS [attempt ${retryCount + 1}]: ${smsData.type} → ${smsData.to}`);

      try {
        switch (smsData.type) {
          case 'otp':
            await smsService.sendOTP(smsData.to, smsData.otp);
            break;
          case 'password-reset':
            await smsService.sendPasswordResetSMS(smsData.to, smsData.resetToken);
            break;
          case 'alert':
            await smsService.sendSMS(smsData.to, 'alert', { message: smsData.message });
            break;
          default:
            await smsService.sendSMS(smsData.to, smsData.type, smsData.data || {});
        }

        console.log(`✅ SMS sent: ${smsData.type} → ${smsData.to}`);

      } catch (error) {
        console.error(`❌ SMS failed [attempt ${retryCount + 1}]:`, error.message);

        // Permanent failures — bad number, invalid format, opted out
        const isPermanent =
          error.message?.includes('invalid phone') ||
          error.message?.includes('not a valid') ||
          error.message?.includes('unsubscribed') ||
          error.message?.includes('blacklisted') ||
          error.code === 21211 || // Twilio invalid number
          error.code === 21610 || // Twilio unsubscribed
          retryCount >= MAX_RETRIES;

        if (isPermanent) {
          console.error(' SMS dead lettered:', { ...smsData, error: error.message });
          await producer.send({
            topic: 'sms-dlq',
            messages: [{
              value: JSON.stringify({
                ...smsData,
                error: error.message,
                deadLetteredAt: Date.now(),
              })
            }]
          });
          return; // Commit offset — move on
        }

        // Transient failure (Twilio down, timeout) — retry with backoff
        const delay = Math.pow(2, retryCount) * 2000; // 2s, 4s, 8s
        console.log(`Retrying SMS in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);

        await new Promise(r => setTimeout(r, delay));

        await producer.send({
          topic: 'sms-retry',
          messages: [{
            value: JSON.stringify({ ...smsData, retryCount: retryCount + 1 })
          }]
        });
      }
    },
  });

  console.log('SMS consumer started');
};

module.exports = { startSmsConsumer };