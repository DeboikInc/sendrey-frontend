const mongoose = require("mongoose");
const { ALL_STATUSES, TASK_TYPES } = require('../config/constants');

const messageSchema = new mongoose.Schema({
  _id: false,
  id: { type: mongoose.Schema.Types.Mixed },
  from: String,
  text: String,
  type: { type: String, default: "text" },
  messageType: { type: String, default: null },
  time: String,
  status: { type: String, default: "sent" },
  senderId: String,
  senderType: String,

  replyTo: { type: String, default: null },
  replyToMessage: { type: String, default: null },
  replyToFrom: { type: String, default: null },
  reaction: { type: String, default: null },
  edited: { type: Boolean, default: false },
  deleted: { type: Boolean, default: false },

  fileName: { type: String, default: null },
  fileUrl: { type: String, default: null },
  fileSize: { type: String, default: null },
  fileType: { type: String, default: null },

  invoiceData: { type: mongoose.Schema.Types.Mixed, default: null },
  invoiceId: { type: String, default: null },

  runnerInfo: {
    type: {
      firstName: String,
      lastName: String,
      avatar: String,
      rating: Number,
      bio: String
    },
    default: null
  },

  tempId: { type: String, default: null },

  // Payment
  paymentData: { type: mongoose.Schema.Types.Mixed, default: null },

  // Task completion — orderId stamped so frontend can trigger rating check
  orderId: { type: String, default: null },

  // Item submission
  submissionId: { type: String, default: null },
  items: { type: mongoose.Schema.Types.Mixed, default: null },
  escrowId: { type: String, default: null },
  approvalStatus: { type: String, default: null },

  // Delivery confirmation
  confirmationStatus: { type: String, default: null },

  // Dispute
  disputeId: { type: String, default: null },
  disputeData: { type: mongoose.Schema.Types.Mixed, default: null },

  // Rating
  ratingDetails: { type: mongoose.Schema.Types.Mixed, default: null },

  // Tracking
  trackingData: { type: mongoose.Schema.Types.Mixed, default: null },

  // Overflow for any future fields
  metadata: { type: mongoose.Schema.Types.Mixed, default: null },
});


const orderSessionSchema = new mongoose.Schema({
  _id: false,
  orderId: { type: String, required: true },
  startedAt: { type: Date, default: Date.now },
  completedAt: { type: Date, default: null },
  status: { type: String, enum: ['completed', 'cancelled'], default: 'completed' },
  messages: [messageSchema],
  orderData: {
    orderId: String,
    serviceType: String,
    taskType: String,
    status: String,
    paymentStatus: String,
    itemBudget: Number,
    deliveryFee: Number,
    totalAmount: Number,
    platformFee: Number,
    runnerPayout: Number,
    usedPayoutSystem: Boolean,
    pickupLocation: mongoose.Schema.Types.Mixed,
    pickupCoordinates: { lat: Number, lng: Number },
    deliveryLocation: mongoose.Schema.Types.Mixed,
    deliveryCoordinates: { lat: Number, lng: Number },
    marketLocation: mongoose.Schema.Types.Mixed,
    marketCoordinates: { lat: Number, lng: Number },
    routeDistanceMeters: Number,
    routeLegs: mongoose.Schema.Types.Mixed,
    fleetType: String,
    specialInstructions: mongoose.Schema.Types.Mixed,
    createdAt: Date,
    completedAt: Date,
    deliveryConfirmedAt: Date,
    statusHistory: [{
      status: String,
      timestamp: Date,
      triggeredBy: String,
      triggeredById: String,
      note: String
    }]
  },
  runnerInfo: {
    runnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Runner' }
  },
  userInfo: {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }
});

const chatSchema = new mongoose.Schema({
  chatId: { type: String, required: true, unique: true },
  messages: [messageSchema],
  orderSessions: [orderSessionSchema],
  taskId: { type: String, required: false, index: true },
  orderId: { type: String, default: null, index: true },  // Order reference
  userId: { type: String, default: null, index: true },
  runnerId: { type: String, default: null, index: true },
  serviceType: {
    type: String,
    enum: ['pick-up', 'run-errand', null],
    required: false,
    default: null
  },
  participants: [{
    userId: String,
    userType: { type: String, enum: ['user', 'runner'] }
  }],

  specialInstructions: {
    text: { type: String, default: null },
    media: [{
      fileName: String,
      fileUrl: String,
      fileType: String,
      fileSize: String
    }],
    createdAt: { type: Date, default: null }
  },

  lastActivity: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true }
});

const statusUpdateSchema = new mongoose.Schema({
  taskId: { type: String, required: true, index: true },
  runnerId: { type: String, required: true },
  status: { type: String, enum: ALL_STATUSES, required: true },
  previousStatus: String,
  taskType: { type: String, enum: Object.values(TASK_TYPES), required: true },
  timestamp: { type: Date, default: Date.now },
  location: { type: { lat: Number, lng: Number }, default: null },
  mediaUrl: String,
  triggeredBy: { type: String, enum: ['runner', 'system'], default: 'runner' }
});

const callLogSchema = new mongoose.Schema({
  taskId: { type: String, required: true, index: true },
  callId: { type: String, required: true, unique: true },
  callerId: String,
  callerType: { type: String, enum: ['user', 'runner'] },
  receiverId: String,
  receiverType: { type: String, enum: ['user', 'runner'] },
  type: { type: String, enum: ['voice', 'video'], required: true },
  startTime: { type: Date, default: Date.now },
  endTime: Date,
  duration: Number,
  status: { type: String, enum: ['completed', 'missed', 'failed'], default: 'completed' }
});

const mediaSchema = new mongoose.Schema({
  taskId: String,
  uploaderId: String,
  uploaderType: String,
  fileUrl: { type: String, required: true },
  fileName: String,
  fileType: { type: String, enum: ['image', 'document', 'voice_note'] },
  uploadedAt: { type: Date, default: Date.now }
});

const sessionSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  userType: { type: String, enum: ['user', 'runner'], required: true },
  socketId: String,
  lastSeen: { type: Date, default: Date.now },
  isOnline: { type: Boolean, default: false }
});

module.exports = {
  Chat: mongoose.model("Chat", chatSchema),
  StatusUpdate: mongoose.model("StatusUpdate", statusUpdateSchema),
  CallLog: mongoose.model("CallLog", callLogSchema),
  Session: mongoose.model("Session", sessionSchema)
};