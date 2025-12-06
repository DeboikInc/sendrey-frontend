// socket.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const { database } = require("./config/index");

// --- MongoDB setup ---
const currentDB = database.url;
console.log("Connecting to MongoDB with URL:", currentDB);

mongoose
  .connect(currentDB, database.options)
  .then(() => {
    console.log("MongoDB connected");

    // Start server only after DB connects
    const app = express();
    const server = http.createServer(app);

    const io = new Server(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    });

    app.use(cors());
    app.use(express.json());

    // Track connected runners by service type
    const runnersByService = {
      "pick-up": new Set(),
      "run-errand": new Set(),
    };

    // Chat Schema
    const messageSchema = new mongoose.Schema({
      _id: false,
      id: Number,
      from: String,
      text: String,
      type: { type: String, default: "text" },
      time: String,
      status: { type: String, default: "sent" },
      senderId: String,  
      senderType: String,
      fileUrl: String,
      fileName: String,
      fileSize: String,
    });

    const chatSchema = new mongoose.Schema({
      chatId: { type: String, required: true, unique: true },
      messages: [messageSchema],
    });

    const Chat = mongoose.model("Chat", chatSchema);

    // ServiceRequest Schema
    const serviceRequestSchema = new mongoose.Schema({
      requestId: { type: String, required: true, unique: true },
      userId: { type: String, required: true },
      firstName: String,
      lastName: String,
      serviceType: String,
      fleetType: String,
      status: { type: String, default: "available" },
      pickedByRunner: String,
      createdAt: { type: Date, default: Date.now },
    });

    const ServiceRequest = mongoose.model("ServiceRequest", serviceRequestSchema);

    // --- Socket.IO connection ---
    io.on("connection", (socket) => {
      console.log("New client connected:", socket.id);

      socket.on("joinRunnerRoom", ({ runnerId, serviceType }) => {
        socket.runnerId = runnerId;
        socket.serviceType = serviceType;

        const room = `runners-${serviceType}`;
        socket.join(room);
        runnersByService[serviceType].add(socket.id);

        console.log(`Runner ${runnerId} joined room: ${room}`);

        ServiceRequest.find({ serviceType, status: "available" }).then((requests) => {
          socket.emit("existingRequests", requests);
        });
      });

      socket.on("createServiceRequest", async ({ userId, userName, serviceType, fleetType }) => {
        try {
          const requestId = `${userId}-${Date.now()}`;

          const newRequest = await ServiceRequest.create({
            requestId,
            userId,
            firstName,
            lastName,
            serviceType,
            fleetType,
            status: "available",
          });

          io.to(`runners-${serviceType}`).emit("newServiceRequest", newRequest);

          console.log(`New service request created: ${requestId}`);
        } catch (error) {
          console.error("Error creating service request:", error);
        }
      });

      socket.on("pickService", async ({ requestId, runnerId, runnerName }) => {
        try {
          const request = await ServiceRequest.findOne({ requestId });

          if (!request || request.status === "picked") {
            socket.emit("serviceTaken", { requestId });
            return;
          }

          request.status = "picked";
          request.pickedByRunner = runnerId;
          await request.save();

          io.to(`runners-${request.serviceType}`).emit("servicePicked", {
            requestId,
            runnerId,
            runnerName,
          });

          console.log(`Service ${requestId} picked by runner ${runnerId}`);
        } catch (error) {
          console.error("Error picking service:", error);
        }
      });

      socket.on("joinChat", async (chatId) => {
        socket.join(chatId);
        // console.log(`Socket ${socket.id} joined chat ${chatId}`);

        let chat = await Chat.findOne({ chatId });
        if (!chat) chat = await Chat.create({ chatId, messages: [] });

        socket.emit("chatHistory", chat.messages);
      });

      socket.on("sendMessage", async ({ chatId, message }) => {
        console.log(`Received message for chat ${chatId}:`, message);
        const chat = await Chat.findOne({ chatId });

        if (!chat) {
          console.log(`Chat ${chatId} not found, creating new one`);
          chat = await Chat.create({ chatId, messages: [] });
        }

        chat.messages.push(message);
        await chat.save();

        console.log(`Emitting message to room ${chatId}`);
        io.to(chatId).emit("message", message);
      });

      socket.on("disconnect", () => {
        if (socket.serviceType && runnersByService[socket.serviceType]) {
          runnersByService[socket.serviceType].delete(socket.id);
        }
        console.log("Client disconnected:", socket.id);
      });
    });

    server.listen(4001, () => console.log("Socket.IO server running on port 4001"));
  })
  .catch((err) => console.error("MongoDB connection error:", err));
