// socketHandlers.js
const { Chat } = require("../models/Chat");
const ServiceRequest = require("./ServiceRequest");
const Invoice = require("../models/Invoice");
const User = require("../models/User");
const Runner = require("../models/Runner");

const Order = require("../models/Order");
const Escrow = require('../models/Escrows');
const { notifyPaymentRequest } = require('../services/notificationService');

const { logMetric } = require('../utils/metricsLogger');
const { computeDeliveryFeeFromDocs } = require('../config/pricing');
const { canRunnerAcceptErrand, incrementErrandCount } = require('../utils/verificationCheck');
const { logSocketAudit } = require('../utils/socketAudit');

// ─── Global state 

const runnersByService = {
  "pick-up": new Set(),
  "run-errand": new Set(),
};

const preRoomState = new Map();

// ─── In-memory snapshot store: socketId → { chatId, messageIds: Set }
const socketMessageSnapshot = new Map();

// ─── Helpers 

const cleanForEmit = (data) => {
  if (data && typeof data === "object") {
    if (data.toObject && typeof data.toObject === "function") return data.toObject();
    if (Array.isArray(data)) return data.map(cleanForEmit);
    const result = {};
    for (const key in data) result[key] = cleanForEmit(data[key]);
    return result;
  }
  return data;
};

// Deduplicate messages by id — used before every chatHistory emit
const deduplicateMessages = (messages) => {
  const seen = new Set();
  return messages.filter(m => {
    if (!m.id || seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
};

// Deduplicate in DB and return clean array
const deduplicateAndPersist = async (chatId, messages) => {
  const deduped = deduplicateMessages(messages);
  if (deduped.length !== messages.length) {
    await Chat.findOneAndUpdate({ chatId }, { $set: { messages: deduped } });
  }
  return deduped;
};

const snapshotMessage = (socketId, chatId, messageId) => {
  if (!messageId) return;
  if (!socketMessageSnapshot.has(socketId)) {
    socketMessageSnapshot.set(socketId, { chatId, messageIds: new Set() });
  }
  socketMessageSnapshot.get(socketId).messageIds.add(messageId);
};

// Handlers

const createInitialRunnerMessages = (runnerData, serviceType, runnerId) => {
  const fullName = `${runnerData?.firstName || ""} ${runnerData?.lastName || ""}`.trim();

  logSocketAudit('INITIAL_RUNNER_MESSAGE', { runnerData, runnerId, serviceType });

  return [
    {
      id: Date.now().toString(),
      from: "system",
      messageType: "system",
      type: "system",
      text: `Runner ${fullName} joined the chat`,
      time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }),
      senderId: runnerId,
      senderType: "runner",
      status: "sent",
      createdAt: new Date(),
    },
    {
      id: (Date.now() + 1).toString(),
      from: "them",
      messageType: "profile-card",
      type: "profile-card",
      time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }),
      senderId: runnerId,
      senderType: "runner",
      status: "sent",
      createdAt: new Date(),
      runnerInfo: {
        firstName: runnerData?.firstName,
        lastName: runnerData?.lastName || "",
        avatar: runnerData?.profilePicture || null,
        rating: runnerData?.rating > 0 ? runnerData.rating : null,
        bio: `Hello I am ${fullName} and I will be your captain for this ${serviceType.replace("-", " ")}. I am dedicated to helping you get your tasks done efficiently and effectively.`,
      },
    },
  ];
};

const buildPaymentRequestMsg = (order, chatId, userId, runnerId) => ({
  id: `payment-prompt-${Date.now()}`,
  from: 'system',
  type: 'payment_request',
  messageType: 'payment_request',
  time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
  senderId: 'system',
  senderType: 'system',
  status: 'sent',
  createdAt: new Date(),
  paymentData: {
    serviceType: order.serviceType,
    itemBudget: order.itemBudget || 0,
    deliveryFee: order.deliveryFee || 0,
    totalAmount: order.totalAmount || 0,
    currency: 'NGN',
    chatId,
    userId,
    runnerId,
    orderId: order.orderId,
  },
});

// ─── Room handlers ────────────────────────────────────────────────────────────

const handleJoinRunnerRoom = async (socket, { runnerId, serviceType }) => {
  socket.runnerId = runnerId;
  socket.serviceType = serviceType;

  socket.join(`runners-${serviceType}`);
  socket.join(`runner-${runnerId}`);

  const verificationCheck = await canRunnerAcceptErrand(runnerId);
  socket.emit('verificationStatus', { ...verificationCheck, timestamp: new Date().toISOString() });

  runnersByService[serviceType].add(socket.id);

  const requests = await ServiceRequest.find({ serviceType, status: "available" });
  socket.emit("existingRequests", requests);

  logSocketAudit('RUNNER_JOINED_ROOM', { runnerId, serviceType });
};

const handleAcceptRunnerRequest = async (socket, io, { runnerId, userId, chatId, serviceType }) => {
  try {
    const verificationCheck = await canRunnerAcceptErrand(runnerId);

    if (!verificationCheck.canAccept) {
      socket.emit('error', { message: verificationCheck.reason, code: 'VERIFICATION_FAILED', details: verificationCheck });
      socket.emit('verificationStatus', { ...verificationCheck, timestamp: new Date().toISOString() });
      return;
    }

    if (!preRoomState.has(chatId)) {
      preRoomState.set(chatId, { user: false, runner: false, runnerId, userId, serviceType, timestamp: Date.now() });
    }

    const state = preRoomState.get(chatId);
    state.runner = true;
    state.runnerId = runnerId;
    socket.join(`pre-${chatId}`);

    await incrementErrandCount(runnerId);

    io.to(`user-${userId}`).emit("enterPreRoom", {
      chatId, runnerId, userId, serviceType,
      message: "Runner accepted! Preparing chat...",
    });

    if (state.user && state.runner) {
      await lockAndProceed(io, chatId, state);
    } else {
      setTimeout(() => {
        const s = preRoomState.get(chatId);
        if (s && s.runner && !s.user) {
          preRoomState.delete(chatId);
          io.to(`pre-${chatId}`).emit("preRoomTimeout", { chatId, message: "User did not respond in time" });
        }
      }, 30000);
    }

    logSocketAudit('USER_ACCEPTED_RUNNER_REQUEST', { runnerId, serviceType, chatId, userId });
  } catch (error) {
    console.error("Error in acceptRunnerRequest:", error);
  }
};

const handleRequestRunner = async (socket, io, data) => {
  const { runnerId, userId, chatId, serviceType, specialInstructions } = data;

  socket.join(`user-${userId}`);

  if (!preRoomState.has(chatId)) {
    preRoomState.set(chatId, { user: false, runner: false, runnerId, userId, serviceType, timestamp: Date.now() });
  }

  const state = preRoomState.get(chatId);
  state.user = true;
  state.userId = userId;
  state.specialInstructions = specialInstructions || null;
  socket.join(`pre-${chatId}`);

  if (state.user && state.runner) {
    await lockAndProceed(io, chatId, state);
  } else {
    setTimeout(() => {
      const s = preRoomState.get(chatId);
      if (s && s.user && !s.runner) {
        preRoomState.delete(chatId);
        io.to(`pre-${chatId}`).emit("preRoomTimeout", { chatId, message: "Runner did not respond in time" });
      }
    }, 30000);
  }

  logSocketAudit('RUNNER_REQUESTED', { runnerId, userId, chatId, serviceType });
};

const lockAndProceed = async (io, chatId, state) => {
  const { runnerId, userId } = state;
  await Promise.all([
    Runner.findByIdAndUpdate(runnerId, { isAvailable: false }),
    User.findByIdAndUpdate(userId, { isAvailable: false }),
  ]);
  await initializeChatAndProceed(io, chatId, state);
  logSocketAudit('CHAT_LOCKED', { runnerId, userId });
};

const sanitizeSpecialInstructions = (specialInstructions) => {
  if (!specialInstructions) return null;
  return {
    text: specialInstructions.text || null,
    media: (specialInstructions.media || []).map(m => ({
      fileName: m.fileName || m.name || null,
      fileType: m.fileType || m.type || null,
      fileSize: m.fileSize || null,
      fileUrl: m.fileUrl || null,
    })),
  };
};

// ─── Chat initialization (pre-room → chat) ────────────────────────────────────

const initializeChatAndProceed = async (io, chatId, state) => {
  const { runnerId, userId, serviceType } = state;
  const specialInstructions = sanitizeSpecialInstructions(state.specialInstructions);

  try {
    const [user, runnerData] = await Promise.all([
      User.findById(userId).lean(),
      Runner.findById(runnerId).lean(),
    ]);

    const { deliveryFee } = computeDeliveryFeeFromDocs(serviceType, user);
    const isErrand = serviceType === 'run-errand';
    const itemBudget = isErrand
      ? Number(user?.currentRequest?.itemBudget || user?.currentRequest?.budget) || 0
      : 0;

    const initialMessages = createInitialRunnerMessages(runnerData, serviceType, runnerId);

    let chat;
    const existingChat = await Chat.findOne({ chatId });

    if (existingChat) {
      // Cancel any stale unpaid orders for this chat
      await Order.updateMany(
        { chatId, paymentStatus: 'unpaid', status: { $nin: ['completed', 'cancelled', 'task_completed'] } },
        { $set: { status: 'cancelled', cancelledAt: new Date(), cancelReason: 'new_session_started' } }
      );

      // Wipe stale session messages — keep nothing, fresh start
      // (runner joined again means user picked a new runner or same runner restarted)
      existingChat.messages = [...initialMessages];
      await existingChat.save();
      chat = existingChat;
    } else {
      chat = await Chat.create({
        chatId,
        messages: initialMessages,
        userId,
        runnerId,
        serviceType,
        createdBy: "system",
        createdAt: new Date(),
        specialInstructions: specialInstructions || null,
      });
    }

    io.to(`pre-${chatId}`).emit("proceedToChat", {
      chatId, runnerId, userId, serviceType,
      chatReady: true,
      initialMessages: chat.messages,
      specialInstructions: specialInstructions || null,
    });

    preRoomState.delete(chatId);
    logSocketAudit('PROCEED_TO_CHATROOM', { runnerId, userId, serviceType });
  } catch (error) {
    console.error("Error initializing chat:", error);
  }
};

// ─── User joins chat ──────────────────────────────────────────────────────────

const handleUserJoinChat = async (socket, io, data) => {
  const { userId, runnerId, chatId } = data;

  // Idempotency guard
  if (socket.currentChatId === chatId && socket.joinedChat) {
    console.log('[userJoinChat] duplicate join — re-emitting chatHistory');
    const existing = await Chat.findOne({ chatId });
    if (existing) {
      const clean = await deduplicateAndPersist(chatId, existing.messages);
      socket.emit('chatHistory', clean);
    }
    return;
  }

  socket.currentChatId = chatId;
  socket.joinedChat = true;
  socket.userId = userId;
  socket.runnerId = runnerId;
  socket.join(chatId);
  socket.join(`user-${userId}`);

  const [chat, existingOrder] = await Promise.all([
    Chat.findOne({ chatId }),
    Order.findOne({ chatId }).sort({ createdAt: -1 }).lean(),
  ]);

  if (!chat) {
    socket.emit('chatHistory', []);
    io.to(`runner-${runnerId}`).emit('userJoinedChat', { userId, runnerId, chatId, userInRoom: true, timestamp: new Date().toISOString() });
    return;
  }

  console.log('[userJoinChat] existingOrder:', existingOrder?.orderId, '| paymentStatus:', existingOrder?.paymentStatus, '| status:', existingOrder?.status);

  let order = null;
  let finalChat = null;

  const isTerminal = ['completed', 'cancelled', 'task_completed'].includes(existingOrder?.status);
  const isPaid = existingOrder?.paymentStatus === 'paid';

  // ── CASE A: unpaid active order → ensure payment_request is present ────────
  if (existingOrder && !isPaid && !isTerminal) {
    console.log('[userJoinChat] CASE A — unpaid order');
    order = existingOrder;

    const alreadyHas = chat.messages.some(
      m => (m.type === 'payment_request' || m.messageType === 'payment_request')
        && m.paymentData?.orderId === order.orderId
    );

    if (!alreadyHas) {
      finalChat = await Chat.findOneAndUpdate(
        { chatId },
        { $push: { messages: buildPaymentRequestMsg(order, chatId, userId, runnerId) }, $set: { lastActivity: new Date() } },
        { new: true }
      );
    } else {
      finalChat = chat;
    }
  }

  // ── CASE B: paid active order → restore history as-is ─────────────────────
  else if (existingOrder && isPaid && !isTerminal) {
    console.log('[userJoinChat] CASE B — paid order');
    order = existingOrder;
    finalChat = chat;
    socket.emit('orderCreated', { order: cleanForEmit(order) });
  }

  // ── CASE C: no order or terminal order → create new order ─────────────────
  else {
    console.log('[userJoinChat] CASE C — new order');

    const activeOrder = await Order.findOne({
      chatId,
      status: { $nin: ['cancelled', 'completed', 'task_completed'] },
    }).lean();

    if (activeOrder) {
      console.log('[userJoinChat] race guard — order already exists:', activeOrder.orderId);
      order = activeOrder;
      finalChat = chat;
    } else {
      const [runnerDoc, userDoc] = await Promise.all([
        Runner.findById(runnerId).lean(),
        User.findById(userId).lean(),
      ]);

      const serviceType = userDoc?.currentRequest?.serviceType || chat.serviceType;
      const { deliveryFee, distanceInMeters, legs } = computeDeliveryFeeFromDocs(serviceType, userDoc);
      const isErrand = serviceType === 'run-errand';
      const itemBudget = isErrand
        ? Number(userDoc?.currentRequest?.itemBudget || userDoc?.currentRequest?.budget) || 0
        : 0;
      const totalAmount = itemBudget + deliveryFee;
      const { platformFee, runnerPayout } = Escrow.calculateFees(deliveryFee);
      const request = userDoc?.currentRequest || {};

      order = await Order.create({
        orderId: Order.generateOrderId(),
        chatId, userId, runnerId, serviceType,
        taskType: isErrand ? 'run-errand' : 'pick-up',
        pickupLocation: request.pickupLocation || {},
        deliveryLocation: request.deliveryLocation || {},
        marketLocation: request.marketLocation || {},
        marketCoordinates: request.marketCoordinates || null,
        pickupCoordinates: request.pickupCoordinates || null,
        deliveryCoordinates: request.deliveryCoordinates || null,
        routeDistanceMeters: Math.round(distanceInMeters || 0),
        routeLegs: legs || {},
        itemBudget, deliveryFee, totalAmount, platformFee, runnerPayout,
        specialInstructions: request.specialInstructions,
        fleetType: request.fleetType,
        status: 'pending_payment',
        paymentStatus: 'unpaid',
        approvalStatus: isErrand ? 'pending' : 'not_required',
        statusHistory: [{ status: 'pending_payment', timestamp: new Date(), triggeredBy: 'system', note: 'Order created on user join' }],
      });

      console.log('[userJoinChat] order created:', order.orderId);

      await Promise.all([
        Runner.findByIdAndUpdate(runnerId, { activeOrderId: order.orderId }),
        User.findByIdAndUpdate(userId, { activeOrderId: order.orderId }),
        Chat.findOneAndUpdate({ chatId }, { $set: { orderId: order.orderId, taskId: order.orderId } }),
      ]);

      // Strip stale payment_requests, push only the new one
      // (initialRunnerMessages already written by initializeChatAndProceed)
      await Chat.findOneAndUpdate(
        { chatId },
        { $pull: { messages: { $or: [{ type: 'payment_request' }, { messageType: 'payment_request' }] } } }
      );

      finalChat = await Chat.findOneAndUpdate(
        { chatId },
        { $push: { messages: buildPaymentRequestMsg(order, chatId, userId, runnerId) }, $set: { lastActivity: new Date() } },
        { new: true }
      );

      console.log('[userJoinChat] finalChat messages:', finalChat?.messages?.length,
        '| payment_request count:', finalChat?.messages?.filter(m => m.type === 'payment_request').length);

      const orderPayload = {
        order: {
          orderId: order.orderId,
          itemBudget: order.itemBudget,
          deliveryFee: order.deliveryFee,
          totalAmount: order.totalAmount,
          runnerPayout: order.runnerPayout,
          taskType: order.taskType,
          serviceType: order.serviceType,
          status: order.status,
          paymentStatus: order.paymentStatus,
          approvalStatus: order.approvalStatus,
        },
      };
      io.to(`runner-${runnerId}`).emit('orderCreated', orderPayload);
      io.to(chatId).emit('orderCreated', { ...orderPayload, isNewOrder: true });

      await notifyPaymentRequest(userId, { orderId: order.orderId, amount: order.totalAmount });
    }
  }

  // Emit order state to this socket
  if (order) {
    socket.emit('orderCreated', {
      order: {
        orderId: order.orderId,
        itemBudget: order.itemBudget,
        deliveryFee: order.deliveryFee,
        totalAmount: order.totalAmount,
        taskType: order.taskType,
        serviceType: order.serviceType,
        status: order.status,
        paymentStatus: order.paymentStatus,
      },
      isNewOrder: true,
    });
  }

  // Deduplicate and emit chat history
  if (!finalChat) finalChat = await Chat.findOne({ chatId });
  const cleanMessages = await deduplicateAndPersist(chatId, finalChat.messages);

  cleanMessages.forEach(m => snapshotMessage(socket.id, chatId, m.id));
  socket.emit('chatHistory', cleanMessages);
  console.log('[userJoinChat] chatHistory emitted:', cleanMessages.length, 'messages');

  io.to(`runner-${runnerId}`).emit('userJoinedChat', { userId, runnerId, chatId, userInRoom: true, timestamp: new Date().toISOString() });
  logSocketAudit('USER_JOINED_CHAT', { userId, runnerId, chatId });
};

// ─── Runner joins chat ────────────────────────────────────────────────────────

const handleRunnerJoinChat = async (socket, io, data) => {
  const { runnerId, userId, chatId } = data;

  socket.runnerId = runnerId;
  socket.userId = userId;
  socket.currentChatId = chatId;
  socket.join(chatId);
  socket.join(`runner-${runnerId}`);

  const chat = await Chat.findOne({ chatId });

  if (!chat) {
    socket.emit("chatHistory", []);
  } else {
    const cleanMessages = await deduplicateAndPersist(chatId, chat.messages);

    cleanMessages.forEach(m => snapshotMessage(socket.id, chatId, m.id));
    socket.emit("chatHistory", cleanMessages);

    if (chat.specialInstructions) {
      socket.emit("specialInstructions", { chatId, specialInstructions: chat.specialInstructions });
    }
  }

  io.to(`user-${userId}`).emit("runnerJoinedChat", { userId, runnerId, chatId, runnerInRoom: true, timestamp: new Date().toISOString() });
  logSocketAudit('RUNNER_JOINED_CHAT', { runnerId, chatId, userId });
};

// ─── Message handlers ─────────────────────────────────────────────────────────

const handleSendMessage = async (io, { chatId, message }) => {
  const startTime = Date.now();
  try {
    const chat = await Chat.findOne({ chatId });
    if (!chat) {
      await Chat.create({ chatId, messages: [message] });
    } else {
      chat.messages.push(message);
      await chat.save();
    }

    // Snapshot this message for every socket currently in the room
    const room = io.sockets.adapter.rooms.get(chatId);
    if (room) {
      for (const socketId of room) {
        snapshotMessage(socketId, chatId, message.id);
      }
    }

    io.to(chatId).emit("message", cleanForEmit(message));
    await logMetric({ type: 'message', status: 'success', latency: Date.now() - startTime, chatId, userId: message.senderId, userType: message.senderType, metadata: { messageType: message.type } });
  } catch (error) {
    console.error("Error sending message:", error);
    await logMetric({ type: 'message', status: 'failed', latency: Date.now() - startTime, chatId, userId: message?.senderId, userType: message?.senderType, error: error.message });
    io.to(chatId).emit("message", cleanForEmit(message));
  }
};

const handleStartTrackRunner = (io, data) => {
  if (!data?.chatId || !data?.runnerId) {
    console.error("Missing chatId or runnerId in startTrackRunner payload");
    return;
  }
  const { chatId, runnerId, userId } = data;
  io.to(chatId).emit("receiveTrackRunner", cleanForEmit({
    chatId, runnerId, userId,
    status: "on_way_to_delivery",
    trackingData: { lat: null, lng: null, eta: null },
    timestamp: new Date().toISOString(),
  }));
  logSocketAudit('TRACK_RUNNER', { chatId, runnerId, userId });
};

const handleDeleteMessage = async (socket, io, { chatId, messageId, userId, deleteForEveryone = true }) => {
  try {
    const chat = await Chat.findOne({ chatId });
    if (!chat) return;

    if (deleteForEveryone) {
      const idx = chat.messages.findIndex(m => m.id === messageId);
      if (idx !== -1) {
        chat.messages[idx] = { ...chat.messages[idx], deleted: true, text: "This message was deleted", type: "deleted", fileUrl: null, fileName: null, createdAt: new Date() };
        await chat.save();
        io.to(chatId).emit("messageDeleted", { messageId, deletedBy: userId, deleteForEveryone: true });
      }
    } else {
      socket.emit("messageDeletedForMe", { messageId, chatId });
    }

    logSocketAudit('MESSAGE_DELETED', { messageId, deletedBy: userId, chatId });
  } catch (error) {
    console.error("Error deleting message:", error);
  }
};

const handleGetSpecialInstructions = async (socket, { chatId }) => {
  try {
    const chat = await Chat.findOne({ chatId }).lean();
    socket.emit("specialInstructions", { chatId, specialInstructions: chat?.specialInstructions || null });
  } catch (error) {
    console.error("Error fetching special instructions:", error);
  }
};

const handleRejoinChat = async (socket, io, { chatId, userId, runnerId, userType }) => {
  if (!chatId) return;

  console.log('[rejoinChat]', userType, 'rejoining room:', chatId);
  socket.join(chatId);
  if (userType === 'runner' && runnerId) socket.join(`runner-${runnerId}`);
  else if (userType === 'user' && userId) socket.join(`user-${userId}`);

  // Get what this socket had before disconnect
  const snapshot = socketMessageSnapshot.get(socket.id);

  const chat = await Chat.findOne({ chatId }).lean();
  if (!chat?.messages?.length) {
    console.log('[rejoinChat] no chat found');
    return;
  }

  const cleanMessages = deduplicateMessages(chat.messages);

  if (!snapshot || snapshot.chatId !== chatId) {
    // No snapshot — we don't know what they had, send full history
    console.log('[rejoinChat] no snapshot, sending full chatHistory');
    cleanMessages.forEach(m => snapshotMessage(socket.id, chatId, m.id));
    socket.emit('chatHistory', cleanMessages);
  } else {
    // Diff: find messages in DB that are NOT in the snapshot
    const missed = cleanMessages.filter(m => m.id && !snapshot.messageIds.has(m.id));

    if (missed.length === 0) {
      console.log('[rejoinChat] client is up to date, no missed messages');
    } else {
      console.log('[rejoinChat] sending', missed.length, 'missed messages');
      // Update snapshot with newly sent messages
      missed.forEach(m => snapshotMessage(socket.id, chatId, m.id));
      socket.emit('missedMessages', missed);
    }
  }

  console.log('[rejoinChat] room size:', io.sockets.adapter.rooms.get(chatId)?.size);
};

const handleDisconnect = (socket) => {
  if (socket.serviceType && runnersByService[socket.serviceType]) {
    runnersByService[socket.serviceType].delete(socket.id);
  }
  // Clean up snapshot on disconnect — will be rebuilt on next join
  socketMessageSnapshot.delete(socket.id);
};

module.exports = {
  runnersByService,
  handleJoinRunnerRoom,
  handleAcceptRunnerRequest,
  handleSendMessage,
  handleStartTrackRunner,
  handleRequestRunner,
  handleUserJoinChat,
  handleRunnerJoinChat,
  handleDisconnect,
  handleDeleteMessage,
  handleGetSpecialInstructions,
  handleRejoinChat,
};