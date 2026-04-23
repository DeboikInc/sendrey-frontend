// socketHandlers.js
const { Chat } = require("../models/Chat");
const ServiceRequest = require("./ServiceRequest");
const User = require("../models/User");
const Runner = require("../models/Runner");
const Order = require("../models/Order");
const Escrow = require('../models/Escrows');
const { notifyPaymentRequest, notifyPartnerOffline } = require('../services/notificationService');
const { logMetric } = require('../utils/metricsLogger');
const { computeDeliveryFeeFromDocs } = require('../config/pricing');
const { canRunnerAcceptErrand, incrementErrandCount } = require('../utils/verificationCheck');
const { logSocketAudit } = require('../utils/socketAudit');

// ─── Global state ─────────────────────────────────────────────────────────────

const runnersByService = {
  "pick-up": new Set(),
  "run-errand": new Set(),
};

const preRoomState = new Map();
const pendingWrites = new Map();
const joiningChats = new Set();

// ─── In-memory snapshot store: socketId → { chatId, messageIds: Set }
const socketMessageSnapshot = new Map();

// ─── Helpers ──────────────────────────────────────────────────────────────────

const stripForTransport = (msg) => {
  if (!msg) return msg;
  const stripped = { ...msg };
  if (stripped.file && stripped.file.length > 1000) delete stripped.file;
  if (stripped.receiptBase64) delete stripped.receiptBase64;
  if (stripped.photoBase64) delete stripped.photoBase64;
  return stripped;
};

const cleanForEmit = (data) => {
  if (data && typeof data === 'object') {
    if (data.toObject && typeof data.toObject === 'function') return stripForTransport(data.toObject());
    if (Array.isArray(data)) return data.map(cleanForEmit);
    const result = {};
    for (const key in data) result[key] = cleanForEmit(data[key]);
    return stripForTransport(result);
  }
  return data;
};

const deduplicateMessages = (messages) => {
  const seen = new Set();
  return messages.filter(m => {
    if (!m.id || seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
};

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

const sanitizeSpecialInstructions = (specialInstructions) => {
  console.log('[sanitize] input:', JSON.stringify(specialInstructions, null, 2));
  if (!specialInstructions) return null;
  return {
    text: specialInstructions.text || null,
    media: (specialInstructions.media || []).map(m => {
      // console.log('[sanitize] media item:', JSON.stringify(m, null, 2));
      return {
        fileName: m.fileName || m.name || null,
        fileType: m.fileType || m.type || null,
        fileSize: m.fileSize || null,
        fileUrl: m.fileUrl || null,
      };
    }),
  };
};

// ─── Archive current messages into orderSessions ──────────────────────────────

const archiveCurrentSession = async (chatId, orderId, status = 'completed') => {
  console.log(`[archive] Called with orderId: ${orderId}, type: ${typeof orderId}`);

  if (!orderId) {
    console.warn(`[archive] Skipping archive - missing orderId for chat ${chatId}`);
    return;
  }

  const chat = await Chat.findOne({ chatId });
  if (!chat || !chat.messages.length) return;

  const hasRealContent = chat.messages.some(m =>
    m.type !== 'system' || !m.text?.includes('joined the chat')
  );
  if (!hasRealContent) return;

  const order = await Order.findOne({ orderId }).lean();

  const sessionObj = {
    orderId,
    startedAt: chat.createdAt || new Date(),
    completedAt: new Date(),
    status,
    messages: chat.messages,
    orderData: {
      chatId: order?.chatId,
      orderId: order?.orderId || orderId,
      serviceType: order?.serviceType,
      taskType: order?.taskType,
      status: order?.status,
      paymentStatus: order?.paymentStatus,
      itemBudget: order?.itemBudget,
      deliveryFee: order?.deliveryFee,
      totalAmount: order?.totalAmount,
      platformFee: order?.platformFee,
      runnerPayout: order?.runnerPayout,
      usedPayoutSystem: order?.usedPayoutSystem,
      pickupLocation: order?.pickupLocation,
      pickupCoordinates: order?.pickupCoordinates,
      deliveryLocation: order?.deliveryLocation,
      deliveryCoordinates: order?.deliveryCoordinates,
      marketLocation: order?.marketLocation,
      marketCoordinates: order?.marketCoordinates,
      routeDistanceMeters: order?.routeDistanceMeters,
      routeLegs: order?.routeLegs,
      fleetType: order?.fleetType,
      specialInstructions: order?.specialInstructions,
      createdAt: order?.createdAt,
      completedAt: order?.completedAt || new Date(),
      deliveryConfirmedAt: order?.deliveryConfirmedAt,
      statusHistory: order?.statusHistory,
    },
    runnerInfo: order?.runnerId ? { runnerId: order.runnerId } : null,
    userInfo: order?.userId ? { userId: order.userId } : null,
  };

  console.log(`[archive] Session object orderId: ${sessionObj.orderId}`);

  await Chat.findOneAndUpdate(
    { chatId },
    { $push: { orderSessions: sessionObj } },
    { upsert: true }
  );

  console.log(`[archive] Order ${orderId} archived with full data, status: ${status}`);
};

// ─── Message builders ─────────────────────────────────────────────────────────

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

// ─── createOrder: single source of truth ─────────────────────────────────────
//
// Creates the order document, injects the payment_request message into chat,
// and broadcasts orderCreated + chatHistory to both parties.
// Called only once per session, after both parties are confirmed in-room.
//
const createOrder = async (io, { chatId, userId, runnerId, serviceType }) => {
  console.log('[createOrder] Starting for chatId:', chatId);

  // Cancel any lingering unpaid / non-terminal orders for this chat
  await Order.updateMany(
    {
      chatId,
      status: { $nin: ['completed', 'cancelled', 'task_completed'] },
      paymentStatus: { $ne: 'paid' }
    },
    {
      $set: {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelReason: 'new_session_started',
      },
      $push: {
        statusHistory: {
          status: 'cancelled',
          timestamp: new Date(),
          triggeredBy: 'system',
          note: 'Superseded by new session',
        },
      },
    }
  );

  // Gather data needed for pricing
  const [runnerDoc, userDoc] = await Promise.all([
    Runner.findById(runnerId).lean(),
    User.findById(userId).lean(),
  ]);

  const chatDoc = await Chat.findOne({ chatId }).lean();
  const fleetType = chatDoc?.fleetType || userDoc?.currentRequest?.fleetType;
  const resolvedServiceType = serviceType || userDoc?.currentRequest?.serviceType || chatDoc?.serviceType;

  const { deliveryFee, distanceInMeters, legs } = computeDeliveryFeeFromDocs(resolvedServiceType, userDoc, fleetType);
  const isErrand = resolvedServiceType === 'run-errand';
  const itemBudget = isErrand
    ? Number(userDoc?.currentRequest?.itemBudget || userDoc?.currentRequest?.budget) || 0
    : 0;
  const totalAmount = itemBudget + deliveryFee;
  const { platformFee, runnerPayout } = Escrow.calculateFees(deliveryFee);

  const request = userDoc?.currentRequest || {};
  const pickupLocationObj = request.pickupLocation ? { address: request.pickupLocation } : null;
  const deliveryLocationObj = request.deliveryLocation ? { address: request.deliveryLocation } : null;
  const marketLocationObj = request.marketLocation ? { address: request.marketLocation } : null;

  // Create the order
  const order = await Order.create({
    orderId: Order.generateOrderId(),
    chatId,
    userId,
    runnerId,
    serviceType: resolvedServiceType,
    taskType: isErrand ? 'run-errand' : 'pick-up',
    pickupLocation: pickupLocationObj,
    deliveryLocation: deliveryLocationObj,
    marketLocation: marketLocationObj,
    marketCoordinates: request.marketCoordinates || null,
    pickupCoordinates: request.pickupCoordinates || null,
    deliveryCoordinates: request.deliveryCoordinates || null,
    routeDistanceMeters: Math.round(distanceInMeters || 0),
    routeLegs: legs || {},
    itemBudget,
    deliveryFee,
    totalAmount,
    platformFee,
    runnerPayout,
    specialInstructions: request.specialInstructions || null,
    pickupItems: request.pickupItems || null,
    marketItems: request.marketItems || null,
    fleetType: request.fleetType || fleetType || null,
    status: 'pending_payment',
    paymentStatus: 'unpaid',
    approvalStatus: isErrand ? 'pending' : 'not_required',
    statusHistory: [{
      status: 'pending_payment',
      timestamp: new Date(),
      triggeredBy: 'system',
      note: 'Order created on session start',
    }],
  });

  console.log('[createOrder] Order created:', order.orderId);

  // Pin orderId onto the chat document
  await Chat.findOneAndUpdate(
    { chatId },
    { $set: { orderId: order.orderId, taskId: order.orderId, lastActivity: new Date() } }
  );

  // Mark runner & user as busy with this order
  await Promise.all([
    Runner.findByIdAndUpdate(runnerId, { activeOrderId: order.orderId }),
    User.findByIdAndUpdate(userId, { activeOrderId: order.orderId }),
  ]);

  // Build and inject the payment_request message
  const paymentRequestMsg = buildPaymentRequestMsg(order, chatId, userId, runnerId);
  const finalChat = await Chat.findOneAndUpdate(
    { chatId },
    { $push: { messages: paymentRequestMsg } },
    { new: true }
  );

  const cleanMessages = deduplicateMessages(finalChat.messages);

  // Build a lean order payload for socket emission
  const orderPayload = {
    chatId: order.chatId,
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
    marketLocation: order.marketLocation,
    deliveryLocation: order.deliveryLocation,
    pickupLocation: order.pickupLocation,
    marketCoordinates: order.marketCoordinates,
    deliveryCoordinates: order.deliveryCoordinates,
    pickupCoordinates: order.pickupCoordinates,
  };

  // Broadcast to both parties
  io.to(`user-${userId}`).emit('orderCreated', { order: orderPayload, isNewOrder: true });
  io.to(`runner-${runnerId}`).emit('orderCreated', { order: orderPayload, isNewOrder: true });

  io.to(chatId).emit('chatHistory', cleanMessages);

  console.log('[createOrder] Broadcast complete. Messages:', cleanMessages.length);

  // Push payment notification to user
  await notifyPaymentRequest(userId, { orderId: order.orderId, amount: order.totalAmount });

  logSocketAudit('ORDER_CREATED', { orderId: order.orderId, chatId, userId, runnerId });

  return { order, cleanMessages };
};

// ─── Room handlers ────────────────────────────────────────────────────────────

const handleJoinRunnerRoom = async (socket, { runnerId, serviceType, fleetType }) => {
  socket.runnerId = runnerId;
  socket.serviceType = serviceType;

  socket.join(`runners-${serviceType}`);
  socket.join(`runner-${runnerId}`);

  await Runner.findByIdAndUpdate(runnerId, {
    activeServiceType: serviceType,
    activeFleetType: fleetType,
    isAvailable: true,
  });

  const verificationCheck = await canRunnerAcceptErrand(runnerId);
  socket.emit('verificationStatus', { ...verificationCheck, timestamp: new Date().toISOString() });

  runnersByService[serviceType].add(socket.id);

  const requests = await ServiceRequest.find({ serviceType, status: "available" });
  socket.emit("existingRequests", requests);

  logSocketAudit('RUNNER_JOINED_ROOM', { runnerId, serviceType });
};

// ─── Pre-room: runner accepts ─────────────────────────────────────────────────
//
// Flow:
//   1. Runner accepts → joins pre-${chatId}, sets state.runner = true
//   2. Emits enterPreRoom to the user socket so user knows to join
//   3. If user is ALREADY in pre-room → proceed immediately via lockAndProceed
//   4. Otherwise start a 30s global timer; if user never shows → timeout
//
const handleAcceptRunnerRequest = async (socket, io, { runnerId, userId, chatId, serviceType }) => {
  console.log('[SERVER] ========== acceptRunnerRequest RECEIVED ==========');
  console.log('[SERVER] runnerId:', runnerId, '| userId:', userId, '| chatId:', chatId);

  try {
    const verificationCheck = await canRunnerAcceptErrand(runnerId);
    if (!verificationCheck.canAccept) {
      socket.emit('error', {
        message: verificationCheck.reason,
        code: 'VERIFICATION_FAILED',
        details: verificationCheck,
      });
      socket.emit('verificationStatus', { ...verificationCheck, timestamp: new Date().toISOString() });
      return;
    }

    if (!preRoomState.has(chatId)) {
      preRoomState.set(chatId, {
        user: false, runner: false,
        runnerId, userId, serviceType,
        timestamp: Date.now(),
      });
    }

    const state = preRoomState.get(chatId);

    if (state.runner) {
      console.warn('[acceptRunnerRequest] runner already in pre-room for chatId:', chatId);
      return;
    }

    state.runner = true;
    state.runnerId = runnerId;

    socket.join(`pre-${chatId}`);
    console.log(`[acceptRunnerRequest] Runner ${runnerId} joined pre-${chatId}`);

    await incrementErrandCount(runnerId);

    // Tell the user to enter the pre-room
    io.to(`user-${userId}`).emit('enterPreRoom', {
      chatId, runnerId, userId, serviceType,
      message: 'Runner accepted! Preparing chat...',
    });

    // If user is already waiting, go immediately
    if (state.user) {
      if (state.globalTimer) { clearTimeout(state.globalTimer); state.globalTimer = null; }
      await lockAndProceed(io, chatId, state);
      return;
    }

    // Start global timeout — runner arrived first
    if (!state.globalTimer) {
      state.globalTimer = setTimeout(() => {
        const s = preRoomState.get(chatId);
        if (s && (!s.user || !s.runner)) {
          console.warn('[preRoom] timeout — both parties never arrived for chatId:', chatId);
          preRoomState.delete(chatId);
          io.to(`pre-${chatId}`).emit('preRoomTimeout', { chatId, message: 'Connection timed out.' });
        }
      }, 30_000);
    }

    logSocketAudit('RUNNER_ACCEPTED_REQUEST', { runnerId, serviceType, chatId, userId });
  } catch (error) {
    console.error('[acceptRunnerRequest] error:', error);
  }
};

// ─── Pre-room: user responds to enterPreRoom ──────────────────────────────────
//
// Flow:
//   1. User receives enterPreRoom → client emits requestRunner
//   2. User joins pre-${chatId}, sets state.user = true
//   3. If runner is ALREADY in pre-room → proceed immediately via lockAndProceed
//   4. Otherwise start a 30s global timer; if runner never shows → timeout
//
const handleRequestRunner = async (socket, io, data) => {
  const { runnerId, userId, chatId, serviceType, specialInstructions } = data;

  socket.join(`user-${userId}`);

  if (!preRoomState.has(chatId)) {
    preRoomState.set(chatId, {
      user: false, runner: false,
      runnerId, userId, serviceType,
      timestamp: Date.now(),
    });
  }

  const state = preRoomState.get(chatId);

  if (state.user) {
    console.warn('[requestRunner] user already in pre-room for chatId:', chatId);
    return;
  }

  state.user = true;
  state.userId = userId;
  state.specialInstructions = specialInstructions || null;
  socket.join(`pre-${chatId}`);

  console.log(`[requestRunner] user ${userId} in pre-room. runner present=${state.runner}`);

  // Runner already waiting → go immediately
  if (state.runner) {
    if (state.globalTimer) { clearTimeout(state.globalTimer); state.globalTimer = null; }
    await lockAndProceed(io, chatId, state);
    return;
  }

  // Start global timeout — user arrived first
  if (!state.globalTimer) {
    state.globalTimer = setTimeout(() => {
      const s = preRoomState.get(chatId);
      if (s && (!s.user || !s.runner)) {
        console.warn('[preRoom] timeout — both parties never arrived for chatId:', chatId);
        preRoomState.delete(chatId);
        io.to(`pre-${chatId}`).emit('preRoomTimeout', { chatId, message: 'Connection timed out.' });
      }
    }, 30_000);
  }

  logSocketAudit('USER_REQUESTED_RUNNER', { runnerId, userId, chatId, serviceType });
};

// ─── Lock both parties and proceed ───────────────────────────────────────────

const lockAndProceed = async (io, chatId, state) => {
  if (state.locked) {
    console.warn('[lockAndProceed] already locked for chatId:', chatId);
    return;
  }

  state.locked = true;

  if (state.globalTimer) {
    clearTimeout(state.globalTimer);
    state.globalTimer = null;
  }

  const { runnerId, userId } = state;
  await Promise.all([
    Runner.findByIdAndUpdate(runnerId, { isAvailable: false }),
    User.findByIdAndUpdate(userId, { isAvailable: false }),
  ]);
  await initializeChatAndProceed(io, chatId, state);
  logSocketAudit('CHAT_LOCKED', { runnerId, userId });
};

// ─── Chat initialization (pre-room → chat) ────────────────────────────────────
//
// Responsibilities:
//   1. Archive any previous session for this chatId
//   2. Reset the chat document with fresh runner profile messages
//   3. Emit proceedToChat to both parties
//   4. Reset socket join-state so handleUserJoinChat / handleRunnerJoinChat
//      will do a full re-join when the clients call joinChat
//
const initializeChatAndProceed = async (io, chatId, state) => {
  const { runnerId, userId, serviceType } = state;

  const userDoc = await User.findById(userId).lean();
  console.log('[initializeChat] userDoc.currentRequest.specialInstructions:',
    JSON.stringify(userDoc?.currentRequest?.specialInstructions, null, 2));

  try {
    const [runnerData] = await Promise.all([
      Runner.findById(runnerId).lean(),
    ]);

    const specialInstructions = sanitizeSpecialInstructions(
      userDoc?.currentRequest?.specialInstructions || state.specialInstructions
    );

    // Build fresh profile messages (system + profile-card)
    const initialMessages = createInitialRunnerMessages(runnerData, serviceType, runnerId);

    let chat;
    const existingChat = await Chat.findOne({ chatId });

    if (existingChat) {
      // Archive the last order session before wiping
      const lastOrder = await Order.findOne({ chatId })
        .sort({ createdAt: -1 })
        .lean();

      if (lastOrder?.orderId) {
        await archiveCurrentSession(
          chatId,
          lastOrder.orderId,
          ['completed', 'task_completed'].includes(lastOrder.status) ? 'completed' : 'cancelled'
        );
      }

      // Cancel all non-terminal orders for this chat
      await Order.updateMany(
        { chatId, status: { $nin: ['completed', 'cancelled', 'task_completed'] } },
        {
          $set: { status: 'cancelled', cancelledAt: new Date(), cancelReason: 'new_session_started' },
          $push: {
            statusHistory: {
              status: 'cancelled',
              timestamp: new Date(),
              triggeredBy: 'system',
              note: 'New session started',
            },
          },
        }
      );

      // Wipe messages and reset the chat document
      existingChat.messages = [...initialMessages];
      existingChat.specialInstructions = specialInstructions || null;
      existingChat.lastActivity = new Date();
      existingChat.serviceType = serviceType;
      existingChat.orderId = null;
      existingChat.taskId = null;
      await existingChat.save();
      chat = existingChat;

      // Confirm the DB write landed
      const verified = await Chat.findOne({ chatId }).lean();
      const hasInitial = verified?.messages?.some(
        m => m.type === 'system' && m.text?.includes('joined the chat')
      );
      if (!hasInitial) {
        console.error('[initializeChat] DB write not confirmed — aborting proceedToChat');
        return;
      }

      // Reset all sockets currently in the chat room so they force a full re-join
      for (const roomName of [chatId, `runner-${runnerId}`, `user-${userId}`]) {
        const room = io.sockets.adapter.rooms.get(roomName);
        if (room) {
          for (const socketId of room) {
            const s = io.sockets.sockets.get(socketId);
            if (s) {
              s.joinedChat = false;
              s.currentChatId = null;
            }
            socketMessageSnapshot.delete(socketId);
          }
        }
      }

      console.log('[initializeChat] Existing chat reset — new session ready');
      io.to(`user-${userId}`).emit('chatReset', { chatId });
    } else {
      chat = await Chat.create({
        chatId,
        messages: initialMessages,
        orderSessions: [],
        userId,
        runnerId,
        serviceType,
        createdBy: 'system',
        createdAt: new Date(),
        specialInstructions: specialInstructions || null,
      });
      console.log('[initializeChat] New chat created');
    }

    // Tell both parties to proceed — they will call joinChat which triggers createOrder
    io.to(`pre-${chatId}`).emit('proceedToChat', {
      chatId, runnerId, userId, serviceType,
      chatReady: true,
      initialMessages: chat.messages,
      specialInstructions: specialInstructions || null,
    });

    console.log('[initializeChat] emitting specialInstructions:', JSON.stringify(specialInstructions, null, 2));

    preRoomState.delete(chatId);
    logSocketAudit('PROCEED_TO_CHATROOM', { runnerId, userId, serviceType });
  } catch (error) {
    console.error('[initializeChat] error:', error);
  }
};

// ─── User joins chat ──────────────────────────────────────────────────────────
//
// Server is the source of truth. Strategy:
//   1. Prevent concurrent joins for the same chatId
//   2. Always read fresh from DB
//   3. If there is already a paid active order → restore history, filter payment_request out
//   4. If there is an unpaid active order → ensure payment_request is present, emit
//   5. If no active order at all → call createOrder (which injects payment_request and broadcasts)
//
const handleUserJoinChat = async (socket, io, data) => {
  const { userId, runnerId, chatId } = data;

  if (joiningChats.has(chatId)) {
    console.log('[userJoinChat] concurrent join blocked for:', chatId);
    setTimeout(async () => {
      const existing = await Chat.findOne({ chatId }).lean();
      if (existing) {
        const clean = await deduplicateAndPersist(chatId, existing.messages);
        socket.emit('chatHistory', clean);
      }
    }, 600);
    return;
  }

  joiningChats.add(chatId);

  try {
    // Always (re-)join these rooms so messages reach this socket
    socket.join(chatId);
    socket.join(`user-${userId}`);
    socket.currentChatId = chatId;
    socket.joinedChat = true;
    socket.userId = userId;
    socket.runnerId = runnerId;

    // ── Fresh read from DB ────────────────────────────────────────────────────
    const [chat, latestOrder] = await Promise.all([
      Chat.findOne({ chatId }),
      Order.findOne({ chatId }).sort({ createdAt: -1 }).lean(),
    ]);

    if (!chat) {
      console.log('[userJoinChat] no chat document yet — waiting for initializeChatAndProceed');
      socket.emit('chatHistory', []);
      io.to(`runner-${runnerId}`).emit('userJoinedChat', {
        userId, runnerId, chatId,
        userInRoom: true,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    console.log('[userJoinChat] latestOrder:', latestOrder?.orderId,
      '| status:', latestOrder?.status,
      '| paymentStatus:', latestOrder?.paymentStatus);

    const isTerminal = ['completed', 'cancelled', 'task_completed'].includes(latestOrder?.status);
    const isPaid = latestOrder?.paymentStatus === 'paid';
    const isActiveUnpaid = latestOrder && !isPaid && !isTerminal;
    const isActivePaid = latestOrder && isPaid && !isTerminal;

    // ── CASE A: paid active order → restore history without payment_request ──
    if (isActivePaid) {
      console.log('[userJoinChat] CASE A — paid active order, restoring history');
      const cleanMessages = await deduplicateAndPersist(chatId, chat.messages);
      const filtered = cleanMessages.filter(
        m => m.type !== 'payment_request' && m.messageType !== 'payment_request'
      );
      filtered.forEach(m => snapshotMessage(socket.id, chatId, m.id));
      socket.emit('orderCreated', { order: cleanForEmit(latestOrder) });
      socket.emit('chatHistory', filtered);
      io.to(`runner-${runnerId}`).emit('userJoinedChat', {
        userId, runnerId, chatId, userInRoom: true, timestamp: new Date().toISOString(),
      });
      logSocketAudit('USER_JOINED_CHAT', { userId, runnerId, chatId, case: 'A' });
      return;
    }

    // ── CASE B: unpaid active order → ensure payment_request present ──────────
    if (isActiveUnpaid) {
      console.log('[userJoinChat] CASE B — unpaid active order');
      const alreadyHas = chat.messages.some(
        m => (m.type === 'payment_request' || m.messageType === 'payment_request')
          && m.paymentData?.orderId === latestOrder.orderId
      );

      let finalChat = chat;
      if (!alreadyHas) {
        finalChat = await Chat.findOneAndUpdate(
          { chatId },
          {
            $push: { messages: buildPaymentRequestMsg(latestOrder, chatId, userId, runnerId) },
            $set: { lastActivity: new Date() },
          },
          { new: true }
        );
      }

      const cleanMessages = await deduplicateAndPersist(chatId, finalChat.messages);
      cleanMessages.forEach(m => snapshotMessage(socket.id, chatId, m.id));

      socket.emit('orderCreated', {
        order: {
          chatId: latestOrder.chatId,
          orderId: latestOrder.orderId,
          itemBudget: latestOrder.itemBudget,
          deliveryFee: latestOrder.deliveryFee,
          totalAmount: latestOrder.totalAmount,
          taskType: latestOrder.taskType,
          serviceType: latestOrder.serviceType,
          status: latestOrder.status,
          paymentStatus: latestOrder.paymentStatus,
        },
        isNewOrder: false,
      });
      socket.emit('chatHistory', cleanMessages);
      io.to(`runner-${runnerId}`).emit('userJoinedChat', {
        userId, runnerId, chatId, userInRoom: true, timestamp: new Date().toISOString(),
      });
      logSocketAudit('USER_JOINED_CHAT', { userId, runnerId, chatId, case: 'B' });
      return;
    }

    // ── CASE C: no active order (terminal or none) → create fresh order ───────
    console.log('[userJoinChat] CASE C — creating new order');

    // Race guard: another concurrent join may have already created one
    const raceGuard = await Order.findOne({
      chatId,
      status: { $nin: ['cancelled', 'completed', 'task_completed'] },
    }).lean();

    if (raceGuard) {
      console.log('[userJoinChat] race guard — active order exists:', raceGuard.orderId);
      const existingChat = await Chat.findOne({ chatId }).lean();
      const cleanMessages = await deduplicateAndPersist(chatId, existingChat.messages);
      cleanMessages.forEach(m => snapshotMessage(socket.id, chatId, m.id));
      socket.emit('orderCreated', { order: cleanForEmit(raceGuard) });
      socket.emit('chatHistory', cleanMessages);
      io.to(`runner-${runnerId}`).emit('userJoinedChat', {
        userId, runnerId, chatId, userInRoom: true, timestamp: new Date().toISOString(),
      });
      return;
    }

    // Derive serviceType from DB sources
    const userDoc = await User.findById(userId).lean();
    const resolvedServiceType = userDoc?.currentRequest?.serviceType || chat.serviceType;

    // Ensure chat.serviceType is current
    if (resolvedServiceType && resolvedServiceType !== chat.serviceType) {
      await Chat.findOneAndUpdate({ chatId }, { $set: { serviceType: resolvedServiceType } });
    }

    // createOrder handles: order creation, payment_request injection, and broadcast
    const { cleanMessages } = await createOrder(io, {
      chatId, userId, runnerId, serviceType: resolvedServiceType,
    });

    cleanMessages.forEach(m => snapshotMessage(socket.id, chatId, m.id));

    io.to(`runner-${runnerId}`).emit('userJoinedChat', {
      userId, runnerId, chatId, userInRoom: true, timestamp: new Date().toISOString(),
    });

    logSocketAudit('USER_JOINED_CHAT', { userId, runnerId, chatId, case: 'C' });
  } catch (err) {
    console.error('[userJoinChat] error:', err);
  } finally {
    joiningChats.delete(chatId);
  }
};

// ─── Runner joins chat ────────────────────────────────────────────────────────
//
// Server is the source of truth.
// Always read fresh from DB. Filter payment_request if order is paid.
//
const handleRunnerJoinChat = async (socket, io, data) => {
  const { runnerId, userId, chatId } = data;

  // Always (re-)join these rooms
  socket.join(chatId);
  socket.join(`runner-${runnerId}`);
  socket.currentChatId = chatId;
  socket.joinedChat = true;
  socket.runnerId = runnerId;
  socket.userId = userId;

  // ── Fresh read from DB ──────────────────────────────────────────────────────
  const [chat, order] = await Promise.all([
    Chat.findOne({ chatId }).lean(),
    Order.findOne({ chatId }).sort({ createdAt: -1 }).lean(),
  ]);

  if (!chat) {
    socket.emit('chatHistory', []);
    return;
  }

  const cleanMessages = await deduplicateAndPersist(chatId, chat.messages);
  cleanMessages.forEach(m => snapshotMessage(socket.id, chatId, m.id));

  const isPaid = order?.paymentStatus === 'paid';
  const filteredMessages = isPaid
    ? cleanMessages.filter(m => m.type !== 'payment_request' && m.messageType !== 'payment_request')
    : cleanMessages;

  socket.emit('chatHistory', filteredMessages);

  if (chat.specialInstructions) {
    console.log('[runnerJoinChat] emitting specialInstructions:', JSON.stringify(chat.specialInstructions, null, 2));
    socket.emit('specialInstructions', { chatId, specialInstructions: chat.specialInstructions });
  }

  if (order) {
    socket.emit('orderCreated', { order: { ...cleanForEmit(order), chatId } });
  }

  io.to(`user-${userId}`).emit('runnerJoinedChat', {
    userId, runnerId, chatId,
    runnerInRoom: true,
    timestamp: new Date().toISOString(),
  });

  logSocketAudit('RUNNER_JOINED_CHAT', { runnerId, chatId, userId });
};

// ─── Message handlers ─────────────────────────────────────────────────────────

const handleSendMessage = async (socket, io, { chatId, message }) => {
  const startTime = Date.now();
  try {
    socket.to(chatId).emit('message', cleanForEmit(message));

    if (message?.isPresenceMessage) return;

    if (!pendingWrites.has(chatId)) {
      pendingWrites.set(chatId, { messages: [], timer: null });
    }

    const pending = pendingWrites.get(chatId);
    pending.messages.push(message);

    if (pending.timer) clearTimeout(pending.timer);
    pending.timer = setTimeout(async () => {
      const toWrite = pending.messages.splice(0);
      pendingWrites.delete(chatId);
      try {
        await Chat.findOneAndUpdate(
          { chatId },
          { $push: { messages: { $each: toWrite } } },
          { upsert: true }
        );
      } catch (err) {
        console.error('[sendMessage] batch write failed:', err.message);
      }
    }, 2000);

    const room = io.sockets.adapter.rooms.get(chatId);
    if (room) {
      for (const socketId of room) snapshotMessage(socketId, chatId, message.id);
    }

    await logMetric({ type: 'message', status: 'success', latency: Date.now() - startTime, chatId });
  } catch (error) {
    console.error('Error sending message:', error);
    socket.to(chatId).emit('message', cleanForEmit(message));
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
        chat.messages[idx] = {
          ...chat.messages[idx],
          deleted: true,
          text: "This message was deleted",
          type: "deleted",
          fileUrl: null,
          fileName: null,
          createdAt: new Date(),
        };
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

  const snapshot = socketMessageSnapshot.get(socket.id);

  // Always fresh from DB
  const [chat, latestOrder] = await Promise.all([
    Chat.findOne({ chatId }).select('messages specialInstructions').lean(),
    Order.findOne({ chatId }).sort({ createdAt: -1 }).select('paymentStatus status').lean(),
  ]);

  if (!chat?.messages?.length) {
    console.log('[rejoinChat] no chat found');
    return;
  }

  const isPaid = latestOrder?.paymentStatus === 'paid';

  let cleanMessages = deduplicateMessages(chat.messages);
  if (isPaid) {
    cleanMessages = cleanMessages.filter(
      m => m.type !== 'payment_request' && m.messageType !== 'payment_request'
    );
  }

  const userDoc = userType === 'user' ? await User.findById(userId).lean() : null;

  if (!snapshot || snapshot.chatId !== chatId) {
    console.log('[rejoinChat] no snapshot, sending full chatHistory');
    cleanMessages.forEach(m => snapshotMessage(socket.id, chatId, m.id));
    socket.emit('chatHistory', {
      messages: cleanMessages,
      userData: userDoc ? {
        firstName: userDoc.firstName,
        lastName: userDoc.lastName,
        avatar: userDoc.profilePicture || null,
      } : null,
    });
  } else {
    const missed = cleanMessages.filter(m => m.id && !snapshot.messageIds.has(m.id));
    if (missed.length === 0) {
      console.log('[rejoinChat] client is up to date, no missed messages');
    } else {
      console.log('[rejoinChat] sending', missed.length, 'missed messages');
      missed.forEach(m => snapshotMessage(socket.id, chatId, m.id));
      socket.emit('missedMessages', missed);
    }
  }

  console.log('[rejoinChat] room size:', io.sockets.adapter.rooms.get(chatId)?.size);
};

// ─── Fetch archived order session ─────────────────────────────────────────────

const handleGetOrderSession = async (socket, { chatId, orderId }) => {
  try {
    const chat = await Chat.findOne({ chatId }).lean();
    if (!chat) return socket.emit('orderSessionHistory', { orderId, messages: [] });

    const session = chat.orderSessions?.find(s => s.orderId === orderId);
    socket.emit('orderSessionHistory', {
      orderId,
      chatId,
      messages: session?.messages || [],
      status: session?.status || null,
      completedAt: session?.completedAt || null,
    });
  } catch (err) {
    console.error('handleGetOrderSession error:', err);
    socket.emit('orderSessionHistory', { orderId, messages: [] });
  }
};

// ─── Get archived messages for a completed order session ──────────────────────

const handleGetArchivedMessages = async (socket, { chatId, userId, runnerId, orderId }) => {
  try {
    const chat = await Chat.findOne({ chatId }).lean();
    if (!chat) return socket.emit('archivedMessages', { chatId, messages: [] });

    let messages = [];
    let status = null;
    let completedAt = null;

    if (orderId) {
      const session = chat.orderSessions?.find(s => s.orderId === orderId);
      if (session) {
        messages = session.messages;
        status = session.status;
        completedAt = session.completedAt;
      }
    } else {
      const lastSession = [...(chat.orderSessions || [])]
        .reverse()
        .find(s => s.status === 'completed' || s.status === 'task_completed');
      if (lastSession) {
        messages = lastSession.messages;
        status = lastSession.status;
        completedAt = lastSession.completedAt;
      }
    }

    socket.emit('archivedMessages', { chatId, messages, status, completedAt, orderId: orderId || null });
    logSocketAudit('GET_ARCHIVED_MESSAGES', { chatId, userId, runnerId, orderId });
  } catch (err) {
    console.error('handleGetArchivedMessages error:', err);
    socket.emit('archivedMessages', { chatId, messages: [] });
  }
};

// ─── Disconnect ───────────────────────────────────────────────────────────────

const handleDisconnect = async (socket, io) => {
  if (socket.serviceType && runnersByService[socket.serviceType]) {
    runnersByService[socket.serviceType].delete(socket.id);
  }
  socketMessageSnapshot.delete(socket.id);

  const isRunner = !!socket.runnerId && !socket.userId;
  const offlineId = isRunner ? socket.runnerId : socket.userId;

  if (!offlineId) return;

  const Model = isRunner ? Runner : User;
  const offlinePerson = await Model.findById(offlineId).select('firstName lastName').lean();
  const name = offlinePerson
    ? `${offlinePerson.firstName} ${offlinePerson.lastName || ''}`.trim()
    : isRunner ? 'Your runner' : 'The user';

  const chatId = socket.currentChatId;
  const partnerId = isRunner ? socket.userId : socket.runnerId;
  const partnerType = isRunner ? 'user' : 'runner';

  if (!partnerId || !chatId) return;

  await notifyPartnerOffline(partnerId, partnerType, { chatId, name });
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
  archiveCurrentSession,
  handleGetOrderSession,
  handleGetArchivedMessages,
  createOrder,
};