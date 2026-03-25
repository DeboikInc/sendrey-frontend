// callHandlers.js
const { CallLog, Chat } = require("../models/Chat");
const { generateToken } = require('../config/generateAgoraToken');
const { logMetric } = require('../utils/metricsLogger');

const {
  auditLog
} = require('../middleware/auth');

// Helper to get user/runner name
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
  } catch (error) {
    console.error('Error getting display name:', error);
    return userType === 'user' ? 'User' : 'Runner';
  }
};

// Helper to format duration
const formatDuration = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins} minute${mins !== 1 ? 's' : ''} and ${secs} second${secs !== 1 ? 's' : ''}` : `${secs} second${secs !== 1 ? 's' : ''}`;
};

// Helper to add system message to chat
const addSystemMessage = async (chatId, text, metadata = {}) => {
  try {
    const systemMessage = {
      id: `call-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      from: 'system',
      type: 'call',
      messageType: 'call',
      text: text,
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
      senderId: 'system',
      senderType: 'system',
      status: 'sent',
      createdAt: new Date(),
      ...metadata
    };

    const chat = await Chat.findOne({ chatId });
    if (chat) {
      chat.messages.push(systemMessage);
      chat.lastActivity = new Date();
      await chat.save();
    } else {
      await Chat.create({
        chatId,
        messages: [systemMessage],
        createdBy: 'system',
        createdAt: new Date()
      });
    }
    return systemMessage;
  } catch (error) {
    console.error('Error adding system message:', error);
  }
};

const register = (socket, io) => {

  /**
   * Caller initiates a call
   * Emits "incomingCall" to the receiver's personal room
   */
  socket.on("initiateCall", async (data) => {
    const token = generateToken(data.channelName);

    const {
      chatId,
      callType,
      callerId,
      callerType,
      receiverId,
      receiverType,
      channelName
    } = data;

    const callId = data.callId || `call-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Get caller name for system message
    const callerName = await getDisplayName(callerId, callerType);

    // Add system message to chat: "{user} is calling you..."
    await addSystemMessage(chatId, `${callerName} is calling ...`, {
      callId,
      callType,
      callerId,
      callerType,
      callState: 'initiated'
    });

    const roomSockets = io.sockets.adapter.rooms.get(`runner-${data.receiverId}`);

    // Signal the receiver — they're in their personal room (user-{id} or runner-{id})
    const receiverRoom = `${receiverType}-${receiverId}`;

    io.to(receiverRoom).emit("incomingCall", {
      callId,
      chatId,
      callType,
      callerId,
      callerType,
      receiverId,
      channelName,
      token,
    });

    const callerRoom = `${callerType}-${callerId}`;
    io.to(callerRoom).emit("callToken", {
      callId,
      channelName,
      token,
    });

    auditLog("CALL_INITIATED")
  });

  /**
   * Receiver accepts the call
   * Signals back to the caller to join the Agora channel
   */
  socket.on("acceptCall", async (data) => {
    const { callId, chatId, callType, channelName, callerId, callerType, receiverId, receiverType } = data;

    // Get receiver name for system message
    const receiverName = await getDisplayName(receiverId, receiverType);

    // Add system message to chat: "{user} accepted the call"
    await addSystemMessage(chatId, `${receiverName} accepted the call`, {
      callId,
      callType,
      receiverId,
      receiverType,
      callState: 'accepted'
    });

    // Tell the caller — they're in their personal room
    const callerRoom = `${callerType}-${callerId}`;

    io.to(callerRoom).emit("callAccepted", {
      callId,
      chatId,
      callType,
      channelName,
    });

    auditLog("CALL_ACCEPTED")
  });

  /**
   * Receiver declines the call
   * Signals back to the caller
   */
  socket.on("declineCall", async (data) => {
    const { callId, chatId, callerId, callerType, receiverId, receiverType } = data;

    // Get receiver name for system message
    const receiverName = await getDisplayName(receiverId, receiverType);

    // Add system message to chat: "{user} declined your call"
    await addSystemMessage(chatId, `${receiverName} declined the call`, {
      callId,
      receiverId,
      receiverType,
      callState: 'declined'
    });

    const callerRoom = `${callerType}-${callerId}`;
    io.to(callerRoom).emit("callDeclined", { callId, chatId });

    auditLog("CALL_DECLINED")
  });

  /**
   * Either party ends the active call
   * Signals the other party and saves the call log to DB
   */
  socket.on("endCall", async (data) => {
    const {
      callId,
      chatId,
      callerId,
      callerType,
      duration,
      callType,
      receiverId,
      receiverType,
    } = data;

    // Get the party who ended the call (from socket)
    const endedBy = socket.userId || socket.runnerId;
    const endedByType = socket.userId ? 'user' : 'runner';
    const endedByName = await getDisplayName(endedBy, endedByType);

    // Format duration message
    const durationFormatted = formatDuration(duration);
    
    // Add system message: "{user} ended the call. Call lasted X minutes"
    await addSystemMessage(chatId, `${endedByName} ended the call. Call lasted ${durationFormatted}.`, {
      callId,
      callType,
      duration,
      endedBy,
      endedByType,
      callState: 'ended'
    });

    // Notify the other party in the chat room
    io.to(chatId).emit("callEnded", { callId, chatId });

    // Save call log to DB
    try {
      // Extract userId and runnerId from chatId (format: user-{userId}-runner-{runnerId})
      const parts = chatId.split("-runner-");
      const userId = parts[0]?.replace("user-", "") || null;
      const runnerId = parts[1] || null;

      await CallLog.create({
        taskId: chatId, // linked to chat/task
        callId,
        callerId,
        callerType,
        receiverId: receiverId || (callerType === "user" ? runnerId : userId),
        receiverType: receiverType || (callerType === "user" ? "runner" : "user"),
        type: callType,
        startTime: new Date(Date.now() - duration * 1000),
        endTime: new Date(),
        duration,
        status: "completed",
      });

      // log successful call
      await logMetric({
        type: 'call',
        status: 'success',
        chatId,
        userId: callerId,
        userType: callerType,
        metadata: {
          callType,
          duration: duration
        }
      });

    } catch (error) {
      console.error("Error saving call log:", error);

      // log failed call
      await logMetric({
        type: 'call',
        status: 'failed',
        chatId,
        userId: callerId,
        userType: callerType,
        error: error.message
      });
    }
  });

  /**
   * Call missed (no answer)
   */
  socket.on("missedCall", async (data) => {
    const { callId, chatId, callerId, callerType, receiverId, receiverType } = data;

    // Get caller name for system message
    const callerName = await getDisplayName(callerId, callerType);
    const receiverName = await getDisplayName(receiverId, receiverType);

    // Add system message: "Missed call from {user}"
    await addSystemMessage(chatId, `Missed call from ${callerName}`, {
      callId,
      callerId,
      callerType,
      receiverId,
      receiverType,
      callState: 'missed'
    });

    io.to(chatId).emit("callMissed", { callId, chatId });

    auditLog("CALL_MISSED")
  });

  /**
   * Call rejected (busy)
   */
  socket.on("rejectCall", async (data) => {
    const { callId, chatId, callerId, callerType, receiverId, receiverType } = data;

    // Get receiver name for system message
    const receiverName = await getDisplayName(receiverId, receiverType);

    // Add system message: "{user} is busy"
    await addSystemMessage(chatId, `${receiverName} is busy`, {
      callId,
      receiverId,
      receiverType,
      callState: 'rejected'
    });

    const callerRoom = `${callerType}-${callerId}`;
    io.to(callerRoom).emit("callRejected", { callId, chatId });

    auditLog("CALL_REJECTED")
  });
};

module.exports = { register };