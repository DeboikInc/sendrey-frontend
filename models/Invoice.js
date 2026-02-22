const mongoose = require("mongoose");

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

module.exports = mongoose.model("Invoice", invoiceSchema);