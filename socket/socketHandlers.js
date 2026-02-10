// socketHandlers.js
const { Chat } = require("../models/Chat");
const ServiceRequest = require("./ServiceRequest");
const Invoice = require("./Invoice");
const User = require("../models/User")
const Runner = require("../models/Runner");;
const StatusEngine = require('../services/statusEngine');
const MediaService = require('../services/mediaService');

// Global state trackers
const runnersByService = {
  "pick-up": new Set(),
  "run-errand": new Set(),
};
const chatRoomMembers = new Map();

// Pre-room state tracker
const preRoomState = new Map(); // { chatId: { user: boolean, runner: boolean, runnerId, userId } }

const cleanForEmit = (data) => {
  if (data && typeof data === 'object') {
    if (data.toObject && typeof data.toObject === 'function') {
      return data.toObject();
    }
    if (Array.isArray(data)) {
      return data.map(item => cleanForEmit(item));
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
  const fullName = `${runnerData?.firstName || ''} ${runnerData?.lastName || ''}`.trim();

  return [
    {
      id: Date.now().toString(),
      from: 'system',
      messageType: 'system',
      type: 'system',
      text: `Runner ${fullName} joined the chat`,
      time: new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }),
      senderId: runnerId,
      senderType: "runner",
      status: 'sent'
    },
    {
      id: (Date.now() + 1).toString(),
      from: 'them',
      messageType: 'profile-card',
      type: 'profile-card',
      time: new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }),
      senderId: runnerId,
      senderType: "runner",
      status: 'sent',
      runnerInfo: {
        firstName: runnerData?.firstName,
        lastName: runnerData?.lastName || '',
        avatar: runnerData?.profilePicture || 'https://via.placeholder.com/128',
        rating: runnerData?.rating || 4,
        bio: `Hello I am ${fullName} and I will be your captain for this ${serviceType.replace('-', ' ')}. I am dedicated to helping you get your tasks done efficiently and effectively.`
      }
    }
  ];
};

// Handler functions
const handleJoinRunnerRoom = async (socket, { runnerId, serviceType }) => {
  socket.runnerId = runnerId;
  socket.serviceType = serviceType;

  const room = `runners-${serviceType}`;
  socket.join(room);
  runnersByService[serviceType].add(socket.id);

  console.log(`Runner ${runnerId} joined room: ${room}`);

  const requests = await ServiceRequest.find({ serviceType, status: "available" });
  socket.emit("existingRequests", requests);
};

// Handle runner entering pre-room
const handleAcceptRunnerRequest = async (socket, io, { runnerId, userId, chatId, serviceType }) => {
  try {
    console.log(`🏃 Runner ${runnerId} accepting request for user ${userId}`);

    // Initialize pre-room state if not exists
    if (!preRoomState.has(chatId)) {
      preRoomState.set(chatId, {
        user: false,
        runner: false,
        runnerId,
        userId,
        serviceType,
        timestamp: Date.now()
      });
    }

    const state = preRoomState.get(chatId);
    state.runner = true;
    state.runnerId = runnerId;

    // Runner joins pre-room
    const preRoom = `pre-${chatId}`;
    socket.join(preRoom);

    console.log(`🏃 Runner entered pre-room: ${preRoom}`);

    // Notify user to enter pre-room
    const userRoom = `user-${userId}`;
    io.to(userRoom).emit("enterPreRoom", {
      chatId,
      runnerId,
      userId,
      serviceType,
      message: "Runner accepted! Preparing chat..."
    });

    // Check if both are now in pre-room
    if (state.user && state.runner) {
      console.log(` Both user and runner in pre-room ${preRoom} - Creating chat...`);

      await Promise.all([
        Runner.findByIdAndUpdate(runnerId, { isAvailable: false }),
        User.findByIdAndUpdate(userId, { isAvailable: false })
      ]);
      console.log(`🔒 Locked availability for BOTH user ${userId} and runner ${runnerId}`);

      await initializeChatAndProceed(io, chatId, state);
    } else {
      console.log(` Waiting for user to enter pre-room ${preRoom}`);


      // ✅ Set timeout - if user doesn't show up, remove runner from pre-room
      setTimeout(async () => {
        const currentState = preRoomState.get(chatId);

        // If still waiting for user after 30 seconds
        if (currentState && currentState.runner && !currentState.user) {
          console.log(` User didn't enter pre-room, cleaning up for runner ${runnerId}`);
          preRoomState.delete(chatId);

          // Notify runner that user didn't respond
          io.to(preRoom).emit("preRoomTimeout", {
            chatId,
            message: "User did not respond in time"
          });
        }
      }, 30000);
    }

  } catch (error) {
    console.error("Error in acceptRunnerRequest:", error);
  }
};

// Handle user entering pre-room
const handleRequestRunner = async (socket, io, data) => {
  const { runnerId, userId, chatId, serviceType } = data;

  console.log(` User ${userId} requesting runner ${runnerId}`);

  // User joins their personal room
  const userRoom = `user-${userId}`;
  socket.join(userRoom);
  console.log(`👤 User ${userId} joined room: ${userRoom}`);

  // Initialize pre-room state if not exists
  if (!preRoomState.has(chatId)) {
    preRoomState.set(chatId, {
      user: false,
      runner: false,
      runnerId,
      userId,
      serviceType,
      timestamp: Date.now()
    });
  }

  const state = preRoomState.get(chatId);
  state.user = true;
  state.userId = userId;

  // User joins pre-room
  const preRoom = `pre-${chatId}`;
  socket.join(preRoom);

  console.log(`👤 User entered pre-room: ${preRoom}`);

  // Notify runner about the request
  const runnerRoom = `runner-${runnerId}`;
  const runnerIsOnline = io.sockets.adapter.rooms.has(runnerRoom);

  if (runnerIsOnline) {
    io.to(runnerRoom).emit("runnerRequested", {
      runnerId,
      userId,
      chatId,
      serviceType,
      userData: { _id: userId, serviceType }
    });
  }

  // Check if both are now in pre-room
  if (state.user && state.runner) {
    console.log(` Both user and runner in pre-room ${preRoom} - Creating chat...`);

    await Promise.all([
      Runner.findByIdAndUpdate(runnerId, { isAvailable: false }),
      User.findByIdAndUpdate(userId, { isAvailable: false })
    ]);
    console.log(`🔒 Locked availability for BOTH user ${userId} and runner ${runnerId}`);

    await initializeChatAndProceed(io, chatId, state);
  } else {
    console.log(`Waiting for runner to enter pre-room ${preRoom}`);

    setTimeout(async () => {
      const currentState = preRoomState.get(chatId);

      // If still waiting for runner after 30 seconds
      if (currentState && currentState.user && !currentState.runner) {
        console.log(`⏰ Runner didn't enter pre-room, cleaning up for user ${userId}`);
        preRoomState.delete(chatId);

        // Notify user that runner didn't respond
        io.to(preRoom).emit("preRoomTimeout", {
          chatId,
          message: "Runner did not respond in time"
        });
      }
    }, 30000);
  }
};

// Initialize chat and notify both parties to proceed
const initializeChatAndProceed = async (io, chatId, state) => {
  const { runnerId, userId, serviceType } = state;

  try {
    // Fetch runner data for initial messages
    const runnerData = await Runner.findById(runnerId).lean();
    if (!runnerData) {
      console.error(`Runner ${runnerId} not found`);
      return;
    }

    const initialMessages = createInitialRunnerMessages(runnerData, serviceType, runnerId);

    // Create the chat atomically
    const chat = await Chat.findOneAndUpdate(
      { chatId },
      {
        $setOnInsert: {
          chatId,
          messages: initialMessages,
          userId,
          runnerId,
          serviceType,
          createdBy: 'system',
          createdAt: new Date()
        }
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true
      }
    );

    await chat.save();

    console.log(`💬 Chat ${chatId} created successfully`);

    // Broadcast to pre-room - tell both to proceed to chat
    const preRoom = `pre-${chatId}`;
    io.to(preRoom).emit("proceedToChat", {
      chatId,
      runnerId,
      userId,
      serviceType,
      chatReady: true,
      initialMessages: chat.messages
    });

    console.log(`📢 Broadcast proceedToChat to pre-room ${preRoom}`);

    // Clean up pre-room state
    preRoomState.delete(chatId);

  } catch (error) {
    console.error("Error initializing chat:", error);
  }
};

// user/runner joining actual chat (after pre-room)
const handleUserJoinChat = async (socket, io, data) => {
  const { userId, runnerId, chatId, serviceType } = data;
  console.log("👤 User joining actual chat:", { userId, runnerId, chatId });

  socket.runnerId = runnerId;
  socket.userId = userId;

  // User joins the actual chat room
  socket.join(chatId);

  // Fetch and send chat history
  const chat = await Chat.findOne({ chatId });

  if (chat) {
    socket.emit("chatHistory", chat.messages);
    console.log(`📜 Sent chat history to user ${userId}`);
  } else {
    console.log(`⚠️ Chat ${chatId} not found when user joined`);
    socket.emit("chatHistory", []);
  }

  // Notify runner that user has joined
  const runnerRoom = `runner-${runnerId}`;
  io.to(runnerRoom).emit("userJoinedChat", {
    userId,
    runnerId,
    chatId,
    userInRoom: true,
    timestamp: new Date().toISOString()
  });

  console.log(`User ${userId} joined chat: ${chatId}`);
};

// Handle runner joining actual chat (after pre-room)
const handleRunnerJoinChat = async (socket, io, data) => {
  const { runnerId, userId, chatId, serviceType } = data;
  console.log("🏃 Runner joining actual chat:", { runnerId, userId, chatId });

  socket.runnerId = runnerId;
  socket.userId = userId;

  // Runner joins the actual chat room
  socket.join(chatId);

  // Fetch and send chat history
  const chat = await Chat.findOne({ chatId });

  if (chat) {
    socket.emit("chatHistory", chat.messages);
    console.log(`📜 Sent chat history to runner ${runnerId}`);
  } else {
    console.log(`⚠️ Chat ${chatId} not found when runner joined`);
    socket.emit("chatHistory", []);
  }

  // Notify user that runner has joined
  const userRoom = `user-${userId}`;
  io.to(userRoom).emit("runnerJoinedChat", {
    userId,
    runnerId,
    chatId,
    runnerInRoom: true,
    timestamp: new Date().toISOString()
  });

  console.log(`Runner ${runnerId} joined chat: ${chatId}`);
};

const handleSendMessage = async (io, { chatId, message }) => {
  console.log(`Received message for chat ${chatId}:`, message);

  try {
    const chat = await Chat.findOne({ chatId })

    if (!chat) {
      console.log(`Chat ${chatId} not found, creating new one`);
      const newChat = await Chat.create({ chatId, messages: [] });
      newChat.messages.push(message);
      await newChat.save();
    } else {
      chat.messages.push(message);
      await chat.save();
    }

    console.log(`Emitting message to room ${chatId}`);
    io.to(chatId).emit("message", cleanForEmit(message));
  } catch (error) {
    console.error("Error sending message:", error);
    io.to(chatId).emit("message", cleanForEmit(message));
  }
};

const handleSendInvoice = async (socket, io, { invoiceData, chatId, runnerId, userId, marketData }) => {
  console.log(`Runner ${runnerId} sending invoice to user ${userId}`);

  try {
    const invoiceId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const newInvoice = await Invoice.create({
      invoiceId,
      chatId,
      runnerId,
      userId,
      marketData: marketData || {},
      items: invoiceData.items || [],
      subTotal: invoiceData.subTotal || 0,
      grandTotal: invoiceData.grandTotal || 0,
      status: "pending"
    });

    console.log(`Invoice ${invoiceId} created successfully`);

    const invoiceMessage = {
      id: Date.now(),
      from: "runner",
      type: "invoice",
      time: new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }),
      status: "sent",
      senderId: runnerId,
      senderType: "runner",
      invoiceData: {
        invoiceId,
        marketData: marketData || {},
        items: invoiceData.items || [],
        subTotal: invoiceData.subTotal || 0,
        grandTotal: invoiceData.grandTotal || 0
      },
      invoiceId
    };

    const chat = await Chat.findOne({ chatId });
    if (chat) {
      chat.messages.push(invoiceMessage);
      await chat.save();
    }

    io.to(chatId).emit("receiveInvoice", cleanForEmit({
      message: invoiceMessage,
      invoiceId,
      invoiceData: invoiceMessage.invoiceData
    }));

    console.log(`Invoice ${invoiceId} sent to chat ${chatId}`);
  } catch (error) {
    console.error("Error sending invoice:", error);
    socket.emit("invoiceError", {
      error: "Failed to send invoice. Please try again."
    });
  }
};

const handleStartTrackRunner = (io, data) => {
  console.log("SERVER RECEIVED startTrackRunner:", data);

  if (!data) {
    console.error("SERVER ERROR: No data received");
    return;
  }

  const { chatId, runnerId, userId } = data;

  if (!chatId || !runnerId) {
    console.error("SERVER ERROR: Missing chatId or runnerId in payload!", data);
    return;
  }

  const clients = io.sockets.adapter.rooms.get(chatId);
  console.log(`Users in room ${chatId}:`, clients ? Array.from(clients) : "Empty");

  const trackingPayload = {
    chatId,
    runnerId,
    userId,
    status: "on_way_to_delivery",
    trackingData: {
      lat: null,
      lng: null,
      eta: null
    },
    timestamp: new Date().toISOString()
  };

  io.to(chatId).emit("receiveTrackRunner", cleanForEmit(trackingPayload));
  console.log(`Emitted receiveTrackRunner to ${chatId}`);
};

const handleDeleteMessage = async (socket, io, { chatId, messageId, userId, deleteForEveryone = true }) => {
  try {
    const chat = await Chat.findOne({ chatId });

    if (!chat) {
      console.log(`Chat ${chatId} not found`);
      return;
    }

    if (deleteForEveryone) {
      const messageIndex = chat.messages.findIndex(m => m.id === messageId);

      if (messageIndex !== -1) {
        chat.messages[messageIndex] = {
          ...chat.messages[messageIndex],
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
          deleteForEveryone: true
        });

        console.log(`Message ${messageId} deleted for everyone in chat ${chatId}`);
      }
    } else {
      socket.emit("messageDeletedForMe", {
        messageId,
        chatId
      });

      console.log(`Message ${messageId} deleted for user ${userId} only`);
    }
  } catch (error) {
    console.error("Error deleting message:", error);
  }
};

const handleDisconnect = (socket) => {
  if (socket.serviceType && runnersByService[socket.serviceType]) {
    runnersByService[socket.serviceType].delete(socket.id);
  }

  chatRoomMembers.forEach((members, chatId) => {
    if (members.has(socket.userId) || members.has(socket.runnerId)) {
      members.delete(socket.userId);
      members.delete(socket.runnerId);

      if (members.size === 0) {
        chatRoomMembers.delete(chatId);
      }
    }
  });
  console.log("Client disconnected and cleaned from memory:", socket.id);
};

module.exports = {
  runnersByService,
  chatRoomMembers,
  handleJoinRunnerRoom,
  handleAcceptRunnerRequest,
  handleSendMessage,
  handleSendInvoice,
  handleStartTrackRunner,
  handleRequestRunner,
  handleUserJoinChat,
  handleRunnerJoinChat,
  handleDisconnect,
  handleDeleteMessage
};