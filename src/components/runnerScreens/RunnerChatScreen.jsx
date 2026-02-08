import React, { useState, useEffect, useRef } from "react";
import { IconButton, Avatar } from "@material-tailwind/react";
import ChatComposer from "../runnerScreens/chatComposer";
import {
  Phone,
  Video,
  MoreHorizontal,
  Ellipsis,
  ChevronLeft,
  Sun,
  Moon
} from "lucide-react";
import Message from "../common/Message";
import OrderStatusFlow from "./OrderStatusFlow";
import AttachmentOptionsFlow from "../common/AttachmentOptionsFlow";
import sendreyBot from "../../assets/sendrey_bot.jpg";

const HeaderIcon = ({ children, tooltip }) => (
  <IconButton variant="text" size="sm" className="rounded-full">
    {children}
  </IconButton>
);

export default function RunnerChatScreen({
  active,
  selectedUser,
  isChatActive,
  messages,
  setMessages,
  text,
  setText,
  dark,
  setDark,
  send,
  setDrawerOpen,
  setInfoOpen,
  runnerId,
  socket,

  // Order status flow props
  showOrderFlow,
  setShowOrderFlow,
  handleOrderStatusClick,
  completedOrderStatuses,
  setCompletedOrderStatuses,

  // Attachment flow props
  isAttachFlowOpen,
  setIsAttachFlowOpen,
  handleLocationClick,
  handleAttachClick,

  uploadFileWithProgress,

  replyingTo,
  setReplyingTo,
}) {
  const listRef = useRef(null);
  const fileInputRef = useRef(null);
  const processedMessageIds = useRef(new Set());

  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadingFiles, setUploadingFiles] = useState(new Map());
  const [uploadProgress, setUploadProgress] = useState(new Map());

  useEffect(() => {
    processedMessageIds.current = new Set();
  }, [selectedUser?._id, runnerId]);

  useEffect(() => {
    if (listRef.current) {
      const timeoutId = setTimeout(() => {
        listRef.current.scrollTo({
          top: listRef.current.scrollHeight,
          behavior: "smooth",
        });
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [messages, replyingTo]);

  useEffect(() => {
    if (!socket || !isChatActive || !selectedUser) return;

    const chatId = `user-${selectedUser._id}-runner-${runnerId}`;

    const handleMessageDeleted = ({ messageId, deletedBy }) => {
      console.log(`Message ${messageId} deleted by ${deletedBy}`);

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? {
              ...msg,
              deleted: true,
              text: deletedBy === runnerId ? "You deleted this message" : "This message was deleted",
              type: "deleted",
              fileUrl: null,
              fileName: null,
            }
            : msg
        )
      );
    };

    const handleIncomingMessage = (msg) => {
      console.log('📨 Incoming message:', msg);

      // Skip if already processed
      if (processedMessageIds.current.has(msg.id)) {
        console.log('⏭️ Skipping duplicate message:', msg.id);
        return;
      }

      // Skip file messages that are currently being uploaded
      const isUploadingFile = uploadingFiles.has(msg.tempId) ||
        Array.from(uploadingFiles.keys()).some(tempId =>
          msg.fileName && messages.some(m =>
            (m.id === tempId || m.tempId === tempId) &&
            m.fileName === msg.fileName &&
            m.isUploading
          )
        );

      if (isUploadingFile) {
        console.log('⏭️ Skipping message for currently uploading file:', msg.fileName);
        return;
      }

      // Mark as processed immediately
      processedMessageIds.current.add(msg.id);

      setMessages((prev) => {
        const exists = prev.some(m => m.id === msg.id);
        if (exists) {
          console.log('Message already exists, updating:', msg.id);
          return prev.map(m =>
            m.id === msg.id
              ? {
                ...m,
                ...msg,
                from: determineMessageFrom(msg, runnerId),
                isUploading: false,
              }
              : m
          );
        }

        // Add new message
        console.log('✅ Adding new message:', msg.id, 'Type:', msg.type, 'MessageType:', msg.messageType);
        const formattedMsg = {
          ...msg,
          from: determineMessageFrom(msg, runnerId),
          type: msg.type || msg.messageType || 'text',
        };

        return [...prev, formattedMsg];
      });
    };

    const determineMessageFrom = (msg, runnerId) => {
      // Check all system indicators INCLUDING text content
      if (msg.from === 'system' ||
        msg.type === 'system' ||
        msg.messageType === 'system' ||
        msg.senderType === 'system' ||
        msg.senderId === 'system' ||
        msg.type === 'profile-card' ||
        msg.messageType === 'profile-card' ||
        (msg.text && msg.text.includes('joined the chat'))) {
        return 'system';
      }

      // Check if message is from me (runner)
      const isFromMe = msg.senderId === runnerId ||
        msg.from === 'me' ||
        (msg.senderType === 'runner' && msg.senderId === runnerId);

      return isFromMe ? "me" : "them";
    };

    const handleChatHistory = (msgs) => {
      console.log('📜 Received chat history:', msgs.length, 'messages');

      const formattedMsgs = msgs.map(msg => {
        const isSystem = msg.from === 'system' ||
          msg.type === 'system' ||
          msg.messageType === 'system' ||
          msg.senderType === 'system' ||
          msg.senderId === 'system';

        return {
          ...msg,
          from: isSystem ? 'system' :
            (msg.senderType === "runner" && msg.senderId === runnerId ? "me" : "them"),
          type: msg.type || msg.messageType || 'text',
        };
      });

      setMessages(formattedMsgs);
    };

    socket.on('chatHistory', handleChatHistory);
    socket.on("messageDeleted", handleMessageDeleted);
    socket.on("message", handleIncomingMessage);

    return () => {
      socket.off("messageDeleted", handleMessageDeleted);
      socket.off("message", handleIncomingMessage);
      socket.off('chatHistory', handleChatHistory);
    };
  }, [socket, isChatActive, selectedUser, runnerId, setMessages, uploadingFiles, messages]);

  useEffect(() => {
    if (!socket || !isChatActive) return;

    const handleStatusUpdated = (data) => {
      console.log('Status updated from backend:', data);
    };

    socket.on('statusUpdated', handleStatusUpdated);

    return () => {
      socket.off('statusUpdated', handleStatusUpdated);
    };
  }, [socket, isChatActive]);

  // delete a message
  const handleDeleteMessage = (messageId, deleteForEveryone = false) => {
    if (!selectedUser) return;

    const chatId = `user-${selectedUser._id}-runner-${runnerId}`;

    if (deleteForEveryone) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? {
              ...msg,
              deleted: true,
              text: "This message was deleted",
              type: "deleted",
              fileUrl: null,
              fileName: null,
            }
            : msg
        )
      );

      if (socket && chatId) {
        socket.emit("deleteMessage", {
          chatId,
          messageId,
          userId: runnerId,
          deleteForEveryone: true
        });
      }
    } else {
      // Delete for me only
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? {
              ...msg,
              deletedForMe: true,
              text: "You deleted this message",
              type: "deleted",
              fileUrl: null,
              fileName: null,
            }
            : msg
        )
      );
    }
  };

  // edit a message
  const handleEditMessage = (messageId, newText) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId
          ? { ...msg, text: newText, edited: true }
          : msg
      )
    );
  };

  // react to a message
  const handleMessageReact = (messageId, emoji) => {
    if (!selectedUser) return;

    const chatId = `user-${selectedUser._id}-runner-${runnerId}`;

    setMessages(prev => prev.map(msg =>
      msg.id === messageId
        ? { ...msg, reaction: emoji }
        : msg
    ));

    if (socket && chatId) {
      socket.emit("reactToMessage", {
        chatId,
        messageId,
        emoji,
        userId: runnerId,
      });
    }
  };

  // Reply to message handler
  const handleMessageReply = (message) => {
    setReplyingTo(message);
    setTimeout(() => {
      if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }
    }, 100);
  };

  // cancel reply
  const handleCancelReply = () => {
    setReplyingTo(null);
  };

  const handleScrollToMessage = (messageId) => {
    if (!listRef.current) return;

    const messageElement = document.getElementById(`message-${messageId}`);

    if (messageElement) {
      messageElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });

      messageElement.classList.add('highlight-message');
      setTimeout(() => {
        messageElement.classList.remove('highlight-message');
      }, 2000);
    }
  };

  const handleFileSelect = async (event) => {
    const files = Array.from(event.target.files);

    const chatId = `user-${selectedUser._id}-runner-${runnerId}`;
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB

    for (const file of files) {
      // Validate file size
      if (file.size > MAX_SIZE) {
        alert(`File "${file.name}" is too large. Maximum size is 10MB.`);
        continue;
      }

      // Add to uploading state
      setUploadingFiles(prev => {
        const updated = new Map(prev);
        updated.set(file.name, { file, chatId, status: 'uploading' });
        return updated;
      });

      // Show uploading message
      const uploadingMessage = {
        id: `temp-${Date.now()}-${file.name}`,
        from: "me",
        type: "uploading",
        fileName: file.name,
        fileType: file.type,
        text: `Uploading ${file.name}...`,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "uploading",
      };
      setMessages(prev => [...prev, uploadingMessage]);

      try {
        // Upload file using socket
        await uploadFileWithProgress(file, {
          chatId,
          senderId: runnerId,
          senderType: 'runner'
        });

      } catch (error) {
        console.error('Upload error:', error);

        // Clear from uploading state
        setUploadingFiles(prev => {
          const updated = new Map(prev);
          updated.delete(file.name);
          return updated;
        });
      }
    }

    event.target.value = ""; // Reset input
  };

  const handleAttachClickInternal = () => {
    fileInputRef.current?.click();
  };

  // Helper function to get first letter
  const getFirstLetter = (name) => {
    if (!name) return 'U';
    return name.charAt(0).toUpperCase();
  };

  // WhatsApp-like random background colors
  const getRandomBgColor = (name) => {
    if (!name) return 'bg-green-500';

    const colors = [
      'bg-red-500',
      'bg-orange-500',
      'bg-amber-500',
      'bg-green-500',
      'bg-teal-500',
      'bg-blue-500',
      'bg-indigo-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-rose-500'
    ];

    // Use the first letter to determine a consistent color for each user
    const charCode = name.charCodeAt(0);
    const colorIndex = charCode % colors.length;

    return colors[colorIndex];
  };

  return (
    <section className="flex flex-col min-w-0 overflow-hidden scroll-smooth relative">
      {/* Chat Header */}
      <div className="px-4 py-3 border-b dark:border-white/10 border-gray-200 flex items-center justify-between bg-white/5/10 backdrop-blur-xl">
        <div className="flex items-center gap-3 min-w-0">
          <IconButton variant="text" className="rounded-full lg:hidden" onClick={() => setDrawerOpen(true)}>
            <ChevronLeft className="h-5 w-5" />
          </IconButton>

          <Avatar
            src={selectedUser?.avatar}
            alt={selectedUser ? `${selectedUser?.firstName} ${selectedUser?.lastName || ''}` : "User"}
            size="sm"
            className={`
    ${!selectedUser?.avatar ? `
      flex items-center justify-center
      ${getRandomBgColor(selectedUser?.firstName || 'U')}
      text-white font-bold text-lg
    ` : ''}
  `}
          >
            {!selectedUser?.avatar ? getFirstLetter(selectedUser?.firstName || 'U') : null}
          </Avatar>

          <div className="truncate">
            <div className={`font-bold text-[16px] truncate dark:text-white text-black-200`}>
              {selectedUser
                ? `${selectedUser?.firstName} ${selectedUser?.lastName || ''}`
                : "User"}
            </div>
            <div className="text-sm font-medium text-gray-900">Online</div>
          </div>
        </div>

        <IconButton variant="text" className="rounded-full sm:hidden" onClick={() => setInfoOpen(true)}>
          <Ellipsis className="h-5 w-5" />
        </IconButton>

        <div className="items-center gap-3 hidden sm:flex">
          <span className="bg-gray-1000 dark:bg-black-200 rounded-full w-10 h-10 flex items-center justify-center">
            <HeaderIcon tooltip="Video call"><Video className="h-6 w-6" /></HeaderIcon>
          </span>
          <span className="bg-gray-1000 dark:bg-black-200 rounded-full w-10 h-10 flex items-center justify-center">
            <HeaderIcon tooltip="Voice call"><Phone className="h-6 w-6" /></HeaderIcon>
          </span>
          <span className="bg-gray-1000 dark:bg-black-200 rounded-full w-10 h-10 flex items-center justify-center">
            <HeaderIcon tooltip="More"><MoreHorizontal className="h-6 w-6" /></HeaderIcon>
          </span>
          <div className="hidden lg:block pl-2">
            <div
              onClick={() => setDark(!dark)}
              className="cursor-pointer bg-gray-1000 dark:bg-black-200 rounded-full w-10 h-10 flex items-center justify-center"
            >
              {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5 text-gray-900" strokeWidth={3.0} />}
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={listRef} className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 bg-chat-pattern bg-gray-100 dark:bg-black-200">
        <div className="mx-auto max-w-3xl">
          {messages.map((m) => (
            <Message
              key={m.id}
              m={m}
              onMessageClick={() => { }}
              showCursor={false}
              isChatActive={isChatActive}
              onDelete={handleDeleteMessage}
              onEdit={handleEditMessage}
              onReact={handleMessageReact}
              onReply={handleMessageReply}
              onCancelReply={handleCancelReply}
              messages={messages}
              onScrollToMessage={handleScrollToMessage}
              userType="runner"
            />
          ))}
        </div>
      </div>

      {/* Composer */}
      <div className="bg-gray-100 dark:bg-black-200">
        <ChatComposer
          isChatActive={isChatActive}
          text={text}
          setText={setText}
          selectedUser={selectedUser}
          send={() => send(replyingTo)}
          handleLocationClick={handleLocationClick}
          handleAttachClick={handleAttachClickInternal}
          fileInputRef={fileInputRef}
          replyingTo={replyingTo}
          onCancelReply={handleCancelReply}
          darkMode={dark}
        />

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          className="hidden"
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
          multiple
        />

        {/* OrderStatusFlow */}
        {showOrderFlow && selectedUser && (
          <OrderStatusFlow
            isOpen={showOrderFlow}
            onClose={() => setShowOrderFlow(false)}
            orderData={{
              deliveryLocation: selectedUser?.currentRequest?.deliveryLocation || "No address",
              pickupLocation: selectedUser?.currentRequest?.pickupLocation || "No address",
              userData: selectedUser,
              chatId: `user-${selectedUser?._id}-runner-${runnerId}`,
              runnerId: runnerId,
              userId: selectedUser?._id,
              serviceType: selectedUser?.serviceType
            }}
            darkMode={dark}
            onStatusClick={handleOrderStatusClick}
            completedStatuses={completedOrderStatuses}
            setCompletedStatuses={setCompletedOrderStatuses}
            socket={socket}
            taskType={
              selectedUser?.serviceType === 'pick-up'
                ? 'pickup_delivery'
                : 'shopping'
            }
            onStatusMessage={(systemMessage) => {
              setMessages(prev => [...prev, systemMessage]);
            }}
          />
        )}

        {/* AttachmentOptionsFlow */}
        {isAttachFlowOpen && (
          <AttachmentOptionsFlow
            isOpen={isAttachFlowOpen}
            onClose={() => setIsAttachFlowOpen(false)}
            darkMode={dark}
            onSelectCamera={() => {
              console.log('Open camera functionality');
              setIsAttachFlowOpen(false);
            }}
            onSelectGallery={() => {
              console.log('Open gallery/file picker functionality');
              setIsAttachFlowOpen(false);
            }}
          />
        )}
      </div>
    </section>
  );
}