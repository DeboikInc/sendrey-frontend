// callHandlers.js
const { CallLog } = require("../models/Chat");
const { generateToken } = require('../config/generateAgoraToken');
const { logMetric } = require('../utils/metricsLogger');

const register = (socket, io) => {

  /**
   * Caller initiates a call
   * Emits "incomingCall" to the receiver's personal room
   */
  socket.on("initiateCall", (data) => {
    const token = generateToken(data.channelName);

    const {
      callId,
      chatId,
      callType,
      callerId,
      callerType,
      receiverId,
      receiverType,
      channelName,
    } = data;

    const roomSockets = io.sockets.adapter.rooms.get(`runner-${data.receiverId}`);
    console.log(`Room runner-${data.receiverId} has ${roomSockets?.size || 0} sockets:`, roomSockets)

    console.log(`${callerType} ${callerId} initiating ${callType} call to ${receiverType} ${receiverId}`);

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

    console.log(` incomingCall emitted to room: ${receiverRoom}`);

    const callerRoom = `${callerType}-${callerId}`;
    io.to(callerRoom).emit("callToken", {
      callId,
      channelName,
      token,
    });
    console.log(` callToken emitted to room: ${callerRoom}`);
  });

  /**
   * Receiver accepts the call
   * Signals back to the caller to join the Agora channel
   */
  socket.on("acceptCall", (data) => {
    const { callId, chatId, callType, channelName, callerId, callerType, receiverId } = data;

    console.log(` Call ${callId} accepted by ${receiverId}`);

    // Tell the caller — they're in their personal room
    // callerType tells us which room format to use
    const callerRoom = `${callerType}-${callerId}`;

    io.to(callerRoom).emit("callAccepted", {
      callId,
      chatId,
      callType,
      channelName,
    });

    console.log(`callAccepted emitted to room: ${callerRoom}`);
  });

  /**
   * Receiver declines the call
   * Signals back to the caller
   */
  socket.on("declineCall", (data) => {
    const { callId, chatId, callerId, callerType, receiverId } = data;

    console.log(`❌ Call ${callId} declined by ${receiverId}`);

    const callerRoom = `${callerType}-${callerId}`;
    io.to(callerRoom).emit("callDeclined", { callId, chatId });

    console.log(` callDeclined emitted to room: ${callerRoom}`);
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

    console.log(` Call ${callId} ended. Duration: ${duration}s`);

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

      // log succeful call
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


      console.log(` Call log saved: ${callId}, duration: ${duration}s`);
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
};

module.exports = { register };