const mongoose = require("mongoose");

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
});

module.exports = mongoose.model("Chat", chatSchema);