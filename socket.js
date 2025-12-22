// socket.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");
const User = require("./models/User");
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

    // Import User model to update availability
    const User = mongoose.model("User");

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
      
      invoiceData: { type: mongoose.Schema.Types.Mixed, default: null },
      invoiceId: { type: String, default: null }
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

    // Invoice Schema
    const invoiceSchema = new mongoose.Schema({
      invoiceId: { type: String, required: true, unique: true },
      chatId: { type: String, required: true },
      runnerId: { type: String, required: true },
      userId: { type: String, required: true },
      marketData: {
        name: String,
        address: String
      },
      items: [{
        id: Number,
        name: String,
        unitPrice: Number,
        quantity: Number,
        total: Number
      }],
      subTotal: { type: Number, required: true },
      grandTotal: { type: Number, required: true },
      status: { 
        type: String, 
        enum: ["pending", "accepted", "declined", "paid"],
        default: "pending" 
      },
      createdAt: { type: Date, default: Date.now },
      acceptedAt: { type: Date, default: null },
      declinedAt: { type: Date, default: null },
      paidAt: { type: Date, default: null }
    });

    const Invoice = mongoose.model("Invoice", invoiceSchema);

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

      socket.on("createServiceRequest", async ({ userId, firstName, lastName, serviceType, fleetType }) => {
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

        let chat = await Chat.findOne({ chatId });
        if (!chat) chat = await Chat.create({ chatId, messages: [] });

        socket.emit("chatHistory", chat.messages);
      });

      socket.on("sendMessage", async ({ chatId, message }) => {
        console.log(`Received message for chat ${chatId}:`, message);
        
        try {
          const chat = await Chat.findOne({ chatId });

          if (!chat) {
            console.log(`Chat ${chatId} not found, creating new one`);
            chat = await Chat.create({ chatId, messages: [] });
          }

          chat.messages.push(message);
          await chat.save();

          console.log(`Emitting message to room ${chatId}`);
          io.to(chatId).emit("message", message);
        } catch (error) {
          console.error("Error sending message:", error);
          // Still emit to room even if save fails
          io.to(chatId).emit("message", message);
        }
      });

      socket.on("requestRunner", async ({ runnerId, userId, chatId, serviceType }) => {
        console.log('SERVER: Received requestRunner from user:', userId, 'to runner:', runnerId);

        socket.join(chatId);

        try {
          // Find or create chat
          let chat = await Chat.findOne({ chatId });
          if (!chat) {
            chat = await Chat.create({
              chatId,
              messages: []
            });
            console.log(`Created new chat: ${chatId}`);
          } else {
            console.log(`Chat already exists: ${chatId}`);
          }
        } catch (error) {
          console.error("Error creating/finding chat:", error);
        }

        // Emit to the specific runner (even if chat creation fails)
        io.to(`runners-${serviceType}`).emit("runnerRequested", {
          runnerId,
          userId,
          chatId,
          serviceType
        });
      });

      socket.on("acceptRunnerRequest", async ({ runnerId, userId, chatId }) => {
        console.log(`Runner ${runnerId} accepted request from user ${userId}`);

        try {
          // Set runner unavailable
          await User.findByIdAndUpdate(runnerId, {
            isAvailable: false
          });
          console.log(`Runner ${runnerId} availability set to FALSE`);

          // Set user unavailable
          await User.findByIdAndUpdate(userId, {
            isAvailable: false
          });
          console.log(`User ${userId} availability set to FALSE`);

          // Runner joins the chat room
          socket.join(chatId);

          // Notify the user that runner accepted
          io.to(chatId).emit("runnerAccepted", {
            runnerId,
            userId,
            chatId,
            timestamp: new Date().toISOString()
          });

          console.log(`Emitted runnerAccepted to chat room: ${chatId}`);
        } catch (error) {
          console.error("Error updating runner availability:", error);
          // Still emit the acceptance even if DB update fails
          socket.join(chatId);
          io.to(chatId).emit("runnerAccepted", {
            runnerId,
            userId,
            chatId,
            timestamp: new Date().toISOString()
          });
        }
      });

      // INVOICE HANDLERS 
      
      // Send Invoice (Runner → User)
      socket.on("sendInvoice", async ({ invoiceData, chatId, runnerId, userId, marketData }) => {
        console.log(`Runner ${runnerId} sending invoice to user ${userId}`);

        try {
          // Generate unique invoice ID
          const invoiceId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          
          // Save invoice to database
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

          // Create invoice message
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

          // Save message to chat
          const chat = await Chat.findOne({ chatId });
          if (chat) {
            chat.messages.push(invoiceMessage);
            await chat.save();
          }

          // Emit to chat room
          io.to(chatId).emit("receiveInvoice", {
            message: invoiceMessage,
            invoiceId,
            invoiceData: invoiceMessage.invoiceData
          });

          console.log(`Invoice ${invoiceId} sent to chat ${chatId}`);
        } catch (error) {
          console.error("Error sending invoice:", error);
          
          // Emit error to sender
          socket.emit("invoiceError", {
            error: "Failed to send invoice. Please try again."
          });
        }
      });

      // Accept Invoice (User → Runner)
      socket.on("acceptInvoice", async ({ invoiceId, chatId, userId, runnerId }) => {
        console.log(`User ${userId} accepting invoice ${invoiceId}`);

        try {
          
          const invoice = await Invoice.findOneAndUpdate(
            { invoiceId },
            { 
              status: "accepted",
              acceptedAt: new Date()
            },
            { new: true }
          );

          if (!invoice) {
            console.error(`Invoice ${invoiceId} not found`);
            socket.emit("invoiceError", { error: "Invoice not found" });
            return;
          }

          console.log(`Invoice ${invoiceId} status updated to accepted`);

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

          // Save system message
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

            // Save pay message
            if (chat) {
              chat.messages.push(payMessage);
              await chat.save();
            }

            // Emit pay message
            io.to(chatId).emit("message", payMessage);
            
            console.log(`Payment message sent for invoice ${invoiceId}`);
          }, 500); 

        } catch (error) {
          console.error("Error accepting invoice:", error);
          socket.emit("invoiceError", { 
            error: "Failed to accept invoice. Please try again." 
          });
        }
      });

      // Decline Invoice (User → Runner)
      socket.on("declineInvoice", async ({ invoiceId, chatId, userId, runnerId }) => {
        console.log(`User ${userId} declining invoice ${invoiceId}`);

        try {
          // Update invoice status
          const invoice = await Invoice.findOneAndUpdate(
            { invoiceId },
            { 
              status: "declined",
              declinedAt: new Date()
            },
            { new: true }
          );

          if (!invoice) {
            console.error(`Invoice ${invoiceId} not found`);
            socket.emit("invoiceError", { error: "Invoice not found" });
            return;
          }

          console.log(`Invoice ${invoiceId} status updated to declined`);

          // Send system message: "Invoice Declined" (red text)
          const systemMessage = {
            id: Date.now(),
            from: "system",
            messageType: "system",
            text: "Invoice Declined",
            type: "system",
            time: new Date().toLocaleTimeString('en-US', { 
              hour: '2-digit', 
              minute: '2-digit',
              hour12: true 
            }),
            status: "sent",
            senderId: "system",
            senderType: "system",
            style: "error" // Red text indicator
          };

          // Save system message
          const chat = await Chat.findOne({ chatId });
          if (chat) {
            chat.messages.push(systemMessage);
            await chat.save();
          }

          // Emit system message
          io.to(chatId).emit("message", systemMessage);

          // Notify runner to reset status bar
          io.to(chatId).emit("invoiceDeclined", {
            invoiceId,
            statusToRemove: "send_invoice"
          });

          console.log(`Invoice ${invoiceId} declined, status bar reset signal sent`);
        } catch (error) {
          console.error("Error declining invoice:", error);
          socket.emit("invoiceError", { 
            error: "Failed to decline invoice. Please try again." 
          });
        }
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