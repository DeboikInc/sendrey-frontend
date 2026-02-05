// socket.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const { database } = require("./config/index");
const socketHandlers = require("./socket/socketHandlers");

// Import models
const Chat = require("./socket/Chat");
const ServiceRequest = require("./socket/ServiceRequest");
const Invoice = require("./socket/Invoice");
const User = require('./models/User');

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

    app.use(cors());
    app.use(express.json());

    io.on("connection", (socket) => {
      console.log("New client connected:", socket.id);

      // Runner events
      socket.on("joinRunnerRoom", (data) => socketHandlers.handleJoinRunnerRoom(socket, data));
      
      socket.on("acceptRunnerRequest", (data) => 
        socketHandlers.handleAcceptRunnerRequest(socket, io, data)
      );

      // Chat events
      socket.on("sendMessage", (data) => socketHandlers.handleSendMessage(io, data));
      
      socket.on("joinChat", async (chatId) => {
        socket.join(chatId);
        let chat = await Chat.findOne({ chatId });
        if (!chat) chat = await Chat.create({ chatId, messages: [] });
        socket.emit("chatHistory", chat.messages);
      });

      // Invoice events
      socket.on("sendInvoice", (data) => socketHandlers.handleSendInvoice(socket, io, data));
      
      socket.on("acceptInvoice", async ({ invoiceId, chatId, userId, runnerId }) => {
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

      // Tracking event
      socket.on("startTrackRunner", (data) => socketHandlers.handleStartTrackRunner(io, data));

      // Disconnect
      socket.on("disconnect", () => socketHandlers.handleDisconnect(socket));
    });

    server.listen(4001, () => console.log("Socket.IO server running on port 4001"));
  })
  .catch((err) => console.error("MongoDB connection error:", err));