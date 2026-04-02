const admin = require('../config/firebaseAdmin'); // your existing firebase config
const User = require('../models/User');
const Runner = require('../models/Runner');

/**
 * Send push notification to a user or runner
 */
const sendPushNotification = async ({
  recipientId,
  recipientType, // 'user' | 'runner'
  title,
  body,
  data = {}
}) => {
  try {
    // Get FCM token
    const Model = recipientType === 'runner' ? Runner : User;
    const recipient = await Model.findById(recipientId).select('fcmToken');

    if (!recipient?.fcmToken) {
      console.log(`No FCM token for ${recipientType} ${recipientId}`);
      return null;
    }

    n
    const message = {
      token: recipient.fcmToken,
      notification: { title, body },
      data: Object.fromEntries(
        Object.entries({ ...data, click_action: 'FLUTTER_NOTIFICATION_CLICK' })
          .map(([k, v]) => [k, String(v)])  // FCM requires all values to be strings
      ),
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: data?.type === 'incoming_call' ? 'calls' : 'sendrey_notifications',
        }
      },
      apns: {
        payload: {
          aps: {
            sound: data?.type === 'incoming_call' ? 'default' : 'default',
            badge: 1,
            'content-available': 1, // wake app in background on iOS
          }
        },
        headers: {
          'apns-priority': data?.type === 'incoming_call' ? '10' : '5',
        }
      }
    };

    const response = await admin.messaging().send(message);
    console.log(`✅ Push sent to ${recipientType} ${recipientId}:`, title);
    return response;

  } catch (error) {
    // Don't throw - notification failure shouldn't break the flow
    console.error(`❌ Push notification failed:`, error.message);
    return null;
  }
};

// ─── Specific notification helpers ────────────────────────────────────────────

const notifyPaymentRequest = async (userId, { orderId, amount }) => {
  return sendPushNotification({
    recipientId: userId,
    recipientType: 'user',
    title: '💳 Payment Required',
    body: `Your runner is ready! Pay ₦${amount?.toLocaleString()} to start your task.`,
    data: { type: 'payment_request', orderId }
  });
};

const notifyPaymentSuccess = async (runnerId, { orderId, amount }) => {
  return sendPushNotification({
    recipientId: runnerId,
    recipientType: 'runner',
    title: '✅ Payment Received',
    body: `Payment of ₦${amount?.toLocaleString()} confirmed. You can start the task!`,
    data: { type: 'payment_success', orderId }
  });
};

const notifyItemApprovalRequest = async (userId, { orderId, totalAmount }) => {
  return sendPushNotification({
    recipientId: userId,
    recipientType: 'user',
    title: 'Items Ready for Approval',
    body: `Your runner has submitted items worth ₦${totalAmount?.toLocaleString()}. Review and approve.`,
    data: { type: 'item_approval_request', orderId }
  });
};

const notifyItemApproved = async (runnerId, { orderId }) => {
  return sendPushNotification({
    recipientId: runnerId,
    recipientType: 'runner',
    title: 'Items Approved!',
    body: 'Your item submission was approved. Item budget has been released to your wallet.',
    data: { type: 'item_approved', orderId }
  });
};

const notifyItemRejected = async (runnerId, { orderId, reason }) => {
  return sendPushNotification({
    recipientId: runnerId,
    recipientType: 'runner',
    title: '❌ Items Rejected',
    body: `Your item submission was rejected. Reason: ${reason}`,
    data: { type: 'item_rejected', orderId }
  });
};

const notifyDeliveryConfirmationRequest = async (userId, { orderId }) => {
  return sendPushNotification({
    recipientId: userId,
    recipientType: 'user',
    title: '📦 Delivery Complete!',
    body: 'Your runner has marked delivery as complete. Please confirm to release payment.',
    data: { type: 'delivery_confirmation_request', orderId }
  });
};

const notifyDeliveryConfirmed = async (runnerId, { orderId, amount }) => {
  return sendPushNotification({
    recipientId: runnerId,
    recipientType: 'runner',
    title: '💰 Payment Released!',
    body: `Delivery confirmed! ₦${amount?.toLocaleString()} has been added to your wallet.`,
    data: { type: 'delivery_confirmed', orderId }
  });
};

const notifyDisputeRaised = async ({ userId, runnerId, orderId, raisedBy }) => {
  // Notify the other party
  const notifyId = raisedBy === 'user' ? runnerId : userId;
  const notifyType = raisedBy === 'user' ? 'runner' : 'user';

  return sendPushNotification({
    recipientId: notifyId,
    recipientType: notifyType,
    title: '⚠️ Dispute Raised',
    body: 'A dispute has been raised for your order. Our team is reviewing it.',
    data: { type: 'dispute_raised', orderId }
  });
};

const notifyDisputeResolved = async ({ userId, runnerId, orderId, outcome }) => {
  const outcomeText = {
    full_release: 'Payment released to runner',
    full_refund: 'Full refund issued',
    partial_release: 'Partial payment released',
    partial_refund: 'Partial refund issued'
  }[outcome] || 'Dispute resolved';

  // Notify both parties
  await sendPushNotification({
    recipientId: userId,
    recipientType: 'user',
    title: '✅ Dispute Resolved',
    body: `Your dispute has been resolved. ${outcomeText}.`,
    data: { type: 'dispute_resolved', orderId, outcome }
  });

  await sendPushNotification({
    recipientId: runnerId,
    recipientType: 'runner',
    title: '✅ Dispute Resolved',
    body: `Your dispute has been resolved. ${outcomeText}.`,
    data: { type: 'dispute_resolved', orderId, outcome }
  });
};

const notifyRatingPrompt = async (userId, { orderId, runnerName }) => {
  return sendPushNotification({
    recipientId: userId,
    recipientType: 'user',
    title: '⭐ Rate Your Experience',
    body: `How was your delivery with ${runnerName}? Tap to leave a rating.`,
    data: { type: 'rating_prompt', orderId }
  });
};

const notifyEscrowReleased = async (runnerId, { orderId, amount }) => {
  return sendPushNotification({
    recipientId: runnerId,
    recipientType: 'runner',
    title: '💸 Funds Released',
    body: `₦${amount?.toLocaleString()} has been released to your wallet.`,
    data: { type: 'escrow_released', orderId }
  });
};

const notifyIncomingCall = async (receiverId, receiverType, { callId, chatId, callType, callerId, callerType, channelName, token, callerName }) => {
  return sendPushNotification({
    recipientId: receiverId,
    recipientType: receiverType,
    title: `Incoming ${callType} call`,
    body: `${callerName} is calling you`,
    data: {
      type: 'incoming_call',
      callId,
      chatId,
      callType,
      callerId,
      callerType,
      channelName,
      token,
    }
  });
};

module.exports = {
  sendPushNotification,
  notifyPaymentRequest,
  notifyPaymentSuccess,
  notifyItemApprovalRequest,
  notifyItemApproved,
  notifyItemRejected,
  notifyDeliveryConfirmationRequest,
  notifyDeliveryConfirmed,
  notifyDisputeRaised,
  notifyDisputeResolved,
  notifyRatingPrompt,
  notifyEscrowReleased,
  notifyIncomingCall
};