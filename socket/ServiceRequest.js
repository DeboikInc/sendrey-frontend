const mongoose = require("mongoose");

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

module.exports = mongoose.model("ServiceRequest", serviceRequestSchema);