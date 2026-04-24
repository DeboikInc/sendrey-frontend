const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();
const redis = require('./config/redis');

const { database } = require("./config/index");
const app = express();

// handlers
const socketHandlers = require("./socket/socketHandlers");
const chatStatusHandlers = require('./socket/chatStatusHandlers');
const fileUploadHandlers = require('./socket/fileUploadHandlers');
const notificationHandlers = require('./socket/notificationHandlers');
const { handleRunnerAccept } = require('./socket/orderHandlers');
const { handleSubmitItems,
  handleApproveItems,
  handleRejectItems,
  handleSubmitPickupItem,
  handleApprovePickupItem,
  handleRejectPickupItem } = require("./socket/itemHandlers");
const { handleMarkDeliveryComplete, handleConfirmDelivery, handleDenyDelivery } = require('./socket/deliveryHandlers');
const { handleRaiseDispute, handleResolveDispute } = require('./socket/disputeHandlers');
const { handleSubmitRating } = require('./socket/ratingHandlers');
const callHandlers = require("./socket/callHandlers");
const { handlePaymentSuccess } = require('./socket/paymentHandlers');
const { handleGetRunnerPayout, handleSubmitPayoutReceipt } = require('./socket/payoutHandlers');
const { registerTrackingHandlers } = require('./socket/trackingHandlers');
const { handleCancelOrder, handleTaskCompleted, handleRunnerStartedNewOrder } = require('./socket/cancelHandlers');
const { handleGetOrderByChatId } = require('./socket/orderByChatIdHandlers');
const { registerPresenceHandlers, handleUserDisconnect } = require('./socket/presenceHandlers');

// Import models
const { Chat } = require("./models/Chat");
const ServiceRequest = require("./socket/ServiceRequest");
const Invoice = require("./models/Invoice");
const User = require('./models/User');

const { startScheduler } = require('./services/scheduleService');

require('events').EventEmitter.defaultMaxListeners = 20;

let ioInstance;

async function connectWithRetry(maxAttempts = 5) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await mongoose.connect(database.url, database.options);
      return;
    } catch (err) {
      const delay = Math.min(1000 * 2 ** attempt, 30000);
      console.error(`MongoDB attempt ${attempt}/${maxAttempts} failed. Retrying in ${delay}ms...`);
      if (attempt === maxAttempts) { console.error("MongoDB connection failed permanently."); process.exit(1); }
      await new Promise(r => setTimeout(r, delay));
    }
  }
}


// MongoDB connection
connectWithRetry().then(async () => {

  // if (process.env.NODE_ENV === 'production') {
  //   console.log = () => { };
  //   console.error = () => { };
  //   console.warn = () => { };
  //   console.debug = () => { };
  // }

  console.log("MongoDB connected");

  const app = express();
  const server = http.createServer(app);

  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      credentials: true
    },
    transports: ['websocket', 'polling'],
    allowEIO3: true,
    pingTimeout: 60000,
    pingInterval: 25000,
    maxHttpBufferSize: 5e6,

    perMessageDeflate: {
      threshold: 512,              // compress anything over 512 bytes
      zlibDeflateOptions: { level: 6 },
      zlibInflateOptions: { chunkSize: 16 * 1024 },
    },

    connectTimeout: 45000,
    allowUpgrades: true,
    cookie: false,
    upgradeTimeout: 10000,
    destroyUpgrade: true,

    // Buffer messages during reconnect
    httpCompression: true,
  });

  ioInstance = io;

  app.use(cors());
  app.use(express.json());
  app.set('io', io);
  startScheduler(io);

  // Add connection middleware for logging
  io.use((socket, next) => {
    console.log(`Connection attempt from ${socket.id} with transport: ${socket.conn.transport.name}`);
    next();
  });

  try {
    await redis.connect();
    console.log('✅ Redis connected (socket server)');
  } catch (err) {
    console.error('Redis unavailable in socket server:', err.message);
  }

  io.on("connection", (socket) => {
    console.log("✅ New client connected:", socket.id, "Transport:", socket.conn.transport.name);

    // Send immediate acknowledgment
    socket.emit("connected", { id: socket.id, timestamp: Date.now() });

    // Set up heartbeat
    const heartbeatInterval = setInterval(() => {
      if (socket.connected) {
        socket.emit("ping");
      }
    }, 15000);

    socket.on("pong", () => {
      console.log(`Heartbeat from ${socket.id}`);
    });

    // Wrap all handlers in try-catch to prevent crashes
    const safeHandler = async (handler, ...args) => {
      try {
        return await handler(...args);
      } catch (error) {
        console.error(`Error in handler for ${socket.id}:`, error);
        socket.emit("error", { message: "Internal server error", detail: error.message });
        return null; // null = failure signal
      }
    };

    // online/offline handlers
    registerPresenceHandlers(socket, io, safeHandler)

    // rejoin chat
    socket.on("rejoinChat", (data) =>
      safeHandler(socketHandlers.handleRejoinChat, socket, io, data)

    );

    socket.on('getOrderSession', (data) =>
      safeHandler(socketHandlers.handleGetOrderSession, socket, data)
    );

    // Runner events
    socket.on("joinRunnerRoom", (data) =>
      safeHandler(socketHandlers.handleJoinRunnerRoom, socket, data)
    );

    socket.on("getArchivedMessages", (data) =>
      safeHandler(socketHandlers.handleGetArchivedMessages, socket, data)
    );

    socket.on("acceptRunnerRequest", async (data) => {
      const { chatId } = data;
      if (socket._acceptingChat === chatId) return; // dedup guard
      socket._acceptingChat = chatId;

      try {
        const result = await safeHandler(socketHandlers.handleAcceptRunnerRequest, socket, io, data);
        if (result === null) {
          socket._acceptingChat = null;
          return;
        }
        await handleRunnerAccept(io, socket, data);
      } finally {
        setTimeout(() => { socket._acceptingChat = null; }, 5000);
      }
    });

    // user 
    socket.on("requestRunner", (data) =>
      safeHandler(socketHandlers.handleRequestRunner, socket, io, data)
    );

    socket.on("userJoinChat", async (data) => {
      const result = await safeHandler(socketHandlers.handleUserJoinChat, socket, io, data);
      if (result === null) {
        socket.emit("chatError", {
          message: "Failed to join chat. Please try again.",
          code: "JOIN_FAILED"
        });
      }
    });

    socket.on("runnerJoinChat", async (data) => {
      const result = await safeHandler(socketHandlers.handleRunnerJoinChat, socket, io, data);
      if (result === null) {
        socket.emit("chatError", {
          message: "Failed to join chat. Please try again.",
          code: "JOIN_FAILED"
        });
        return; // don't attempt to join room if handler blew up
      }
      setTimeout(() => {
        const rooms = Array.from(socket.rooms);
        console.log('Runner socket rooms after join:', rooms);
      }, 500);
    });

    // Chat events
    socket.on("sendMessage", async (data) => {
      try {
        await socketHandlers.handleSendMessage(socket, io, data);

        const { chatId, message } = data;
        if (chatId && message?.senderId && message?.senderType) {
          await notificationHandlers.sendMessageNotification(
            chatId,
            message,
            message.senderId,
            message.senderType
          );
        }
      } catch (error) {
        console.error('SendMessage error:', error);
        socket.emit("error", { message: "Failed to send message" });
      }
    });

    // Status update event
    socket.on("updateStatus", async (data) => {
      try {
        const room = io.sockets.adapter.rooms.get(data.chatId);
        console.log(`Room ${data.chatId} has ${room?.size || 0} sockets:`, Array.from(room || []));
        await chatStatusHandlers.handleUpdateStatus(socket, io, data);
        await notificationHandlers.sendStatusUpdateNotification(
          data.chatId,
          data.status,
          data.updatedBy,
          data.updatedByType
        );
      } catch (error) {
        console.error('UpdateStatus error:', error);
        socket.emit("error", { message: "Failed to update status" });
      }
    });

    // Media message event
    socket.on("sendMedia", (data) =>
      safeHandler(chatStatusHandlers.handleSendMedia, socket, io, data)
    );

    // LEGACY: joinChat
    socket.on("joinChat", async (data) => {
      try {
        const { chatId, taskId, serviceType } = data;
        console.log('joinChat (legacy/readonly) received:', { chatId, taskId, serviceType });
        socket.join(chatId);
        const chat = await Chat.findOne({ chatId });
        setTimeout(() => {
          socket.emit("chatHistory", chat ? chat.messages : []);
        }, 100);
      } catch (error) {
        console.error('JoinChat error:', error);
        socket.emit("error", { message: "Failed to join chat" });
      }
    });

    socket.on("uploadFile", (data) =>
      safeHandler(fileUploadHandlers.handleFileUpload, socket, io, data)
    );

    socket.on("deleteMessage", (data) =>
      safeHandler(socketHandlers.handleDeleteMessage, socket, io, data)
    );

    // Tracking event
    socket.on("startTrackRunner", (data) =>
      safeHandler(socketHandlers.handleStartTrackRunner, io, data)
    );

    // call
    socket.on('rejoinUserRoom', ({ userId, userType }) => {
      try {
        const room = userType === 'runner' ? `runner-${userId}` : `user-${userId}`;
        socket.join(room);
        const roomSockets = io.sockets.adapter.rooms.get(room);
        console.log(` ${userType || 'User'} ${userId} re-joined personal room: ${room}`);
        console.log(`Room ${room} now has ${roomSockets?.size || 0} sockets:`, Array.from(roomSockets || []));
      } catch (error) {
        console.error('RejoinUserRoom error:', error);
      }
    });

    callHandlers.register(socket, io);

    // typing indicator
    socket.on('typing', ({ chatId, userId, userType, isTyping }) => {
      try {
        console.log(`${userType} ${userId} ${isTyping ? 'started' : 'stopped'} typing in ${chatId}`);
        socket.to(chatId).emit('userTyping', {
          userId,
          userType,
          isTyping,
          timestamp: new Date(),
        });
      } catch (error) {
        console.error('Typing error:', error);
      }
    });

    // recording
    socket.on('recording', ({ chatId, userId, userType, isRecording }) => {
      try {
        console.log(`${userType} ${userId} ${isRecording ? 'started' : 'stopped'} recording in ${chatId}`);
        socket.to(chatId).emit('userRecording', {
          userId,
          userType,
          isRecording,
          timestamp: new Date(),
        });
      } catch (error) {
        console.error('Recording error:', error);
      }
    });

    socket.on("getOrderByChatId", (data) => {
      safeHandler(handleGetOrderByChatId, socket, data)
    });

    // items
    socket.on("submitItems", (data) => safeHandler(handleSubmitItems, socket, io, data));
    socket.on("approveItems", (data) => safeHandler(handleApproveItems, socket, io, data));
    socket.on("rejectItems", (data) => safeHandler(handleRejectItems, socket, io, data));

    socket.on("submitPickupItem", (data) => safeHandler(handleSubmitPickupItem, socket, io, data));
    socket.on("approvePickupItem", (data) => safeHandler(handleApprovePickupItem, socket, io, data));
    socket.on("rejectPickupItem", (data) => safeHandler(handleRejectPickupItem, socket, io, data));

    // delivery handlers
    socket.on('markDeliveryComplete', (data) => safeHandler(handleMarkDeliveryComplete, io, socket, data));
    socket.on('confirmDelivery', (data) => safeHandler(handleConfirmDelivery, io, socket, data));
    socket.on('denyDelivery', (data) => safeHandler(handleDenyDelivery, io, socket, data));

    // dispute handlers
    socket.on('raiseDispute', (data) => safeHandler(handleRaiseDispute, socket, io, data));
    socket.on('resolveDispute', (data) => safeHandler(handleResolveDispute, socket, io, data));

    socket.on('submitRating', (data) => safeHandler(handleSubmitRating, socket, io, data));

    // mock
    // socket.on('mockPayment', async ({ chatId, orderId }) => {
    //   try {
    //     console.log('Mock payment received | chatId:', chatId, '| orderId:', orderId);
    //     const Order = require('./models/Order');
    //     let order = null;
    //     if (orderId) {
    //       order = await Order.findOne({ orderId });
    //     }
    //     if (!order) {
    //       order = await Order.findOne({ chatId });
    //     }
    //     if (!order) {
    //       console.error('Mock payment: order not found for chatId:', chatId);
    //       return;
    //     }
    //     console.log('Mock payment applied for order:', order.orderId);
    //     await handlePaymentSuccess(socket, io, {
    //       chatId,
    //       orderId: order.orderId,
    //       escrowId: null,
    //       reference: `mock-${Date.now()}`,
    //     });
    //     io.to(chatId).emit('paymentSuccess', {
    //       escrowId: null,
    //       orderId: order.orderId,
    //       chatId,
    //       paymentStatus: 'paid',
    //     });
    //   } catch (error) {
    //     console.error('MockPayment error:', error);
    //   }
    // });

    // Payment handler
    socket.on('paymentSuccess', (data) => safeHandler(handlePaymentSuccess, socket, io, data));

    // Payout handlers
    socket.on('getRunnerPayout', (data) => safeHandler(handleGetRunnerPayout, socket, io, data));
    socket.on('submitPayoutReceipt', (data) => safeHandler(handleSubmitPayoutReceipt, socket, io, data));

    registerTrackingHandlers(io, socket);

    // Error handler for the socket itself
    socket.on("error", (error) => {
      console.error(`Socket error for ${socket.id}:`, error);
    });

    // cancel an order
    socket.on('cancelOrder', (data) => safeHandler(handleCancelOrder, socket, io, data));
    socket.on('runnerStartedNewOrder', (data) => safeHandler(handleRunnerStartedNewOrder, socket, data));
    socket.on('taskCompleted', (data) => safeHandler(handleTaskCompleted, io, data))

    // Disconnect
    socket.on("disconnect", (reason) => {
      console.log(`❌ Client disconnected: ${socket.id}, reason: ${reason}`);
      clearInterval(heartbeatInterval);
      safeHandler(handleUserDisconnect, socket, io);
      safeHandler(socketHandlers.handleDisconnect, socket, io);
    });
  });

  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
  });

  app.get('/', (req, res) => {
    res.status(200).json({ status: 'OK', service: 'Sendrey Socket Server' });
  });

  server.listen(4001, () => console.log("✅ Socket.IO server running on port 4001"));


  // Self-ping to prevent Render spin-down
  if (process.env.NODE_ENV === 'production') {
    setInterval(async () => {
      try {
        await fetch('https://sendrey-server-socket.onrender.com/health');
        console.log('[keep-alive] socket server pinged');
      } catch (e) {
        console.error('[keep-alive] ping failed:', e.message);
      }
    }, 5 * 60 * 1000);
  }

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received — shutting down socket server');
    await redis.disconnect();
    io.close(() => console.log('Socket.IO closed'));
    server.close(async () => {
      await mongoose.connection.close();
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });

})
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

module.exports = app;
module.exports.getIO = () => {
  if (!ioInstance) {
    console.warn('IO not initialized yet');
    return null;
  }
  return ioInstance;
};