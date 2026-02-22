const ratingService = require('../services/ratingService');
const { Chat } = require('../models/Chat');

const handleSubmitRating = async (socket, io, data) => {
  const { orderId, chatId, userId, runnerId, rating, feedback } = data;

  try {
    const rating = await ratingService.submitRating({
      orderId,
      chatId,
      userId,
      runnerId,
      rating,
      feedback
    });

    // Send rating submitted message to chat
    const ratingMessage = {
      id: `rating-${Date.now()}`,
      from: 'system',
      type: 'rating_submitted',
      messageType: 'rating_submitted',
      text: 'User submitted a rating',
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: 'sent',
      senderId: 'system',
      ratingDetails: {
        rating,
        feedback: feedback || null,
        orderId
      }
    };

    await Chat.findOneAndUpdate(
      { chatId },
      { $push: { messages: ratingMessage } },
      { upsert: true }
    );

    io.to(chatId).emit('message', ratingMessage);

    // Notify runner of new rating
    io.to(`runner-${runnerId}`).emit('newRating', {
      rating,
      feedback,
      orderId
    });

    socket.emit('ratingSubmittedSuccess', {
      rating,
      orderId
    });

    console.log(`Rating submitted: ${rating}/5 for order ${orderId}`);

  } catch (error) {
    console.error('Error submitting rating:', error);
    socket.emit('ratingError', { error: error.message });
  }
};

module.exports = { handleSubmitRating };