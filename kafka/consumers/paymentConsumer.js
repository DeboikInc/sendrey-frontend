const { kafka, KAFKA_ENABLED } = require('../config/kafka');
const { sendEmailEvent } = require('../producers/emailProducer');
const { sendSmsEvent } = require('../producers/smsProducer');
const {
  notifyPaymentSuccess,
  notifyEscrowReleased,
  notifyItemApprovalRequest,
  notifyItemApproved,
  notifyItemRejected,
  notifyDeliveryConfirmationRequest,
  notifyDeliveryConfirmed,
  notifyDisputeRaised,
  notifyDisputeResolved,
  notifyRatingPrompt,
  sendPushNotification,
} = require('../../services/notificationService');

const consumer = KAFKA_ENABLED ? kafka.consumer({ groupId: 'payment-group' }) : null;
const producer = KAFKA_ENABLED ? kafka.producer() : null; // for DLQ + retry

const MAX_RETRIES = 5;
const BASE_DELAY = 30 * 1000; // 30 seconds

const PAYMENT_TOPICS = [
  'payments.escrow.created',
  'payments.escrow.released',
  'payments.wallet.funded',
  'payments.withdrawal',
  'payments.item_budget.released',
  'payments.timeout.checked',
];

// ─── Handlers ─────────────────────────────────────────────────────────────────

const handlers = {

  'escrow.created': async (data) => {
    // Push → runner: job is funded, start the task
    await notifyPaymentSuccess(data.runnerId, {
      orderId: data.orderId,
      amount: data.runnerPayout,
    });

    // Push → user: payment locked in, runner is on it
    await sendPushNotification({
      recipientId: data.userId,
      recipientType: 'user',
      title: '🔒 Payment Secured',
      body: `Your payment of ₦${data.totalAmount?.toLocaleString()} is locked in. Your runner is starting the task!`,
      data: { type: 'escrow_created', orderId: data.orderId },
    });

    // Email → user
    await sendEmailEvent({
      type: 'escrow-created',
      to: data.userEmail,
      subject: 'Your payment is secured',
      template: 'escrow-created',
      data: {
        userName: data.userName,
        orderId: data.orderId,
        amount: data.totalAmount,
        runnerName: data.runnerName,
      },
    });

    // SMS → runner
    await sendSmsEvent({
      type: 'alert',
      to: data.runnerPhone,
      message: `Order #${data.orderId} payment confirmed. ₦${data.runnerPayout} held for you. Start the task!`,
    });
  },

  'escrow.released': async (data) => {
    // Push → runner: money in wallet
    await notifyEscrowReleased(data.runnerId, {
      orderId: data.orderId,
      amount: data.runnerPayout,
    });

    // Push → user: task fully settled + rating prompt
    await notifyRatingPrompt(data.userId, {
      orderId: data.orderId,
      runnerName: data.runnerName,
    });

    // Email → runner
    await sendEmailEvent({
      type: 'escrow-released',
      to: data.runnerEmail,
      subject: 'Payment released to your wallet',
      template: 'escrow-released',
      data: {
        runnerName: data.runnerName,
        orderId: data.orderId,
        amount: data.runnerPayout,
      },
    });

    // SMS → user
    await sendSmsEvent({
      type: 'alert',
      to: data.userPhone,
      message: `Task #${data.orderId} complete. ₦${data.runnerPayout} released to runner. Thanks for using Sendrey!`,
    });
  },

  'item_budget.released': async (data) => {
    // Push → runner: item budget in wallet
    await notifyItemApproved(data.runnerId, {
      orderId: data.orderId,
    });

    // SMS → runner
    await sendSmsEvent({
      type: 'alert',
      to: data.runnerPhone,
      message: `Item budget of ₦${data.itemBudget?.toLocaleString()} for order #${data.orderId} released to your wallet.`,
    });
  },

  'item_budget.approval_request': async (data) => {
    // Push → user: runner submitted items, review needed
    await notifyItemApprovalRequest(data.userId, {
      orderId: data.orderId,
      totalAmount: data.totalAmount,
    });
  },

  'item_budget.rejected': async (data) => {
    // Push → runner: user rejected items
    await notifyItemRejected(data.runnerId, {
      orderId: data.orderId,
      reason: data.rejectionReason,
    });
  },

  'delivery.confirmation_request': async (data) => {
    // Push → user: runner marked delivery done, needs confirmation
    await notifyDeliveryConfirmationRequest(data.userId, {
      orderId: data.orderId,
    });
  },

  'wallet.funded': async (data) => {
    // Push → user: wallet topped up
    await sendPushNotification({
      recipientId: data.userId,
      recipientType: 'user',
      title: '💰 Wallet Funded',
      body: `₦${data.amount?.toLocaleString()} added to your wallet. New balance: ₦${data.newBalance?.toLocaleString()}.`,
      data: { type: 'wallet_funded' },
    });

    // Email → user
    await sendEmailEvent({
      type: 'wallet-funded',
      to: data.userEmail,
      subject: 'Wallet funded successfully',
      template: 'wallet-funded',
      data: {
        userName: data.userName,
        amount: data.amount,
        newBalance: data.newBalance,
      },
    });
  },

  'withdrawal': async (data) => {
    // Push → runner: their withdrawal is being processed
    await sendPushNotification({
      recipientId: data.runnerId,
      recipientType: 'runner',
      title: '🏦 Withdrawal Initiated',
      body: `₦${data.amount?.toLocaleString()} withdrawal to ${data.bankName} is being processed.`,
      data: { type: 'withdrawal_initiated' },
    });

    // Email → runner
    await sendEmailEvent({
      type: 'withdrawal-initiated',
      to: data.runnerEmail,
      subject: 'Withdrawal request received',
      template: 'withdrawal-initiated',
      data: {
        runnerName: data.runnerName,
        amount: data.amount,
        bankName: data.bankName,
        accountNumber: data.accountNumber,
      },
    });
  },

  'dispute.raised': async (data) => {
    await notifyDisputeRaised({
      userId: data.userId,
      runnerId: data.runnerId,
      orderId: data.orderId,
      raisedBy: data.raisedBy,
    });
  },

  'dispute.resolved': async (data) => {
    await notifyDisputeResolved({
      userId: data.userId,
      runnerId: data.runnerId,
      orderId: data.orderId,
      outcome: data.outcome,
    });
  },

  'timeout.checked': async (data) => {
    if (data.releasedCount > 0) {
      console.log(`[Timeout Sweep] Auto-released ${data.releasedCount} escrows`);
    }
  },
};

// ─── Consumer

const startPaymentConsumer = async () => {
  if (!KAFKA_ENABLED) {
    console.log('Kafka disabled — PAYMENT consumer skipped');
    return;
  }

  try {
    await consumer.connect();
    await producer.connect();

    for (const topic of PAYMENT_TOPICS) {
      await consumer.subscribe({ topic, fromBeginning: false });
    }

    await consumer.subscribe({ topic: 'payments-retry', fromBeginning: false });

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const eventData = JSON.parse(message.value.toString());
        const retryCount = eventData.retryCount || 0;
        const eventType = eventData.type;

        // console.log(`Processing payment event [attempt ${retryCount + 1}]: ${eventType}`);

        try {
          const handler = handlers[eventType];
          if (!handler) {
            console.warn(`No handler for payment event type: ${eventType} — skipping`);
            return;
          }

          await handler(eventData);
          // console.log(`✅ Payment event handled: ${eventType}`);

        } catch (error) {
          console.error(`❌ Payment event failed [attempt ${retryCount + 1}]: ${eventType}`, error.message);

          const isPermanent =
            error.message?.includes('not found') ||
            error.message?.includes('invalid') ||
            retryCount >= MAX_RETRIES;

          if (isPermanent) {
            console.error('Payment event dead lettered:', { ...eventData, error: error.message });
            await producer.send({
              topic: 'payments-dlq',
              messages: [{
                value: JSON.stringify({
                  ...eventData,
                  error: error.message,
                  deadLetteredAt: Date.now(),
                }),
              }],
            });
            return;
          }

          const delay = Math.pow(2, retryCount) * BASE_DELAY;
          console.log(`Retrying payment event in ${delay}ms (${retryCount + 1}/${MAX_RETRIES})`);
          await new Promise(r => setTimeout(r, delay));

          await producer.send({
            topic: 'payments-retry',
            messages: [{
              value: JSON.stringify({ ...eventData, retryCount: retryCount + 1 }),
            }],
          });
        }
      },
    });

    console.log('Payment consumer started');
  } catch (error) {
    console.error('Payment consumer failed to connect - continuing without Kafka:', error.message);
    // Don't throw - just log and return
    return;
  }
};

module.exports = { startPaymentConsumer };