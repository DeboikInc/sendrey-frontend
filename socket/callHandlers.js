// callHandlers.js
const { CallLog, Chat } = require("../models/Chat");
const { generateToken } = require('../config/generateAgoraToken');
const { logMetric } = require('../utils/metricsLogger');
const { auditLog } = require('../middleware/auth');
const { notifyIncomingCall } = require('../services/notificationService');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getDisplayName = async (userId, userType) => {
  try {
    if (userType === 'user') {
      const User = require('../models/User');
      const user = await User.findById(userId).select('firstName lastName').lean();
      return user ? `${user.firstName} ${user.lastName || ''}`.trim() : 'User';
    } else {
      const Runner = require('../models/Runner');
      const runner = await Runner.findById(userId).select('firstName lastName').lean();
      return runner ? `${runner.firstName} ${runner.lastName || ''}`.trim() : 'Runner';
    }
  } catch (err) {
    console.error('getDisplayName error:', err);
    return userType === 'user' ? 'User' : 'Runner';
  }
};

const formatDuration = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0
    ? `${mins} minute${mins !== 1 ? 's' : ''} and ${secs} second${secs !== 1 ? 's' : ''}`
    : `${secs} second${secs !== 1 ? 's' : ''}`;
};

// Build a call system message synchronously — no DB, no await
const buildCallMessage = (text, metadata = {}) => ({
  id: `call-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
  from: 'system',
  type: 'call',
  messageType: 'call',
  text,
  time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
  senderId: 'system',
  senderType: 'system',
  status: 'sent',
  createdAt: new Date(),
  ...metadata,
});

// Emit to chatId room + both personal rooms so neither side misses it
const broadcastCallMessage = (io, msg, chatId, callerId, callerType, receiverId, receiverType) => {
  io.to(chatId).emit('message', msg);
  io.to(`${callerType}-${callerId}`).emit('message', msg);
  io.to(`${receiverType}-${receiverId}`).emit('message', msg);
};

// Persist to DB — always fire-and-forget, never block an emit
const persistCallMessage = (chatId, msg) => {
  Chat.findOne({ chatId })
    .then(chat => {
      if (chat) {
        chat.messages.push(msg);
        chat.lastActivity = new Date();
        return chat.save();
      }
      return Chat.create({
        chatId,
        messages: [msg],
        createdBy: 'system',
        createdAt: new Date(),
      });
    })
    .catch(err => console.error('[callHandlers] persistCallMessage error:', err));
};

// ─── Register ─────────────────────────────────────────────────────────────────

const register = (socket, io) => {

  // Caller starts a call
  socket.on('initiateCall', async (data) => {
    const { chatId, callType, callerId, callerType, receiverId, receiverType, channelName } = data;
    const callId = data.callId || `call-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const token = generateToken(channelName);

    const callerName = await getDisplayName(callerId, callerType);
    const msg = buildCallMessage(`${callerName} is calling...`, {
      callId, callType, callerId, callerType, callState: 'initiated',
    });

    // Emit first — no blocking
    broadcastCallMessage(io, msg, chatId, callerId, callerType, receiverId, receiverType);
    io.to(`${receiverType}-${receiverId}`).emit('incomingCall', { callId, chatId, callType, callerId, callerType, receiverId, channelName, token });
    io.to(`${callerType}-${callerId}`).emit('callToken', { callId, channelName, token });

    notifyIncomingCall(receiverId, receiverType, {
      callId, chatId, callType, callerId, callerType, channelName, token, callerName,
    }).catch(console.error);

    persistCallMessage(chatId, msg);
    auditLog('CALL_INITIATED');
  });

  // Receiver accepts
  socket.on('acceptCall', async (data) => {
    const { callId, chatId, callType, channelName, callerId, callerType, receiverId, receiverType } = data;

    const receiverName = await getDisplayName(receiverId, receiverType);
    const msg = buildCallMessage(`${receiverName} accepted the call`, {
      callId, callType, receiverId, receiverType, callState: 'accepted',
    });

    broadcastCallMessage(io, msg, chatId, callerId, callerType, receiverId, receiverType);
    io.to(`${callerType}-${callerId}`).emit('callAccepted', { callId, chatId, callType, channelName });

    persistCallMessage(chatId, msg);
    auditLog('CALL_ACCEPTED');
  });

  // Receiver declines
  socket.on('declineCall', async (data) => {
    const { callId, chatId, callerId, callerType, receiverId, receiverType } = data;

    const receiverName = await getDisplayName(receiverId, receiverType);
    const msg = buildCallMessage(`${receiverName} declined the call`, {
      callId, receiverId, receiverType, callState: 'declined',
    });

    broadcastCallMessage(io, msg, chatId, callerId, callerType, receiverId, receiverType);
    io.to(`${callerType}-${callerId}`).emit('callDeclined', { callId, chatId });

    persistCallMessage(chatId, msg);
    auditLog('CALL_DECLINED');
  });

  // Either party ends the call
  socket.on('endCall', async (data) => {
    const { callId, chatId, callerId, callerType, receiverId, receiverType, duration, callType } = data;

    const endedBy = socket.userId || socket.runnerId;
    const endedByType = socket.userId ? 'user' : 'runner';
    const endedByName = await getDisplayName(endedBy, endedByType);

    const msg = buildCallMessage(`${endedByName} ended the call. Call lasted ${formatDuration(duration)}.`, {
      callId, callType, duration, endedBy, endedByType, callState: 'ended',
    });

    broadcastCallMessage(io, msg, chatId, callerId, callerType, receiverId, receiverType);

    persistCallMessage(chatId, msg);

    // Save call log — also fire-and-forget
    const parts = chatId.split('-runner-');
    const userId = parts[0]?.replace('user-', '') || null;
    const runnerId = parts[1] || null;

    CallLog.create({
      taskId: chatId,
      callId,
      callerId,
      callerType,
      receiverId: receiverId || (callerType === 'user' ? runnerId : userId),
      receiverType: receiverType || (callerType === 'user' ? 'runner' : 'user'),
      type: callType,
      startTime: new Date(Date.now() - duration * 1000),
      endTime: new Date(),
      duration,
      status: 'completed',
    })
      .then(() => logMetric({ type: 'call', status: 'success', chatId, userId: callerId, userType: callerType, metadata: { callType, duration } }))
      .catch(err => {
        console.error('endCall log error:', err);
        logMetric({ type: 'call', status: 'failed', chatId, userId: callerId, userType: callerType, error: err.message });
      });

    auditLog('CALL_ENDED');
  });

  // No answer — missed
  socket.on('missedCall', async (data) => {
    const { callId, chatId, callerId, callerType, receiverId, receiverType } = data;

    const callerName = await getDisplayName(callerId, callerType);
    const msg = buildCallMessage(`Missed call from ${callerName}`, {
      callId, callerId, callerType, receiverId, receiverType, callState: 'missed',
    });

    broadcastCallMessage(io, msg, chatId, callerId, callerType, receiverId, receiverType);

    persistCallMessage(chatId, msg);
    auditLog('CALL_MISSED');
  });

  // Receiver is busy
  socket.on('rejectCall', async (data) => {
    const { callId, chatId, callerId, callerType, receiverId, receiverType } = data;

    const receiverName = await getDisplayName(receiverId, receiverType);
    const msg = buildCallMessage(`${receiverName} is busy`, {
      callId, receiverId, receiverType, callState: 'rejected',
    });

    broadcastCallMessage(io, msg, chatId, callerId, callerType, receiverId, receiverType);
    io.to(`${callerType}-${callerId}`).emit('callRejected', { callId, chatId });

    persistCallMessage(chatId, msg);
    auditLog('CALL_REJECTED');
  });
};

module.exports = { register };