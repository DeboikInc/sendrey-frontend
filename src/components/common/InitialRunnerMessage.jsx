export const InitialRunnerMessage = async ({
  user,
  runnerData,
  serviceType,
  runnerId,
  socket,
  chatId,
  sendMessage
}) => {
  // Build full name, return empty string if no lastName
  const fullName = `${runnerData?.firstName || ''} ${runnerData?.lastName || ''}`.trim();

  const messages = [
    {
      type: 'system',
      text: `Runner ${fullName} joined the chat`,
      delay: 500
    },
    {
      type: 'profile-card',
      runnerInfo: {
        firstName: runnerData?.firstName,
        lastName: runnerData?.lastName || '',
        avatar: runnerData?.profilePicture || 'https://via.placeholder.com/128',
        rating: runnerData?.rating || 4,
        bio: `Hello I am ${fullName} and I will be your captain for this ${serviceType.replace('-', ' ')}. I am dedicated to helping you get your tasks done efficiently and effectively.`
      },
      delay: 1500
    },
  ];


  for (const msg of messages) {
    await new Promise(resolve => setTimeout(resolve, msg.delay));

    const formattedMessage = createMessage(msg, runnerId);

    if (socket) {
      sendMessage(chatId, formattedMessage);
    }
  }
};

const createMessage = (msg, runnerId) => {
  const baseMessage = {
    id: Date.now() + Math.random(),
    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    senderId: runnerId,
    senderType: "runner"
  };

  switch (msg.type) {
    case 'system':
      return {
        ...baseMessage,
        from: 'system',
        messageType: 'system',
        text: msg.text
      };

    case 'profile-card':
      return {
        ...baseMessage,
        from: 'system', // System so it's centered
        messageType: 'profile-card',
        runnerInfo: msg.runnerInfo
      };

    case 'text':
      return {
        ...baseMessage,
        from: 'me',
        status: 'sent',
        text: msg.text
      };

    case 'image':
      return {
        ...baseMessage,
        from: 'me',
        status: 'sent',
        messageType: 'image',
        imageUrl: msg.imageUrl,
        caption: msg.caption || ''
      };

    default:
      return baseMessage;
  }
};