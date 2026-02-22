// socket.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const { database } = require("./config/index");
const app = express();

// handlers
const socketHandlers = require("./socket/socketHandlers");
const chatStatusHandlers = require('./socket/chatStatusHandlers');
const fileUploadHandlers = require('./socket/fileUploadHandlers');
const notificationHandlers = require('./socket/notificationHandlers');
const { handleRunnerAccept } = require('./socket/orderHandlers');
const { handleSubmitItems, handleApproveItems, handleRejectItems } = require("./socket/itemHandlers");
const { handleMarkDeliveryComplete, handleConfirmDelivery } = require('./socket/deliveryHandlers');
const { handleRaiseDispute, handleResolveDispute } = require('./socket/disputeHandlers');
const { handleSubmitRating } = require('./socket/ratingHandlers');
const callHandlers = require("./socket/callHandlers");
const { handlePaymentSuccess } = require('./socket/paymentHandlers');
const { handleGetRunnerPayout, handleSubmitPayoutReceipt } = require('./socket/payoutHandlers');

// Import models
const { Chat } = require("./models/Chat");
const ServiceRequest = require("./socket/ServiceRequest");
const Invoice = require("./models/Invoice");
const User = require('./models/User');

require('events').EventEmitter.defaultMaxListeners = 15;

let ioInstance;

// MongoDB connection
mongoose.connect(database.url, database.options)
  .then(() => {
    console.log("MongoDB connected");

    const app = express();
    const server = http.createServer(app);


    const io = new Server(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
      transports: ['websocket', 'polling'],
      allowEIO3: true,
      pingTimeout: 60000,
      pingInterval: 25000,
      maxHttpBufferSize: 10e6,
      perMessageDeflate: true
    });

    ioInstance = io;

    app.use(cors());
    app.use(express.json());
    app.set('io', io);

    io.on("connection", (socket) => {
      console.log("New client connected:", socket.id);

      process.on('uncaughtException', (error) => {
        console.error('🔥 UNCAUGHT EXCEPTION:', error.message);
        console.error(error.stack);
      });

      process.on('unhandledRejection', (error) => {
        console.error('🔥 UNHANDLED REJECTION:', error.message);
        console.error(error.stack);
      });

      // Notification handlers
      socket.on('saveFcmToken', (data) =>
        notificationHandlers.handleSaveFcmToken(socket, data)
      );

      socket.on('userOnline', (data) =>
        notificationHandlers.handleUserOnline(socket, data)
      );


      // Runner events
      socket.on("joinRunnerRoom", (data) => socketHandlers.handleJoinRunnerRoom(socket, data));

      socket.on("acceptRunnerRequest", async (data) => {
        try {
          socketHandlers.handleAcceptRunnerRequest(socket, io, data)

          // create order, link to chat, update runner and user records
          await handleRunnerAccept(io, socket, data);
        } catch (error) {
          socket.emit("error", { error: error.message });
        }
      }
      );

      // user 
      socket.on("requestRunner", (data) =>
        socketHandlers.handleRequestRunner(socket, io, data)
      );

      socket.on("userJoinChat", (data) =>
        socketHandlers.handleUserJoinChat(socket, io, data)
      );

      socket.on("runnerJoinChat", (data) => {
        socketHandlers.handleRunnerJoinChat(socket, io, data)

        setTimeout(() => {
          const rooms = Array.from(socket.rooms);
          console.log('Runner socket rooms after join:', rooms);
        }, 500);
      }
      );

      // Chat events
      socket.on("sendMessage", async (data) => {
        await socketHandlers.handleSendMessage(io, data);

        // Send push notification for new message
        await notificationHandlers.sendMessageNotification(
          data.chatId,
          data.message,
          data.message.senderId,
          data.message.senderType
        );
      });

      // Status update event
      socket.on("updateStatus", async (data) => {
        const room = io.sockets.adapter.rooms.get(data.chatId);
        console.log(`Room ${data.chatId} has ${room?.size || 0} sockets:`, Array.from(room || []));

        await chatStatusHandlers.handleUpdateStatus(socket, io, data);

        // Send push notification for status update
        await notificationHandlers.sendStatusUpdateNotification(
          data.chatId,
          data.status,
          data.updatedBy,
          data.updatedByType
        );
      });

      // Media message event
      socket.on("sendMedia", (data) =>
        chatStatusHandlers.handleSendMedia(socket, io, data)
      );

      // LEGACY: joinChat (read-only, for reconnections or chat screen navigation)
      // Do not create chats - only joins existing ones
      socket.on("joinChat", async (data) => {
        const { chatId, taskId, serviceType } = data;

        console.log('joinChat (legacy/readonly) received:', { chatId, taskId, serviceType });

        socket.join(chatId);

        // Just find and send history, NEVER create
        const chat = await Chat.findOne({ chatId });

        // Small delay to ensure client listener is registered
        setTimeout(() => {
          if (chat) {
            socket.emit("chatHistory", chat.messages);
          } else {
            socket.emit("chatHistory", []);
          }
        }, 100);
      });

      // Invoice events
      socket.on("sendInvoice", (data) => socketHandlers.handleSendInvoice(socket, io, data));

      socket.on(" acceptInvoice", async ({ invoiceId, chatId, userId, runnerId }) => {
        try {
          const invoice = await Invoice.findOneAndUpdate(
            { invoiceId },
            { status: "accepted", acceptedAt: new Date() },
            { new: true }
          );

          if (!invoice) {
            socket.emit("invoiceError", { error: "Invoice not found" });
            return;
          }

          const systemMessage = {
            id: Date.now(),
            from: "system",
            messageType: "system",
            text: "Invoice accepted",
            type: "system",
            time: new Date().toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: true
            }),
            status: "sent",
            senderId: "system",
            senderType: "system",
            style: "success"
          };

          const chat = await Chat.findOne({ chatId });
          if (chat) {
            chat.messages.push(systemMessage);
            await chat.save();
          }

          io.to(chatId).emit("message", systemMessage);

          setTimeout(async () => {
            const payMessage = {
              id: Date.now() + 1,
              from: "user",
              text: "Invoice has been accepted by sender. Proceed to make payment. Pay",
              type: "payment",
              time: new Date().toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
              }),
              status: "sent",
              senderId: userId,
              senderType: "user",
              invoiceId,
              showPayButton: true
            };

            if (chat) {
              chat.messages.push(payMessage);
              await chat.save();
            }

            io.to(chatId).emit("message", payMessage);
          }, 500);
        } catch (error) {
          console.error("Error accepting invoice:", error);
          socket.emit("invoiceError", { error: "Failed to accept invoice" });
        }
      });

      socket.on("uploadFile", (data) =>
        fileUploadHandlers.handleFileUpload(socket, io, data)
      );

      socket.on("deleteMessage", (data) =>
        socketHandlers.handleDeleteMessage(socket, io, data)
      );

      // Tracking event
      socket.on("startTrackRunner", (data) => socketHandlers.handleStartTrackRunner(io, data));

      // call
      socket.on('rejoinUserRoom', ({ userId, userType }) => {
        const room = userType === 'runner' ? `runner-${userId}` : `user-${userId}`;
        socket.join(room);

        const roomSockets = io.sockets.adapter.rooms.get(room);
        console.log(` ${userType || 'User'} ${userId} re-joined personal room: ${room}`);
        console.log(`Room ${room} now has ${roomSockets?.size || 0} sockets:`, Array.from(roomSockets || []));
      });

      callHandlers.register(socket, io);

      // typing indicator
      socket.on('typing', ({ chatId, userId, userType, isTyping }) => {
        console.log(`${userType} ${userId} ${isTyping ? 'started' : 'stopped'} typing in ${chatId}`);

        // Broadcast to everyone in the chat EXCEPT the sender
        socket.to(chatId).emit('userTyping', {
          userId,
          userType,
          isTyping,
          timestamp: new Date(),
        });
      });

      // recording
      socket.on('recording', ({ chatId, userId, userType, isRecording }) => {
        console.log(`${userType} ${userId} ${isRecording ? 'started' : 'stopped'} recording in ${chatId}`);

        // Broadcast to everyone in the chat EXCEPT the sender
        socket.to(chatId).emit('userRecording', {
          userId,
          userType,
          isRecording,
          timestamp: new Date(),
        });
      });

      // items
      socket.on("submitItems", (data) => handleSubmitItems(socket, io, data));
      socket.on("approveItems", (data) => handleApproveItems(socket, io, data));
      socket.on("rejectItems", (data) => handleRejectItems(socket, io, data));

      // delivery handlers
      socket.on('markDeliveryComplete', (data) => handleMarkDeliveryComplete(io, socket, data));
      socket.on('confirmDelivery', (data) => handleConfirmDelivery(io, socket, data));

      // dispute handlers
      socket.on('raiseDispute', (data) => handleRaiseDispute(socket, io, data));
      socket.on('resolveDispute', (data) => handleResolveDispute(socket, io, data));

      socket.on('submitRating', (data) => handleSubmitRating(socket, io, data));

      // mock
      socket.on('mockPayment', async ({ chatId, orderId }) => {
        console.log('Mock payment received | chatId:', chatId, '| orderId:', orderId);

        const Order = require('./models/Order');

        // Look up order by chatId if orderId not provided
        let order = null;
        if (orderId) {
          order = await Order.findOne({ orderId });
        }
        if (!order) {
          order = await Order.findOne({ chatId });
        }

        if (!order) {
          console.error('Mock payment: order not found for chatId:', chatId);
          return;
        }

        console.log('Mock payment applied for order:', order.orderId);

        // Delegate to handlePaymentSuccess — creates RunnerPayout for run-errand
        await handlePaymentSuccess(socket, io, {
          chatId,
          orderId: order.orderId,
          escrowId: null,
          reference: `mock-${Date.now()}`,
        });

        // Broadcast to room so clients update UI
        io.to(chatId).emit('paymentSuccess', {
          escrowId: null,
          orderId: order.orderId,
          chatId,
          paymentStatus: 'paid',
        });
      });


      // Payment handler
      socket.on('paymentSuccess', (data) => handlePaymentSuccess(socket, io, data));

      // Payout handlers
      socket.on('getRunnerPayout', (data) => handleGetRunnerPayout(socket, io, data));

      socket.on('submitPayoutReceipt', (data) => handleSubmitPayoutReceipt(socket, io, data));

      // Disconnect
      socket.on("disconnect", () => socketHandlers.handleDisconnect(socket));
    });

    server.listen(4001, () => console.log("Socket.IO server running on port 4001"));
  })

  .catch((err) => console.error("MongoDB connection error:", err));

module.exports = app;
module.exports.getIO = () => {
  if (!ioInstance) {
    console.warn('IO not initialized yet');
    return null;
  }
  return ioInstance;
};