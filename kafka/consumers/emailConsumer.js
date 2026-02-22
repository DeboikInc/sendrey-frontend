const kafka = require('../config/kafka');
const emailService = require('../../services/emailService');

const consumer = kafka.consumer({ groupId: 'email-group' });
const producer = kafka.producer(); // for dead letter + retry republish

const MAX_RETRIES = 3;

const startEmailConsumer = async () => {
  await consumer.connect();
  await producer.connect();

  await consumer.subscribe({ topic: 'emails', fromBeginning: false });
  await consumer.subscribe({ topic: 'emails-retry', fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const emailData = JSON.parse(message.value.toString());
      const retryCount = emailData.retryCount || 0;

      console.log(`Processing email [attempt ${retryCount + 1}]: ${emailData.type} → ${emailData.to}`);

      try {
        await emailService.sendEmail(
          emailData.to,
          emailData.subject,
          emailData.template,
          emailData.data
        );
        console.log(`✅ Email sent: ${emailData.type} → ${emailData.to}`);

      } catch (error) {
        console.error(`❌ Email failed [attempt ${retryCount + 1}]:`, error.message);

        // Permanent failures — don't retry (bad address, invalid template etc)
        const isPermanent =
          error.message?.includes('invalid email') ||
          error.message?.includes('does not exist') ||
          error.message?.includes('550') || // SMTP mailbox not found
          retryCount >= MAX_RETRIES;

        if (isPermanent) {
          // Dead letter — log loudly, store for manual review
          console.error('Email dead lettered:', { ...emailData, error: error.message });
          await producer.send({
            topic: 'emails-dlq',
            messages: [{
              value: JSON.stringify({
                ...emailData,
                error: error.message,
                deadLetteredAt: Date.now(),
              })
            }]
          });
          return; // Commit offset — move on
        }

        // Transient failure (provider down, timeout) — retry with backoff
        const delay = Math.pow(2, retryCount) * 2000; // 2s, 4s, 8s
        console.log(`Retrying email in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);

        await new Promise(r => setTimeout(r, delay));

        await producer.send({
          topic: 'emails-retry',
          messages: [{
            value: JSON.stringify({ ...emailData, retryCount: retryCount + 1 })
          }]
        });
      }
    },
  });

  console.log('Email consumer started');
};

module.exports = { startEmailConsumer };