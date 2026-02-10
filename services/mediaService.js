const cloudinary = require('../config/cloudinary');
const Media = require('../models/Media');
const Chat = require('../models/Chat'); 

class MediaService {
  static async uploadFile(file, taskId, uploaderId, uploaderType) {
    //  Validate file types
    const allowedTypes = ['image', 'document', 'voice_note'];
    const fileType = this.getFileType(file.mimetype);
    if (!allowedTypes.includes(fileType)) {
      throw new Error('Invalid file type');
    }

    // Check if user/runner is a participant in the task's chat
    const hasAccess = await this.checkTaskAccess(taskId, uploaderId, uploaderType);
    if (!hasAccess) {
      throw new Error('No permission to upload to this task');
    }

    //  Upload to Cloudinary
    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `task_${taskId}`,
          resource_type: 'auto',
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );

      uploadStream.end(file.buffer);
    });

    // 4. Save to Media model
    const media = new Media({
      taskId,
      uploaderId,
      uploaderType,
      fileUrl: uploadResult.secure_url,
      fileName: file.originalname,
      fileType,
      publicId: uploadResult.public_id,
      format: uploadResult.format,
      size: uploadResult.bytes,
    });

    await media.save();

    return media.toObject();
  }

  static async deleteFile(publicId, userId, userType) {
    const media = await Media.findOne({ publicId });
    if (!media) throw new Error('Media not found');

    if (media.uploaderId !== userId && userType !== 'admin') {
      throw new Error('Not authorized to delete this file');
    }

    await cloudinary.uploader.destroy(publicId);
    await Media.deleteOne({ publicId });
  }

  static getFileType(mimetype) {
    if (mimetype.startsWith('image/')) return 'image';
    if (mimetype.startsWith('audio/')) return 'voice_note';
    if (mimetype.includes('pdf') || mimetype.includes('document') || mimetype.includes('text')) {
      return 'document';
    }
    return 'document';
  }

  // Use Chat model to check permissions
  static async checkTaskAccess(taskId, userId, userType) {
    const chat = await Chat.findOne({ taskId });
    if (!chat) return false;

    const isParticipant = chat.participants.some(
      p => p.userId === userId && p.userType === userType
    );
    return isParticipant;
  }

  static async getTaskMedia(taskId, requesterId, requesterType) {
    const hasAccess = await this.checkTaskAccess(taskId, requesterId, requesterType);
    if (!hasAccess) throw new Error('No permission to view media');

    return Media.find({ taskId }).sort({ uploadedAt: -1 });
  }
}

module.exports = MediaService;