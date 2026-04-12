// socketHandlers.js
const { Chat } = require("../models/Chat");
const ServiceRequest = require("./ServiceRequest");
const Invoice = require("../models/Invoice");
const User = require("../models/User");
const Runner = require("../models/Runner");

const Order = require("../models/Order");
const Escrow = require('../models/Escrows');
const { notifyPaymentRequest, notifyPartnerOffline } = require('../services/notificationService');

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
const pendingWrites = new Map();
const joiningChats = new Set()

// ─── In-memory snapshot store: socketId → { chatId, messageIds: Set }
const socketMessageSnapshot = new Map();

// ─── Helpers 
const stripForTransport = (msg) => {
  if (!msg) return msg;
  const stripped = { ...msg };
  // Never send base64 over socket — only URLs
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

// archive current messages into orderSessions 

const archiveCurrentSession = async (chatId, orderId, status = 'completed') => {
  console.log(`[archive] Called with orderId: ${orderId}, type: ${typeof orderId}`);

  if (!orderId) {
    console.warn(`[archive] Skipping archive - missing orderId for chat ${chatId}`);
    return;
  }

  const chat = await Chat.findOne({ chatId });
  if (!chat || !chat.messages.length) return;

  // Don't archive if messages are just the initial runner join messages
  const hasRealContent = chat.messages.some(m =>
    m.type !== 'system' || !m.text?.includes('joined the chat')
  );
  if (!hasRealContent) return;

  // Fetch the full order data
  const order = await Order.findOne({ orderId }).lean();

  // Build the session object first
  const sessionObj = {
    orderId: orderId,
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

const handleJoinRunnerRoom = async (socket, { runnerId, serviceType, fleetType }) => {
  socket.runnerId = runnerId;
  socket.serviceType = serviceType;

  socket.join(`runners-${serviceType}`);
  socket.join(`runner-${runnerId}`);

  await Runner.findByIdAndUpdate(runnerId, {
    activeServiceType: serviceType,
    activeFleetType: fleetType,
    isAvailable: true
  });

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

// ─── Chat initialization (pre-room → chat) 

const initializeChatAndProceed = async (io, chatId, state) => {
  const { runnerId, userId, serviceType } = state;
  const specialInstructions = sanitizeSpecialInstructions(state.specialInstructions);

  try {
    const [user, runnerData] = await Promise.all([
      User.findById(userId).lean(),
      Runner.findById(runnerId).lean(),
    ]);

    const initialMessages = createInitialRunnerMessages(runnerData, serviceType, runnerId);

    let chat;
    const existingChat = await Chat.findOne({ chatId });

    if (existingChat) {
      // Archive the previous session before wiping
      const lastOrder = await Order.findOne({ chatId })
        .sort({ createdAt: -1 })
        .lean();

      if (lastOrder?.orderId) {
        await archiveCurrentSession(chatId, lastOrder.orderId,
          ['completed', 'task_completed'].includes(lastOrder.status)
            ? 'completed'
            : 'cancelled'
        );
      }

      // Cancel stale unpaid orders
      await Order.updateMany(
        { chatId, status: { $nin: ['completed', 'cancelled', 'task_completed'] } },
        { $set: { status: 'cancelled', cancelledAt: new Date(), cancelReason: 'new_session_started' } }
      );

      // Reset messages to ONLY initial messages for fresh session
      existingChat.messages = [...initialMessages];
      existingChat.specialInstructions = specialInstructions || existingChat.specialInstructions;
      existingChat.lastActivity = new Date();

      await existingChat.save();
      chat = existingChat;

      // Verify the write landed before emitting proceedToChat
      const verified = await Chat.findOne({ chatId }).lean();
      const hasInitial = verified?.messages?.some(
        m => m.type === 'system' && m.text?.includes('joined the chat')
      );
      if (!hasInitial) {
        console.error('[initializeChat] DB write not confirmed — aborting proceedToChat');
        return;
      }

      const room = io.sockets.adapter.rooms.get(chatId);
      if (room) {
        for (const socketId of room) {
          const s = io.sockets.sockets.get(socketId);
          if (s && s.currentChatId === chatId) {
            s.joinedChat = false; // force full re-join on next userJoinChat
          }
        }
      }

      // ALSO reset runner socket so it forces full re-join
      const runnerRoom = io.sockets.adapter.rooms.get(`runner-${state.runnerId}`);
      if (runnerRoom) {
        for (const socketId of runnerRoom) {
          const s = io.sockets.sockets.get(socketId);
          if (s) {
            s.joinedChat = false;
            s.currentChatId = null; // force full re-join path in handleRunnerJoinChat
          }
        }
      }

      const allAffectedRooms = [chatId, `runner-${state.runnerId}`, `user-${state.userId}`];
      for (const roomName of allAffectedRooms) {
        const room = io.sockets.adapter.rooms.get(roomName);
        if (room) {
          for (const socketId of room) {
            socketMessageSnapshot.delete(socketId); // cleared — rebuilt on next join
          }
        }
      }


      console.log('[initializeChat] Existing chat reset with fresh initial messages for new order');
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

    // Emit proceed to chat with fresh initial messages
    io.to(`pre-${chatId}`).emit('proceedToChat', {
      chatId, runnerId, userId, serviceType,
      chatReady: true,
      initialMessages: chat.messages,
      specialInstructions: specialInstructions || null,
    });

    preRoomState.delete(chatId);
    logSocketAudit('PROCEED_TO_CHATROOM', { runnerId, userId, serviceType });
  } catch (error) {
    console.error('Error initializing chat:', error);
  }
};

// ─── User joins chat 

const handleUserJoinChat = async (socket, io, data) => {
  const { userId, runnerId, chatId } = data;
  let orderAlreadyEmitted = false;

  // block concurrent joins for same chatId
  if (joiningChats.has(chatId)) {
    console.log('[userJoinChat] concurrent join blocked for:', chatId);
    setTimeout(async () => {
      const existing = await Chat.findOne({ chatId });
      if (existing) {
        const clean = await deduplicateAndPersist(chatId, existing.messages);
        socket.emit('chatHistory', clean);
      }
    }, 500);
    return;
  }

  joiningChats.add(chatId);

  try {
    // Idempotency guard
    if (socket.currentChatId === chatId && socket.joinedChat) {
      // Check if chat was reset for a new session
      // If chat only has initial messages (no order/payment), force full re-join
      const existing = await Chat.findOne({ chatId });
      if (existing) {
        const hasOrder = existing.messages.some(
          m => m.type === 'payment_request' || m.messageType === 'payment_request'
        );

        if (!hasOrder) {
          // Chat was reset for new session — fall through to full join
          socket.joinedChat = false;
          console.log('[userJoinChat] chat reset detected — forcing full re-join');
        } else {
          console.log('[userJoinChat] duplicate join — re-emitting chatHistory');
          const clean = await deduplicateAndPersist(chatId, existing.messages);
          socket.emit('chatHistory', clean);
          return;
        }
      } else {
        return;
      }
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

    // case A: unpaid active order (not terminal) → ensure payment_request is present
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

    // case B: paid active order (not terminal) → restore history as-is
    else if (existingOrder && isPaid && !isTerminal) {
      console.log('[userJoinChat] CASE B — paid order');
      order = existingOrder;
      finalChat = await Chat.findOne({ chatId });
      socket.emit('orderCreated', { order: cleanForEmit(order) });
    }

    // case c: no order OR terminal order → create new order
    else {
      console.log('[userJoinChat] CASE C — new order (terminal or none)');

      // Check if there's any active order (not terminal)
      const activeOrder = await Order.findOne({
        chatId,
        status: { $nin: ['cancelled', 'completed', 'task_completed'] },
      }).lean();

      if (activeOrder) {
        console.log('[userJoinChat] race guard — active order exists:', activeOrder.orderId);
        order = activeOrder;
        finalChat = chat;
      } else {
        // Cancel any stale pending orders for this chat
        await Order.updateMany(
          { chatId, paymentStatus: 'unpaid', status: { $nin: ['completed', 'cancelled', 'task_completed'] } },
          { $set: { status: 'cancelled', cancelledAt: new Date(), cancelReason: 'new_session_started' } }
        );

        const [runnerDoc, userDoc] = await Promise.all([
          Runner.findById(runnerId).lean(),
          User.findById(userId).lean(),
        ]);

        const chatDoc = await Chat.findOne({ chatId }).lean();
        const fleetType = chatDoc?.fleetType
          || userDoc?.currentRequest?.fleetType
          || chat.fleetType;

        const serviceType = chatDoc?.serviceType
          || userDoc?.currentRequest?.serviceType
          || chat.serviceType;
        const { deliveryFee, distanceInMeters, legs } = computeDeliveryFeeFromDocs(serviceType, userDoc, fleetType);
        const isErrand = serviceType === 'run-errand';
        const itemBudget = isErrand
          ? Number(userDoc?.currentRequest?.itemBudget || userDoc?.currentRequest?.budget) || 0
          : 0;
        const totalAmount = itemBudget + deliveryFee;
        const { platformFee, runnerPayout } = Escrow.calculateFees(deliveryFee);
        const request = userDoc?.currentRequest || {};

        // Build location objects with just the address string
        const pickupLocationObj = request.pickupLocation ? { address: request.pickupLocation } : null;
        const deliveryLocationObj = request.deliveryLocation ? { address: request.deliveryLocation } : null;
        const marketLocationObj = request.marketLocation ? { address: request.marketLocation } : null;

        console.log('[userJoinChat] request.marketLocation:', request.marketLocation);
        console.log('[userJoinChat] request.deliveryLocation:', request.deliveryLocation);
        console.log('[userJoinChat] request.pickupLocation:', request.pickupLocation);

        order = await Order.create({
          orderId: Order.generateOrderId(),
          chatId, userId, runnerId, serviceType,
          taskType: isErrand ? 'run-errand' : 'pick-up',
          pickupLocation: pickupLocationObj,
          deliveryLocation: deliveryLocationObj,
          marketLocation: marketLocationObj,
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

        console.log(`[userJoinChat] Emitting orderCreated to room: runner-${runnerId}`);
        console.log(`[userJoinChat] Room exists?`, io.sockets.adapter.rooms.has(`runner-${runnerId}`));

        await Promise.all([
          Runner.findByIdAndUpdate(runnerId, { activeOrderId: order.orderId }),
          User.findByIdAndUpdate(userId, { activeOrderId: order.orderId }),
        ]);

        // Get the runner data to create initial messages
        const runnerData = await Runner.findById(runnerId).lean();
        const runnerInitialMessages = createInitialRunnerMessages(runnerData, serviceType, runnerId);

        // Set messages to ONLY initial runner messages + payment request
        await Chat.findOneAndUpdate(
          { chatId },
          {
            $set: {
              messages: runnerInitialMessages,
              orderId: order.orderId,
              taskId: order.orderId,
              lastActivity: new Date()
            }
          }
        );

        // Push payment request after initial messages
        const paymentRequestMsg = buildPaymentRequestMsg(order, chatId, userId, runnerId);

        finalChat = await Chat.findOneAndUpdate(
          { chatId },
          { $push: { messages: paymentRequestMsg } },
          { new: true }
        );

        console.log('[CASE C] finalChat messages count:', finalChat?.messages?.length);
        console.log('[CASE C] finalChat message types:', finalChat?.messages?.map(m => ({ type: m.type, text: m.text?.slice(0, 50) })));

        const orderPayload = {
          order: {
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

            // locations
            marketLocation: order.marketLocation,
            deliveryLocation: order.deliveryLocation,
            pickupLocation: order.pickupLocation,
            marketCoordinates: order.marketCoordinates,
            deliveryCoordinates: order.deliveryCoordinates,
            pickupCoordinates: order.pickupCoordinates,
          },
        };

        let runnerAlreadyNotified = false;

        io.to(`runner-${runnerId}`).emit('orderCreated', orderPayload);
        runnerAlreadyNotified = true;
        runnerAlreadyNotified = true;

        const freshChatForRunner = await Chat.findOne({ chatId }).lean();
        if (freshChatForRunner?.messages?.length) {
          const cleanForRunner = deduplicateMessages(freshChatForRunner.messages);
          io.to(`runner-${runnerId}`).emit('chatHistory', cleanForRunner);
          console.log('[userJoinChat] re-emitted chatHistory to runner after CASE C setup');
        }

        await notifyPaymentRequest(userId, { orderId: order.orderId, amount: order.totalAmount });
      }
    }

    // Emit order state to this socket
    if (order && !orderAlreadyEmitted) {
      socket.emit('orderCreated', {
        order: {
          chatId: order.chatId,
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

    let filteredMessages = cleanMessages;
    if (existingOrder?.paymentStatus === 'paid') {
      filteredMessages = cleanMessages.filter(m =>
        m.type !== 'payment_request' && m.messageType !== 'payment_request'
      );
    }

    filteredMessages.forEach(m => snapshotMessage(socket.id, chatId, m.id));
    socket.emit('chatHistory', filteredMessages);
    socket.emit('chatHistory', cleanMessages);
    console.log('[userJoinChat] chatHistory emitted:', cleanMessages.length, 'messages');

    io.to(`runner-${runnerId}`).emit('userJoinedChat', { userId, runnerId, chatId, userInRoom: true, timestamp: new Date().toISOString() });
    logSocketAudit('USER_JOINED_CHAT', { userId, runnerId, chatId });

  } finally {
    joiningChats.delete(chatId);
  }
};

// ─── Runner joins chat ────────────────────────────────────────────────────────
const handleRunnerJoinChat = async (socket, io, data) => {
  const { runnerId, userId, chatId, serviceType } = data;

  socket.joinedChat = false;
  socket.currentChatId = chatId;

  socket.runnerId = runnerId;
  socket.userId = userId;
  socket.join(chatId);
  socket.join(`runner-${runnerId}`);

  if (serviceType) {
    await Chat.findOneAndUpdate(
      { chatId },
      { $set: { serviceType } }
    );
    console.log(`[runnerJoinChat] updated chat serviceType to: ${serviceType}`);
  }

  let chat = null;

  // ── Race-safe chat fetch 
  for (let attempt = 0; attempt < 3; attempt++) {
    chat = await Chat.findOne({ chatId });

    const hasInitialMessages = chat?.messages?.some(
      m => m.type === 'system' && m.text?.includes('joined the chat')
    );

    if (hasInitialMessages) break;
    await new Promise(res => setTimeout(res, 300));
  }

  if (!chat) {
    socket.emit("chatHistory", []);
  } else {
    const cleanMessages = await deduplicateAndPersist(chatId, chat.messages);
    cleanMessages.forEach(m => snapshotMessage(socket.id, chatId, m.id));

    const runnerOrder = await Order.findOne({ chatId }).sort({ createdAt: -1 }).lean();
    const runnerFilteredMessages = runnerOrder?.paymentStatus === 'paid'
      ? cleanMessages.filter(m => m.type !== 'payment_request' && m.messageType !== 'payment_request')
      : cleanMessages;

    runnerFilteredMessages.forEach(m => snapshotMessage(socket.id, chatId, m.id));
    socket.emit("chatHistory", runnerFilteredMessages);

    if (chat.specialInstructions) {
      socket.emit("specialInstructions", {
        chatId,
        specialInstructions: chat.specialInstructions,
      });
    }
  }

  io.to(`user-${userId}`).emit("runnerJoinedChat", {
    userId, runnerId, chatId,
    runnerInRoom: true,
    timestamp: new Date().toISOString(),
  });

  // Wait for order to be created - retry up to 10 times
  let order = null;
  for (let attempt = 0; attempt < 10; attempt++) {
    const foundOrder = await Order.findOne({ chatId }).sort({ createdAt: -1 }).lean();

    if (foundOrder && !['cancelled', 'completed', 'task_completed'].includes(foundOrder.status)) {
      order = foundOrder;
      break;
    }

    await new Promise(res => setTimeout(res, 500));
  }

  if (order) {
    socket.emit('orderCreated', {
      order: { ...cleanForEmit(order), chatId }
    });
    console.log("emit for runner order", order);
  } else {
    console.log(`No order found for chat ${chatId} after 10 attempts`);
  }

  logSocketAudit('RUNNER_JOINED_CHAT', { runnerId, chatId, userId });
};

// ─── Message handlers ─────────────────────────────────────────────────────────

const handleSendMessage = async (socket, io, { chatId, message }) => {
  const startTime = Date.now();
  try {
    // emit immediately 
    socket.to(chatId).emit('message', cleanForEmit(message));

    // Batch DB writes — flush every 2 seconds
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

    // Snapshot immediately
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

  const snapshot = socketMessageSnapshot.get(socket.id);

  const chat = await Chat.findOne({ chatId }).select('messages').lean();
  if (!chat?.messages?.length) {
    console.log('[rejoinChat] no chat found');
    return;
  }

  // Check order payment status — strip payment_request if already paid
  const latestOrder = await Order.findOne({ chatId })
    .sort({ createdAt: -1 })
    .select('paymentStatus status')
    .lean();

  const isPaid = latestOrder?.paymentStatus === 'paid';
  const isTerminal = ['completed', 'cancelled', 'task_completed']
    .includes(latestOrder?.status);

  let cleanMessages = deduplicateMessages(chat.messages);

  // If order is paid, remove payment_request — client doesn't need to show it again
  if (isPaid) {
    cleanMessages = cleanMessages.filter(m =>
      m.type !== 'payment_request' && m.messageType !== 'payment_request'
    );
  }

  const userDoc = await User.findById(userId).lean();

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

// ─── Fetch archived order session (for order history view) ───────────────────
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

// ─── Get archived messages for a completed order session ───────────────────
const handleGetArchivedMessages = async (socket, { chatId, userId, runnerId, orderId }) => {
  try {
    const chat = await Chat.findOne({ chatId }).lean();
    if (!chat) return socket.emit('archivedMessages', { chatId, messages: [] });

    let messages = [];
    let status = null;
    let completedAt = null;

    // If orderId is provided, fetch that specific session
    if (orderId) {
      const session = chat.orderSessions?.find(s => s.orderId === orderId);
      if (session) {
        messages = session.messages;
        status = session.status;
        completedAt = session.completedAt;
      }
    } else {
      // Otherwise fetch the most recent completed session
      const lastSession = [...(chat.orderSessions || [])]
        .reverse()
        .find(s => s.status === 'completed' || s.status === 'task_completed');
      if (lastSession) {
        messages = lastSession.messages;
        status = lastSession.status;
        completedAt = lastSession.completedAt;
      }
    }

    socket.emit('archivedMessages', {
      chatId,
      messages,
      status,
      completedAt,
      orderId: orderId || null
    });

    logSocketAudit('GET_ARCHIVED_MESSAGES', { chatId, userId, runnerId, orderId });
  } catch (err) {
    console.error('handleGetArchivedMessages error:', err);
    socket.emit('archivedMessages', { chatId, messages: [] });
  }
};

const handleDisconnect = async (socket, io) => {
  if (socket.serviceType && runnersByService[socket.serviceType]) {
    runnersByService[socket.serviceType].delete(socket.id);
  }
  // Clean up snapshot on disconnect — will be rebuilt on next join
  socketMessageSnapshot.delete(socket.id);

  const chatId = socket.currentChatId;
  if (!chatId) return;

  const isRunner = !!socket.runnerId;
  const partnerId = isRunner ? socket.userId : socket.runnerId;
  const partnerType = isRunner ? 'user' : 'runner';
  const offlineId = isRunner ? socket.runnerId : socket.userId;
  const offlineType = isRunner ? 'runner' : 'user';

  if (!partnerId) return;
  // tell other partner this partner is offline
  io.to(`${partnerType}-${partnerId}`).emit('partnerOffline', {
    chatId,
    userId: offlineId,
    userType: offlineType,
    timestamp: new Date().toISOString(),
  });

  const offlineMsg = {
    id: `offline-${offlineId}-${Date.now()}`,
    from: 'system',
    type: 'system',
    messageType: 'system',
    text: `${isRunner ? 'Runner' : 'User'} went offline`,
    time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
    senderId: 'system',
    senderType: 'system',
    status: 'sent',
    createdAt: new Date(),
    isPresenceMessage: true, // flag so client can style/dismiss it differently
  };

  io.to(chatId).emit('message', offlineMsg);


  // Push notification (only if there's an active unpaid/active order — no point notifying on completed chats)
  try {
    const activeOrder = await Order.findOne({
      chatId,
      status: { $nin: ['completed', 'cancelled', 'task_completed'] }
    }).lean();

    if (!activeOrder) return;

    const Model = isRunner ? Runner : User;
    const offlinePerson = await Model.findById(offlineId).select('firstName lastName').lean();
    const name = offlinePerson
      ? `${offlinePerson.firstName} ${offlinePerson.lastName || ''}`.trim()
      : isRunner ? 'Your runner' : 'The user';

    await notifyPartnerOffline(partnerId, partnerType, { chatId, name });
  } catch (err) {
    console.error('[handleDisconnect] offline notification failed:', err.message);
  }
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
  handleGetArchivedMessages
};