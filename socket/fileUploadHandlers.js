const cloudinary = require('../config/cloudinary');
const { Chat } = require("../models/Chat");
const streamifier = require('streamifier');
const { logMetric } = require('../utils/metricsLogger');

/**
 * Handle file upload via socket
 */
async function handleFileUpload(socket, io, data) {
    try {
        const {
            chatId, file, fileName,
            fileType, senderId, senderType,
            text, tempId, replyTo, replyToMessage, replyToFrom
        } = data;

        console.log('File upload request:', {
            chatId,
            fileName,
            fileType,
            senderId,
            text,
            size: file?.length
        });

        // Validate required fields
        if (!chatId || !file || !senderId) {
            socket.emit('fileUploadError', {
                error: 'Missing required fields',
                chatId
            });
            return;
        }

        // Convert base64 to buffer if needed
        let fileBuffer;
        if (typeof file === 'string' && file.startsWith('data:')) {
            const base64Data = file.split(',')[1];
            fileBuffer = Buffer.from(base64Data, 'base64');
        } else if (Buffer.isBuffer(file)) {
            fileBuffer = file;
        } else {
            socket.emit('fileUploadError', {
                error: 'Invalid file format',
                chatId
            });
            return;
        }

        // Determine resource type
        let resourceType = 'auto';
        if (fileType.startsWith('image/')) resourceType = 'image';
        else if (fileType.startsWith('video/')) resourceType = 'video';
        else if (fileType.startsWith('audio/')) resourceType = 'raw';
        else resourceType = 'raw';

        // Upload to Cloudinary using stream
        const uploadResult = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    resource_type: resourceType,
                    folder: 'sendrey-chat-files',
                    public_id: `${chatId}_${Date.now()}`,
                },
                (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                }
            );

            streamifier.createReadStream(fileBuffer).pipe(uploadStream);
        });

        console.log('File uploaded to Cloudinary:', uploadResult.secure_url);

        // Determine message type
        let messageType = 'file';
        if (fileType.startsWith('image/')) messageType = 'image';
        else if (fileType.startsWith('video/')) messageType = 'video';
        else if (fileType.startsWith('audio/')) messageType = 'audio';

        // Create message object
        const fileMessage = {
            id: tempId || Date.now(),
            from: senderType === 'runner' ? 'them' : 'me',
            type: messageType,
            messageType: messageType,
            fileName: fileName || 'file',
            fileUrl: uploadResult.secure_url,
            fileSize: uploadResult.bytes ? formatFileSize(uploadResult.bytes) : 'Unknown',
            text: text || '',
            text: messageType === 'image' ? '' : `File: ${fileName}`,
            time: new Date().toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            }),
            status: 'sent',
            senderId: senderId,
            senderType: senderType,
            cloudinaryId: uploadResult.public_id,
            ...(replyTo && { // reply data
                replyTo,
                replyToMessage,
                replyToFrom
            })
        };

        // Save to database
        const chat = await Chat.findOne({ chatId });
        if (chat) {
            chat.messages.push(fileMessage);
            await chat.save();
        } else {
            await Chat.create({
                chatId,
                messages: [fileMessage]
            });
        }

        // Emit to all clients in the chat room
        io.to(chatId).emit('message', fileMessage);

        // Send success confirmation to uploader
        socket.emit('fileUploadSuccess', {
            chatId,
            message: fileMessage,
            cloudinaryUrl: uploadResult.secure_url
        });

        const latency = Date.now() - startTime;
        await logMetric({
            type: 'file_upload',
            status: 'success',
            latency,
            chatId: data.chatId,
            userId: data.senderId,
            userType: data.senderType,
            metadata: {
                fileType: data.fileType,
                fileSize: data.file?.length || 0
            }
        });

    } catch (error) {
        console.error('File upload error:', error);

        await logMetric({
            type: 'file_upload',
            status: 'failed',
            chatId: data.chatId,
            userId: data.senderId,
            userType: data.senderType,
            error: error.message
        });

        socket.emit('fileUploadError', {
            error: error.message || 'File upload failed',
            chatId: data.chatId
        });
    }
}

/**
 * Format file size to human readable format
 */
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

module.exports = {
    handleFileUpload
};