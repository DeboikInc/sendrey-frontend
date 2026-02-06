export const sendOrderStatusMessage = ({
  statusKey,
  runnerId,
  userId,
  socket,
  chatId,
  sendMessage,
  setMessages,
  runnerData
}) => {
  const statusMessages = {
    on_way_to_location: "Runner on the way to location",
    arrived_at_location: "Runner arrived at location",
    // on_way_to_delivery: "Runner on the way to deliver",
    arrived_at_delivery: "Runner arrived at delivery location",
    delivered: "Order has been delivered successfully"
  };

  const messageText = statusMessages[statusKey];
  
  if (!messageText) {
    console.warn(`No message defined for status: ${statusKey}`);
    return;
  }

  const systemMessage = {
    id: Date.now().toString(),
    from: "system",
    text: messageText,
    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    status: "delivered",
    senderId: runnerId,
    senderType: "runner",
    messageType: "status_update",
    statusKey: statusKey
  };

  // Add to runner's local messages
  if (setMessages) {
    setMessages((prev) => [...prev, systemMessage]);
  }

  // Send through socket to user
  if (socket && sendMessage && chatId) {
    sendMessage(chatId, systemMessage);
    console.log(`Status update sent: ${messageText}`);
  }
};