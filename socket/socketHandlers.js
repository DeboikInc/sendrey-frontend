// socketHandlers.js
const { Chat } = require("../models/Chat");
const ServiceRequest = require("./ServiceRequest");
const Invoice = require("../models/Invoice");
const User = require("../models/User");
const Runner = require("../models/Runner");
const Order = require("../models/Order");
const { logMetric } = require('../utils/metricsLogger');
const { computeDeliveryFeeFromDocs } = require('../config/pricing');
const { canRunnerAcceptErrand, incrementErrandCount } = require('../utils/verificationCheck');
const { logSocketAudit } = require('../utils/socketAudit');

// Global state trackers
const runnersByService = {
  "pick-up": new Set(),
  "run-errand": new Set(),
};

// Pre-room state tracker
const preRoomState = new Map();

const cleanForEmit = (data) => {
  if (data && typeof data === "object") {
    if (data.toObject && typeof data.toObject === "function") {
      return data.toObject();
    }
    if (Array.isArray(data)) {
      return data.map((item) => cleanForEmit(item));
    }
    const result = {};
    for (const key in data) {
      result[key] = cleanForEmit(data[key]);
    }
    return result;
  }
  return data;
};

const createInitialRunnerMessages = (runnerData, serviceType, runnerId) => {
  const fullName =
    `${runnerData?.firstName || ""} ${runnerData?.lastName || ""}`.trim();

  logSocketAudit('INITIAL_RUNNER_MESSAGE', {
    runnerData,
    runnerId,
    serviceType,
  });

  return [
    {
      id: Date.now().toString(),
      from: "system",
      messageType: "system",
      type: "system",
      text: `Runner ${fullName} joined the chat`,
      time: new Date().toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }),
      senderId: runnerId,
      senderType: "runner",
      status: "sent",
    },
    {
      id: (Date.now() + 1).toString(),
      from: "them",
      messageType: "profile-card",
      type: "profile-card",
      time: new Date().toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }),
      senderId: runnerId,
      senderType: "runner",
      status: "sent",
      runnerInfo: {
        firstName: runnerData?.firstName,
        lastName: runnerData?.lastName || "",
        avatar: runnerData?.profilePicture || null,
        rating: runnerData?.rating || null,
        bio: `Hello I am ${fullName} and I will be your captain for this ${serviceType.replace(
          "-",
          " "
        )}. I am dedicated to helping you get your tasks done efficiently and effectively.`,
      },
    },
  ];
};

const handleJoinRunnerRoom = async (socket, { runnerId, serviceType }) => {
  socket.runnerId = runnerId;
  socket.serviceType = serviceType;

  const room = `runners-${serviceType}`;
  socket.join(room);
  socket.join(`runner-${runnerId}`);

  const verificationCheck = await canRunnerAcceptErrand(runnerId);

  socket.emit('verificationStatus', {
    ...verificationCheck,
    timestamp: new Date().toISOString()
  });

  // ALWAYS add to pool — let them see users, just block acceptance if not verified
  runnersByService[serviceType].add(socket.id);

  const requests = await ServiceRequest.find({ serviceType, status: "available" });
  socket.emit("existingRequests", requests);

  logSocketAudit('RUNNER_JOINED_ROOM', { runnerId, serviceType });
};

const handleAcceptRunnerRequest = async (
  socket,
  io,
  { runnerId, userId, chatId, serviceType }
) => {
  try {
    const verificationCheck = await canRunnerAcceptErrand(runnerId);

    if (!verificationCheck.canAccept) {
      socket.emit('error', {
        message: verificationCheck.reason,
        code: 'VERIFICATION_FAILED',
        details: verificationCheck
      });
      socket.emit('verificationStatus', {
        ...verificationCheck,
        timestamp: new Date().toISOString()
      });
      return;
    }

    if (!preRoomState.has(chatId)) {
      preRoomState.set(chatId, {
        user: false,
        runner: false,
        runnerId,
        userId,
        serviceType,
        timestamp: Date.now(),
      });
    }

    const state = preRoomState.get(chatId);
    state.runner = true;
    state.runnerId = runnerId;

    socket.join(`pre-${chatId}`);

    await incrementErrandCount(runnerId);

    io.to(`user-${userId}`).emit("enterPreRoom", {
      chatId,
      runnerId,
      userId,
      serviceType,
      message: "Runner accepted! Preparing chat...",
    });

    if (state.user && state.runner) {
      await lockAndProceed(io, chatId, state);
    } else {
      setTimeout(() => {
        const currentState = preRoomState.get(chatId);
        if (currentState && currentState.runner && !currentState.user) {
          preRoomState.delete(chatId);
          io.to(`pre-${chatId}`).emit("preRoomTimeout", {
            chatId,
            message: "User did not respond in time",
          });
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
    preRoomState.set(chatId, {
      user: false,
      runner: false,
      runnerId,
      userId,
      serviceType,
      timestamp: Date.now(),
    });
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
      const currentState = preRoomState.get(chatId);
      if (currentState && currentState.user && !currentState.runner) {
        preRoomState.delete(chatId);
        io.to(`pre-${chatId}`).emit("preRoomTimeout", {
          chatId,
          message: "Runner did not respond in time",
        });
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
    media: (specialInstructions.media || []).map((m) => ({
      fileName: m.fileName || m.name || null,
      fileType: m.fileType || m.type || null,
      fileSize: m.fileSize || null,
      fileUrl: m.fileUrl || null,
    })),
  };
};

const initializeChatAndProceed = async (io, chatId, state) => {
  const { runnerId, userId, serviceType } = state;
  const specialInstructions = sanitizeSpecialInstructions(state.specialInstructions);

  try {
    // Fetch user in parallel
    const [user, runnerData] = await Promise.all([   // ← fetch both
      User.findById(userId).lean(),
      Runner.findById(runnerId).lean(),
    ]);

    console.log('[pricing debug - initializeChat] serviceType:', serviceType);
    console.log('[pricing debug - initializeChat] userId:', userId);
    console.log('[pricing debug - initializeChat] user found:', !!user);
    console.log('[pricing debug - initializeChat] user.currentRequest:', JSON.stringify(user?.currentRequest, null, 2))

    // ── Delivery fee: DELIVERY_FEE_PER_METER × runner 1km from market/pickup + market distance to dropoff/delivery
    const { deliveryFee } = computeDeliveryFeeFromDocs(serviceType, user);
    console.log('user.currentRequest:', user?.currentRequest);


    // Item budget only applies to run-errand
    const isErrand = serviceType === 'run-errand';
    const itemBudget = isErrand
      ? Number(user?.currentRequest?.itemBudget || user?.currentRequest?.budget) || 0
      : 0;

    const paymentData = {
      serviceType,
      itemBudget,
      deliveryFee,
      totalAmount: itemBudget + deliveryFee,
      currency: "NGN",
      chatId,
      userId,
      runnerId,
    };

    const initialMessages = createInitialRunnerMessages(runnerData, serviceType, runnerId);

    const chat = await Chat.findOneAndUpdate(
      { chatId },
      {
        $setOnInsert: {
          chatId,
          messages: initialMessages,
          userId,
          runnerId,
          serviceType,
          createdBy: "system",
          createdAt: new Date(),
          specialInstructions: specialInstructions || null,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    io.to(`pre-${chatId}`).emit("proceedToChat", {
      chatId,
      runnerId,
      userId,
      serviceType,
      chatReady: true,
      initialMessages: chat.messages,
      specialInstructions: specialInstructions || null,
      // paymentData
    });

    preRoomState.delete(chatId);

    logSocketAudit('PROCEED_TO_CHATROOM', { runnerId, userId, serviceType });
  } catch (error) {
    console.error("Error initializing chat:", error);
  }
};

const handleUserJoinChat = async (socket, io, data) => {
  const { userId, runnerId, chatId } = data;

  socket.userId = userId;
  socket.runnerId = runnerId;
  socket.join(chatId);
  socket.join(`user-${userId}`);

  const chat = await Chat.findOne({ chatId });

  if (chat) {
    const existingOrder = await Order.findOne({ chatId }).sort({ createdAt: -1 }).lean();

    if (existingOrder) {
      if (existingOrder.paymentStatus !== 'paid') {
        const alreadyHasPrompt = chat.messages.some(m => m.type === 'payment_request');
        if (!alreadyHasPrompt) {
          const paymentPromptMessage = {
            id: `payment-prompt-${Date.now()}`,
            from: "system",
            type: "payment_request",
            messageType: "payment_request",
            time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }),
            senderId: "system",
            senderType: "system",
            status: "sent",
            paymentData: {
              serviceType: existingOrder.serviceType,
              itemBudget: existingOrder.itemBudget || 0,
              deliveryFee: existingOrder.deliveryFee || 0,
              totalAmount: existingOrder.totalAmount || 0,
              currency: "NGN",
              chatId,
              userId,
              runnerId,
            }
          };
          await Chat.findOneAndUpdate(
            { chatId, 'messages.type': { $ne: 'payment_request' } },
            { $push: { messages: paymentPromptMessage }, $set: { lastActivity: new Date() } }
          );
        }
      }

      // Stamp orderId onto any task_completed message so frontend can check rating
      const taskCompletedIdx = chat.messages.findIndex(m =>
        m.type === 'task_completed' || m.messageType === 'task_completed' ||
        (m.type === 'system' && m.text?.toLowerCase().includes('task completed'))
      );
      if (taskCompletedIdx !== -1 && !chat.messages[taskCompletedIdx].orderId) {
        chat.messages[taskCompletedIdx].orderId = existingOrder.orderId;
        await chat.save();
      }

      socket.emit("orderCreated", { order: cleanForEmit(existingOrder) });
    } else {
      // No order yet — compute delivery fee from current runner + user locations
      const [runner, user] = await Promise.all([
        Runner.findById(runnerId).lean(),
        User.findById(userId).lean(),
      ]);

      const serviceType = user?.currentRequest?.serviceType || chat.serviceType;

      console.log('[pricing debug] userId used for fetch:', userId);
      console.log('[pricing debug] user found:', !!user);
      console.log('[pricing debug] serviceType:', serviceType);
      console.log('[pricing debug] user.currentRequest:', JSON.stringify(user?.currentRequest, null, 2));

      const { deliveryFee } = computeDeliveryFeeFromDocs(serviceType, user);

      const isErrand = serviceType === 'run-errand' || serviceType === 'run_errand';
      const itemBudget = isErrand
        ? Number(user?.currentRequest?.itemBudget || user?.currentRequest?.budget) || 0
        : 0;

      const totalAmount = itemBudget + deliveryFee;

      const alreadyHasPrompt = chat.messages.some(m => m.type === 'payment_request');
      if (!alreadyHasPrompt) {
        const paymentPromptMessage = {
          id: `payment-prompt-${Date.now()}`,
          from: "system",
          type: "payment_request",
          messageType: "payment_request",
          time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }),
          senderId: "system",
          senderType: "system",
          status: "sent",
          paymentData: { serviceType, itemBudget, deliveryFee, totalAmount, currency: "NGN", chatId, userId, runnerId }
        };
        await Chat.findOneAndUpdate(
          { chatId, 'messages.type': { $ne: 'payment_request' } },
          { $push: { messages: paymentPromptMessage }, $set: { lastActivity: new Date() } }
        );
      }
    }

    logSocketAudit('USER_JOINED_CHAT', { userId, runnerId, chatId });

    // Send full history AFTER all mutations
    const freshChat = await Chat.findOne({ chatId });
    socket.emit("chatHistory", freshChat.messages);
  } else {
    socket.emit("chatHistory", []);
  }

  io.to(`runner-${runnerId}`).emit("userJoinedChat", {
    userId,
    runnerId,
    chatId,
    userInRoom: true,
    timestamp: new Date().toISOString(),
  });
};

const handleRunnerJoinChat = async (socket, io, data) => {
  const { runnerId, userId, chatId } = data;

  socket.runnerId = runnerId;
  socket.userId = userId;
  socket.currentChatId = chatId;
  socket.join(chatId);
  socket.join(`runner-${runnerId}`);

  const chat = await Chat.findOne({ chatId });

  if (chat) {
    socket.emit("chatHistory", chat.messages);

    if (chat.specialInstructions) {
      socket.emit("specialInstructions", {
        chatId,
        specialInstructions: chat.specialInstructions,
      });
    }
  } else {
    socket.emit("chatHistory", []);
  }

  io.to(`user-${userId}`).emit("runnerJoinedChat", {
    userId,
    runnerId,
    chatId,
    runnerInRoom: true,
    timestamp: new Date().toISOString(),
  });

  logSocketAudit('RUNNER_JOINED_CHAT', { runnerId, chatId, userId });
};

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

    io.to(chatId).emit("message", cleanForEmit(message));

    const latency = Date.now() - startTime;
    await logMetric({
      type: 'message',
      status: 'success',
      latency,
      chatId,
      userId: message.senderId,
      userType: message.senderType,
      metadata: { messageType: message.type }
    });
  } catch (error) {
    console.error("Error sending message:", error);

    const latency = Date.now() - startTime;
    await logMetric({
      type: 'message',
      status: 'failed',
      latency,
      chatId,
      userId: message?.senderId,
      userType: message?.senderType,
      error: error.message
    });

    io.to(chatId).emit("message", cleanForEmit(message));
  }
};

const handleStartTrackRunner = (io, data) => {
  if (!data?.chatId || !data?.runnerId) {
    console.error("Missing chatId or runnerId in startTrackRunner payload");
    return;
  }

  const { chatId, runnerId, userId } = data;

  io.to(chatId).emit(
    "receiveTrackRunner",
    cleanForEmit({
      chatId,
      runnerId,
      userId,
      status: "on_way_to_delivery",
      trackingData: { lat: null, lng: null, eta: null },
      timestamp: new Date().toISOString(),
    })
  );

  logSocketAudit('TRACK_RUNNER', { chatId, runnerId, userId });
};

const handleDeleteMessage = async (
  socket,
  io,
  { chatId, messageId, userId, deleteForEveryone = true }
) => {
  try {
    const chat = await Chat.findOne({ chatId });
    if (!chat) return;

    if (deleteForEveryone) {
      const idx = chat.messages.findIndex((m) => m.id === messageId);
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

        io.to(chatId).emit("messageDeleted", {
          messageId,
          deletedBy: userId,
          deleteForEveryone: true,
        });
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
    socket.emit("specialInstructions", {
      chatId,
      specialInstructions: chat?.specialInstructions || null,
    });
  } catch (error) {
    console.error("Error fetching special instructions:", error);
  }
};

const handleRejoinChat = async (socket, io, { chatId, userId, runnerId, userType }) => {
  if (!chatId) {
    console.log('[rejoinChat] no chatId, skipping');
    return;
  }

  console.log('[rejoinChat]', userType, 'rejoining room:', chatId);
  socket.join(chatId);

  if (userType === 'runner' && runnerId) {
    socket.join(`runner-${runnerId}`);
  } else if (userType === 'user' && userId) {
    socket.join(`user-${userId}`);
  }

  const room = io.sockets.adapter.rooms.get(chatId);
  console.log('[rejoinChat] room size after join:', room?.size, 'sockets:', Array.from(room || []));
};

const handleDisconnect = (socket) => {
  if (socket.serviceType && runnersByService[socket.serviceType]) {
    runnersByService[socket.serviceType].delete(socket.id);
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
};