import { useState, useEffect, useRef, useCallback } from 'react';

export const useTypingAndRecordingIndicator = ({ socket, chatId, currentUserId, currentUserType }) => {
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [otherUserRecording, setOtherUserRecording] = useState(false);
  
  const typingTimeoutRef = useRef(null);
  const stopTypingTimeoutRef = useRef(null);

  // Emit typing status
  const sendTypingStatus = useCallback((typing) => {
    if (!socket || !chatId || !currentUserId) return;

    socket.emit('typing', {
      chatId,
      userId: currentUserId,
      userType: currentUserType,
      isTyping: typing,
    });
  }, [socket, chatId, currentUserId, currentUserType]);

  // Emit recording status
  const sendRecordingStatus = useCallback((recording) => {
    if (!socket || !chatId || !currentUserId) return;

    socket.emit('recording', {
      chatId,
      userId: currentUserId,
      userType: currentUserType,
      isRecording: recording,
    });

    console.log(` Emitted recording=${recording}`);
  }, [socket, chatId, currentUserId, currentUserType]);

  // Handle when current user is typing
  const handleTyping = useCallback(() => {
    if (!isTyping) {
      setIsTyping(true);
      sendTypingStatus(true);
    }

    if (stopTypingTimeoutRef.current) {
      clearTimeout(stopTypingTimeoutRef.current);
    }

    if (!typingTimeoutRef.current) {
      typingTimeoutRef.current = setTimeout(() => {
        if (isTyping) {
          sendTypingStatus(true);
        }
        typingTimeoutRef.current = null;
      }, 3000);
    }

    stopTypingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      sendTypingStatus(false);
    }, 1000);
  }, [isTyping, sendTypingStatus]);

  // Handle when current user starts/stops recording
  const handleRecordingStart = useCallback(() => {
    setIsRecording(true);
    sendRecordingStatus(true);
  }, [sendRecordingStatus]);

  const handleRecordingStop = useCallback(() => {
    setIsRecording(false);
    sendRecordingStatus(false);
  }, [sendRecordingStatus]);

  // Listen for other user typing
  useEffect(() => {
    if (!socket) return;

    const handleUserTyping = ({ userId, isTyping }) => {
      if (userId !== currentUserId) {
        setOtherUserTyping(isTyping);

        if (isTyping) {
          setTimeout(() => {
            setOtherUserTyping(false);
          }, 3500);
        }
      }
    };

    // Listen for other user recording
    const handleUserRecording = ({ userId, isRecording }) => {
      if (userId !== currentUserId) {
        console.log(`👂 Other user recording=${isRecording}`);
        setOtherUserRecording(isRecording);

        if (isRecording) {
          setTimeout(() => {
            setOtherUserRecording(false);
          }, 65000); // Auto-hide after 65s (max recording time + buffer)
        }
      }
    };

    socket.on('userTyping', handleUserTyping);
    socket.on('userRecording', handleUserRecording);

    return () => {
      socket.off('userTyping', handleUserTyping);
      socket.off('userRecording', handleUserRecording);
    };
  }, [socket, currentUserId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (stopTypingTimeoutRef.current) {
        clearTimeout(stopTypingTimeoutRef.current);
      }
      if (isTyping) {
        sendTypingStatus(false);
      }
      if (isRecording) {
        sendRecordingStatus(false);
      }
    };
  }, [isTyping, isRecording, sendTypingStatus, sendRecordingStatus]);

  return {
    handleTyping,
    handleRecordingStart, 
    handleRecordingStop,  
    otherUserTyping,
    otherUserRecording,  
  };
};