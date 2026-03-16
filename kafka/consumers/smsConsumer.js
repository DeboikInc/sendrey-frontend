const kafka = require('../config/kafka');
const smsService = require('../../services/smsService');

const consumer = kafka.consumer({ groupId: 'sms-group' });
const producer = kafka.producer();

const MAX_RETRIES = 5;
const BASE_DELAY = 30 * 1000; // 30 seconds

const startSmsConsumer = async () => {
  try {
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

          console.log(`SMS sent: ${smsData.type} → ${smsData.to}`);

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
          const delay = Math.pow(2, retryCount) * BASE_DELAY; // 30s, 60s, 120s
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

  } catch (error) {
    console.error('SMS consumer failed to connect - continuing without Kafka:', error.message);
    // Don't throw - just log and return
    return;
  }

  console.log('SMS consumer started');
};

const sendSmsDirect = async (smsData) => {
  const { type, to, otp, message, resetToken } = smsData;
    console.log('[sendSmsDirect] called with:', { type: smsData.type, to: smsData.to });

  const body = (() => {
    switch (type) {
      case 'otp':
        return `Your Sendrey verification code is: ${otp}. Valid for 10 minutes.`;
      case 'password-reset':
        return `Your Sendrey password reset code is: ${resetToken}. Valid for 1 hour.`;
      case 'alert':
        return message;
      default:
        return message || 'Message from Sendrey';
    }
  })();

  // Call Twilio directly — bypass smsService.sendSMS template system
  const formatted = smsService.formatPhoneNumber(to);
  await smsService.client.messages.create({
    to: formatted,
    from: smsService.fromNumber,
    body,
  });

    console.log(`[sendSmsDirect] Twilio message created: ${smsData.type} → ${to}`);

  console.log(`SMS sent directly: ${type} → ${to}`);
};

module.exports = { startSmsConsumer, sendSmsDirect };