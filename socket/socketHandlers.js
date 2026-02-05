// socketHandlers.js
const Chat = require("./Chat");
const ServiceRequest = require("./ServiceRequest");
const Invoice = require("./Invoice");
const User = require("../models/User");

// Global state trackers
const runnersByService = {
  "pick-up": new Set(),
  "run-errand": new Set(),
};
const chatRoomMembers = new Map();

const createInitialRunnerMessages = async (runnerData, serviceType, chatId, runnerId) => {
  const fullName = `${runnerData?.firstName || ''} ${runnerData?.lastName || ''}`.trim();

  const messages = [
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

  try {
    const chat = await Chat.findOne({ chatId });
    if (chat) {
      const hasProfileCard = chat.messages.some(m =>
        m.type === 'profile-card' || m.messageType === 'profile-card'
      );

      if (!hasProfileCard) {
        chat.messages.push(...messages);
        await chat.save();
        console.log(`Initial runner messages added to chat ${chatId}`);
      } else {
        console.log(`Profile card already exists in chat ${chatId}`);
      }
    }
  } catch (error) {
    console.error("Error creating initial runner messages:", error);
  }

  return messages;
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

const handleAcceptRunnerRequest = async (socket, io, { runnerId, userId, chatId, serviceType }) => {
  console.log(`Runner ${runnerId} accepting request from user ${userId}`);

  try {
    const runnerData = await User.findById(runnerId);

    if (!runnerData) {
      console.error(`Runner ${runnerId} not found in database`);
      return;
    }

    // Set both users unavailable
    await Promise.all([
      User.findByIdAndUpdate(runnerId, { isAvailable: false }),
      User.findByIdAndUpdate(userId, { isAvailable: false })
    ]);

    console.log(`Runner ${runnerId} and User ${userId} availability set to FALSE`);

    // Runner joins the chat room
    socket.join(chatId);

    // Track runner in this chat
    if (!chatRoomMembers.has(chatId)) {
      chatRoomMembers.set(chatId, new Set());
    }
    chatRoomMembers.get(chatId).add(runnerId);

    console.log(`Runner ${runnerId} joined chat ${chatId}`);

    const initialMessages = await createInitialRunnerMessages(
      runnerData,
      serviceType,
      chatId,
      runnerId
    );

    // Emit the initial messages to the chat room
    for (const message of initialMessages) {
      io.to(chatId).emit("message", message);
    }

    // Notify that runner has accepted and is in the room
    io.to(chatId).emit("runnerAccepted", {
      runnerId,
      userId,
      chatId,
      runnerInRoom: true,
      timestamp: new Date().toISOString()
    });

    console.log(`Emitted runnerAccepted to chat room: ${chatId}`);
  } catch (error) {
    console.error("Error in acceptRunnerRequest:", error);

    // Still emit acceptance even if DB update fails
    socket.join(chatId);
    if (!chatRoomMembers.has(chatId)) {
      chatRoomMembers.set(chatId, new Set());
    }
    chatRoomMembers.get(chatId).add(runnerId);

    io.to(chatId).emit("runnerAccepted", {
      runnerId,
      userId,
      chatId,
      runnerInRoom: true,
      timestamp: new Date().toISOString()
    });
  }
};

const handleSendMessage = async (io, { chatId, message }) => {
  console.log(`Received message for chat ${chatId}:`, message);

  try {
    let chat = await Chat.findOne({ chatId });

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
    io.to(chatId).emit("message", message);
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

    io.to(chatId).emit("receiveInvoice", {
      message: invoiceMessage,
      invoiceId,
      invoiceData: invoiceMessage.invoiceData
    });

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

  io.to(chatId).emit("receiveTrackRunner", trackingPayload);
  console.log(`Emitted receiveTrackRunner to ${chatId}`);
};

// Cleanup on disconnect
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
  handleDisconnect
};