const mongoose = require("mongoose");
const { ALL_STATUSES, TASK_TYPES } = require('../config/constants');

const messageSchema = new mongoose.Schema({
  _id: false,
  id: { type: mongoose.Schema.Types.Mixed },
  from: String,
  text: String,
  type: { type: String, default: "text" },
  time: String,
  status: { type: String, default: "sent" },
  senderId: String,
  senderType: String,

  fileName: { type: String, default: null },
  fileUrl: { type: String, default: null },
  fileSize: { type: String, default: null },

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
  }
});

const chatSchema = new mongoose.Schema({
  chatId: { type: String, required: true, unique: true },
  messages: [messageSchema],
  taskId: { type: String, required: false, index: true },
  serviceType: { type: String, enum: ['pick-up', 'run-errand'], required: false, default:null },
  participants: [{
    userId: String,
    userType: { type: String, enum: ['user', 'runner'] }
  }],
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

// call
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
  duration: Number, // in seconds
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