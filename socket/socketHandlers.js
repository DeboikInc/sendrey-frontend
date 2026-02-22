// socketHandlers.js
const { Chat } = require("../models/Chat");
const ServiceRequest = require("./ServiceRequest");
const Invoice = require("../models/Invoice");
const User = require("../models/User");
const Runner = require("../models/Runner");
const Order = require("../models/Order");
const { logMetric } = require('../utils/metricsLogger');
const { DELIVERY_FEE_PERCENTAGE, BASE_DELIVERY_FEE } = require('../config/pricing');

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

  const rooms = Array.from(socket.rooms);
  console.log(`Runner ${runnerId} socket ${socket.id} is in rooms:`, rooms);

  runnersByService[serviceType].add(socket.id);

  console.log(`Runner ${runnerId} joined room: ${room}`);

  const requests = await ServiceRequest.find({ serviceType, status: "available" });
  socket.emit("existingRequests", requests);
};

const handleAcceptRunnerRequest = async (
  socket,
  io,
  { runnerId, userId, chatId, serviceType }
) => {
  try {
    console.log(` Runner ${runnerId} accepting request for user ${userId}`);

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
    console.log(` Runner entered pre-room: pre-${chatId}`);

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
      console.log(` Waiting for user to enter pre-room`);

      setTimeout(() => {
        const currentState = preRoomState.get(chatId);
        if (currentState && currentState.runner && !currentState.user) {
          console.log(` User didn't enter pre-room, cleaning up`);
          preRoomState.delete(chatId);
          io.to(`pre-${chatId}`).emit("preRoomTimeout", {
            chatId,
            message: "User did not respond in time",
          });
        }
      }, 30000);
    }
  } catch (error) {
    console.error("Error in acceptRunnerRequest:", error);
  }
};

const handleRequestRunner = async (socket, io, data) => {
  const { runnerId, userId, chatId, serviceType, specialInstructions } = data;

  console.log(` User ${userId} requesting runner ${runnerId}`);

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
  console.log(` User entered pre-room: pre-${chatId}`);

  if (state.user && state.runner) {
    await lockAndProceed(io, chatId, state);
  } else {
    console.log(` Waiting for runner to enter pre-room`);

    setTimeout(() => {
      const currentState = preRoomState.get(chatId);
      if (currentState && currentState.user && !currentState.runner) {
        console.log(` Runner didn't enter pre-room, cleaning up`);
        preRoomState.delete(chatId);
        io.to(`pre-${chatId}`).emit("preRoomTimeout", {
          chatId,
          message: "Runner did not respond in time",
        });
      }
    }, 30000);
  }
};

const lockAndProceed = async (io, chatId, state) => {
  const { runnerId, userId } = state;

  await Promise.all([
    Runner.findByIdAndUpdate(runnerId, { isAvailable: false }),
    User.findByIdAndUpdate(userId, { isAvailable: false }),
  ]);

  console.log(` Locked availability for user ${userId} and runner ${runnerId}`);

  await initializeChatAndProceed(io, chatId, state);
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
    const runnerData = await Runner.findById(runnerId).lean();

    if (!runnerData) {
      console.error(`Runner ${runnerId} not found`);
      return;
    }

    // Fetch user to get currentRequest for payment data — same time as runner fetch
    const user = await User.findById(userId).lean();
    const currentRequest = user?.currentRequest;

    let itemBudget = 0;
    let deliveryFee = 0;

    if (serviceType === 'run-errand' || serviceType === 'run_errand') {
      itemBudget = Number(currentRequest?.itemBudget || currentRequest?.budget) || 0;
      deliveryFee = Math.round(itemBudget * DELIVERY_FEE_PERCENTAGE);
    } else {
      deliveryFee = currentRequest?.deliveryFee || BASE_DELIVERY_FEE;
    }

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

    const initialMessages = createInitialRunnerMessages(runnerData, serviceType, runnerId, userId, chatId, paymentData);

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

    console.log(` Chat ${chatId} ready.`);

    io.to(`pre-${chatId}`).emit("proceedToChat", {
      chatId,
      runnerId,
      userId,
      serviceType,
      chatReady: true,
      initialMessages: chat.messages,
      specialInstructions: specialInstructions || null,
    });

    preRoomState.delete(chatId);
  } catch (error) {
    console.error("Error initializing chat:", error);
  }
};

const handleUserJoinChat = async (socket, io, data) => {
  const { userId, runnerId, chatId } = data;
  console.log(" User joining actual chat:", { userId, runnerId, chatId });

  socket.userId = userId;
  socket.runnerId = runnerId;
  socket.join(chatId);

  const chat = await Chat.findOne({ chatId });

  if (chat) {
    const existingOrder = await Order.findOne({ chatId }).sort({ createdAt: -1 }).lean();

    if (existingOrder) {
      if (existingOrder.paymentStatus !== 'paid') {
        // Order exists but unpaid — ensure payment_request is in history
        const alreadyHasPrompt = chat.messages.some(m => m.type === 'payment_request');
        if (!alreadyHasPrompt) {
          const paymentPromptMessage = {
            id: `payment-prompt-${Date.now()}`,
            from: "system",
            type: "payment_request",
            messageType: "payment_request",
            text: "Fund this task to get started",
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
          chat.messages.push(paymentPromptMessage);
          chat.lastActivity = new Date();
          await chat.save();
          console.log(`Added missing payment prompt for unpaid order ${existingOrder.orderId}`);
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

      // Always emit orderCreated so frontend restores currentOrder
      socket.emit("orderCreated", { order: cleanForEmit(existingOrder) });
      console.log(`Existing order ${existingOrder.orderId} sent to user, paymentStatus: ${existingOrder.paymentStatus}`);
    } else {
      // No order yet — calculate and add payment prompt
      const user = await User.findById(userId).lean();
      const currentRequest = user?.currentRequest;
      const { DELIVERY_FEE_PERCENTAGE, BASE_DELIVERY_FEE } = require('../config/pricing');

      let itemBudget = 0;
      let deliveryFee = 0;

      if (currentRequest?.serviceType === 'run_errand' || currentRequest?.serviceType === 'run-errand') {
        itemBudget = Number(currentRequest?.itemBudget || currentRequest?.budget) || 0;
        deliveryFee = Math.round(itemBudget * DELIVERY_FEE_PERCENTAGE);
      } else {
        deliveryFee = currentRequest?.deliveryFee || BASE_DELIVERY_FEE;
      }

      const totalAmount = itemBudget + deliveryFee;
      const serviceType = currentRequest?.serviceType || chat.serviceType;

      const alreadyHasPrompt = chat.messages.some(m => m.type === 'payment_request');
      if (!alreadyHasPrompt) {
        const paymentPromptMessage = {
          id: `payment-prompt-${Date.now()}`,
          from: "system",
          type: "payment_request",
          messageType: "payment_request",
          text: "Fund this task to get started",
          time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }),
          senderId: "system",
          senderType: "system",
          status: "sent",
          paymentData: { serviceType, itemBudget, deliveryFee, totalAmount, currency: "NGN", chatId, userId, runnerId }
        };
        chat.messages.push(paymentPromptMessage);
        chat.lastActivity = new Date();
        await chat.save();
        console.log(`Payment prompt created for chat ${chatId}: itemBudget=${itemBudget} deliveryFee=${deliveryFee} total=${totalAmount}`);
      }
    }

    // Send full history AFTER all mutations — client gets everything including payment prompt
    socket.emit("chatHistory", chat.messages);
    console.log(`Sent chat history (${chat.messages.length} msgs) to user ${userId}`);

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
  console.log(" Runner joining actual chat:", { runnerId, userId, chatId });

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
      console.log(` Sent specialInstructions to runner ${runnerId} on join`);
    }

    console.log(` Sent chat history to runner ${runnerId}`);
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
};

const handleSendMessage = async (io, { chatId, message }) => {
  const startTime = Date.now(); // FIX: was missing, caused ReferenceError

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

    console.log(` Message delivered in ${latency}ms`);
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

const handleSendInvoice = async (
  socket,
  io,
  { invoiceData, chatId, runnerId, userId, marketData }
) => {
  try {
    const invoiceId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    await Invoice.create({
      invoiceId,
      chatId,
      runnerId,
      userId,
      marketData: marketData || {},
      items: invoiceData.items || [],
      subTotal: invoiceData.subTotal || 0,
      grandTotal: invoiceData.grandTotal || 0,
      status: "pending",
    });

    const invoiceMessage = {
      id: Date.now(),
      from: "runner",
      type: "invoice",
      time: new Date().toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }),
      status: "sent",
      senderId: runnerId,
      senderType: "runner",
      invoiceData: {
        invoiceId,
        marketData: marketData || {},
        items: invoiceData.items || [],
        subTotal: invoiceData.subTotal || 0,
        grandTotal: invoiceData.grandTotal || 0,
      },
      invoiceId,
    };

    const chat = await Chat.findOne({ chatId });
    if (chat) {
      chat.messages.push(invoiceMessage);
      await chat.save();
    }

    io.to(chatId).emit(
      "receiveInvoice",
      cleanForEmit({
        message: invoiceMessage,
        invoiceId,
        invoiceData: invoiceMessage.invoiceData,
      })
    );

    console.log(`Invoice ${invoiceId} sent to chat ${chatId}`);
  } catch (error) {
    console.error("Error sending invoice:", error);
    socket.emit("invoiceError", { error: "Failed to send invoice. Please try again." });
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

  console.log(`Emitted receiveTrackRunner to ${chatId}`);
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

    console.log(` Sent specialInstructions for chat ${chatId}`);
  } catch (error) {
    console.error("Error fetching special instructions:", error);
  }
};

const handleDisconnect = (socket) => {
  if (socket.serviceType && runnersByService[socket.serviceType]) {
    runnersByService[socket.serviceType].delete(socket.id);
  }
  console.log("Client disconnected:", socket.id);
};

module.exports = {
  runnersByService,
  handleJoinRunnerRoom,
  handleAcceptRunnerRequest,
  handleSendMessage,
  handleSendInvoice,
  handleStartTrackRunner,
  handleRequestRunner,
  handleUserJoinChat,
  handleRunnerJoinChat,
  handleDisconnect,
  handleDeleteMessage,
  handleGetSpecialInstructions,
};