const mongoose = require('mongoose');

const mediaSchema = new mongoose.Schema({
  taskId: { type: String, required: true, index: true },
  uploaderId: { type: String, required: true },
  uploaderType: { type: String, enum: ['user', 'runner'], required: true },
  fileUrl: { type: String, required: true },
  fileName: String,
  fileType: { type: String, enum: ['image', 'document', 'voice_note'] },
  publicId: { type: String, required: true }, // Cloudinary public_id
  format: String, // jpg, mp3, pdf, etc.
  size: Number, // in bytes
  uploadedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Media', mediaSchema);