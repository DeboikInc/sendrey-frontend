import React, { useState, useEffect, useRef } from "react";
import { IconButton, Avatar } from "@material-tailwind/react";
import ChatComposer from "../runnerScreens/chatComposer";
import { X, Send, Camera } from 'lucide-react';
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
import AttachmentOptionsFlow from "./AttachmentOptionsFlow";
import CameraPreviewModal from './CameraPreviewModal';

const HeaderIcon = ({ children, tooltip }) => (
  <IconButton variant="text" size="sm" className="rounded-full">
    {children}
  </IconButton>
);

function RunnerChatScreen({
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

  cameraOpen,
  capturedImage,
  isPreviewOpen,
  openCamera,
  closeCamera,
  capturePhoto,
  retakePhoto,
  openPreview,
  closePreview,
  setIsPreviewOpen,
  videoRef,
  streamRef
}) {
  const listRef = useRef(null);
  const fileInputRef = useRef(null);
  const processedMessageIds = useRef(new Set());

  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadingFiles, setUploadingFiles] = useState(new Map());
  const [uploadProgress, setUploadProgress] = useState(new Map());

  const [showCameraPreview, setShowCameraPreview] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  useEffect(() => {
    if (capturedImage && isPreviewOpen) {
      setPreviewImage(capturedImage);
      setShowCameraPreview(true);
    }
  }, [capturedImage, isPreviewOpen]);

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

    // Define determineMessageFrom OUTSIDE to avoid stale closure
    const determineMessageFrom = (msg) => {
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

    const handleMessageDeleted = ({ messageId, deletedBy }) => {
      console.log(`Message ${messageId} deleted by ${deletedBy}`);

      const isDeletedByMe = deletedBy === runnerId;

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? {
              ...msg,
              deleted: true,
              text: isDeletedByMe ? "You deleted this message" : "This message was deleted",
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
      console.log('📨 Message messageType:', msg.messageType);
      console.log('📨 Is profile-card?', msg.type === 'profile-card' || msg.messageType === 'profile-card');

      // Skip if already processed
      if (processedMessageIds.current.has(msg.id)) {
        console.log('⏭️ Skipping duplicate message:', msg.id);
        return;
      }

      // Mark as processed immediately
      processedMessageIds.current.add(msg.id);

      setMessages((prev) => {
        const exists = prev.some(m => m.id === msg.id);

        // Check if this is an uploading file (use prev state, not stale closure)
        const isUploadingFile = prev.some(m =>
          m.fileName === msg.fileName &&
          m.isUploading &&
          m.from === 'me'
        );

        if (isUploadingFile) {
          console.log('⏭️ Skipping message for currently uploading file:', msg.fileName);
          // Don't add to processedMessageIds since we're skipping it
          processedMessageIds.current.delete(msg.id);
          return prev;
        }

        if (exists) {
          console.log('Message already exists, updating:', msg.id);
          return prev.map(m =>
            m.id === msg.id
              ? {
                ...m,
                ...msg,
                from: determineMessageFrom(msg),
                isUploading: false,
              }
              : m
          );
        }

        // Add new message
        console.log('✅ Adding new message:', msg.id, 'Type:', msg.type, 'MessageType:', msg.messageType);
        const formattedMsg = {
          ...msg,
          from: determineMessageFrom(msg),
          type: msg.type || msg.messageType || 'text',
        };

        return [...prev, formattedMsg];
      });
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
  }, [socket, isChatActive, selectedUser, runnerId, setMessages]);

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
              text: "You deleted this message",
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

  const handleSendPhoto = async (image, replyText) => {
    if (!selectedUser || !runnerId) return;

    try {
      // Convert base64 image to file - FIX: await the fetch
      const base64Response = await fetch(image);
      const blob = await base64Response.blob();
      const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' });

      const chatId = `user-${selectedUser._id}-runner-${runnerId}`;

      // Create temp ID for tracking
      const tempId = `temp-${Date.now()}-photo`;

      // Add uploading message
      const uploadingMessage = {
        id: tempId,
        from: "me",
        type: "image",
        fileName: file.name,
        fileType: 'image/jpeg',
        fileUrl: image,
        text: replyText || '',
        text: replyText || '',
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "uploading",
        senderId: runnerId,
        senderType: "runner",
        isUploading: true,
        tempId: tempId,
        ...(replyingTo && {
          replyTo: replyingTo.id,
          replyToMessage: replyingTo.text || replyingTo.fileName || "Media",
          replyToFrom: replyingTo.from
        })
      };

      setMessages(prev => [...prev, uploadingMessage]);

      // Upload using the same pattern as file upload
      await uploadFileWithProgress(file, {
        chatId,
        senderId: runnerId,
        senderType: 'runner',
        tempId: tempId,
        text: replyText || '',
        type: 'image',
        fileName: file.name,
        ...(replyingTo && {
          replyTo: replyingTo.id,
          replyToMessage: replyingTo.text || replyingTo.fileName || "Media",
          replyToFrom: replyingTo.from
        })
      });

      // Close preview
      setShowCameraPreview(false);
      setPreviewImage(null);
      closePreview();
      setReplyingTo(null);

    } catch (error) {
      console.error('Error sending photo:', error);
      // alert('Failed to send photo. Please try again.');

      // Remove the failed upload message
      // setMessages(prev => prev.filter(msg => msg.tempId !== tempId));

      // Close preview even on error
      setShowCameraPreview(false);
      setPreviewImage(null);
      closePreview();
    }
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
      <div className="flex items-center justify-between gap-3 min-w-0 px-5 py-3">
        <div className="flex gap-3">
          <IconButton variant="text" className="rounded-full lg:hidden" onClick={() => setDrawerOpen(true)}>
            <ChevronLeft className="h-5 w-5" />
          </IconButton>

          {/* Simple avatar solution */}
          <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center">
            {selectedUser?.avatar ? (
              <img
                src={selectedUser.avatar}
                alt={selectedUser ? `${selectedUser.firstName} ${selectedUser.lastName || ''}` : "User"}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className={`
        w-full h-full 
        ${getRandomBgColor(selectedUser?.firstName || 'U')}
        flex items-center justify-center text-white font-bold text-lg
        `}>
                {getFirstLetter(selectedUser?.firstName || 'U')}
              </div>
            )}
          </div>

          <div className="truncate">
            <div className={`font-bold text-[16px] truncate dark:text-white text-black-200`}>
              {selectedUser
                ? `${selectedUser?.firstName} ${selectedUser?.lastName || ''}`
                : "User"}
            </div>
            <div className="text-sm font-medium text-gray-900">Online</div>
          </div>
        </div>


        <div>
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
          setIsAttachFlowOpen={setIsAttachFlowOpen}
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
              setIsAttachFlowOpen(false);
              openCamera();
            }}
            onSelectGallery={() => {
              setIsAttachFlowOpen(false);
              // Create file input for gallery
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = 'image/*,video/*';
              input.multiple = false;

              input.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (e) => {
                    openPreview(e.target.result);
                  };
                  reader.readAsDataURL(file);
                }
              };

              input.click();
            }}
          />
        )}

        {showCameraPreview && previewImage && (
          <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4">
            <div className="w-full max-w-md">
              {/* Header with close button */}
              <div className="flex justify-end mb-4">
                <button
                  onClick={() => {
                    setShowCameraPreview(false);
                    setPreviewImage(null);
                    closePreview();
                    setIsAttachFlowOpen(true);
                  }}
                  className="p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
                >
                  <X className="h-6 w-6 text-white" />
                </button>
              </div>

              {/* Preview Image */}
              <div className="mb-6 rounded-xl overflow-hidden bg-black">
                <img
                  src={previewImage}
                  alt="Preview"
                  className="w-full h-auto max-h-[60vh] object-contain"
                />
              </div>

              {/* Reply Input */}
              <div className={`${dark ? 'bg-gray-800' : 'bg-white'} rounded-xl p-4`}>
                <div className="flex items-center gap-2 mb-3">
                  <input
                    type="text"
                    placeholder="Add a comment..."
                    className={`flex-1 p-3 rounded-lg border ${dark
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                      : 'bg-gray-100 border-gray-300 text-black placeholder-gray-500'
                      } outline-none focus:border-blue-500`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const text = e.target.value;
                        handleSendPhoto(previewImage, text);
                        e.target.value = '';
                      }
                    }}
                  />
                  <button
                    onClick={(e) => {
                      const input = e.target.previousSibling;
                      handleSendPhoto(previewImage, input.value);
                      input.value = '';
                    }}
                    className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Send className="h-5 w-5" />
                  </button>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowCameraPreview(false);
                      retakePhoto();
                    }}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-3 rounded-lg flex items-center justify-center gap-2"
                  >
                    <Camera className="h-4 w-4" />
                    Retake
                  </button>
                  <button
                    onClick={() => {
                      setShowCameraPreview(false);
                      setPreviewImage(null);
                      closePreview();
                      setIsAttachFlowOpen(true);
                    }}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}


      </div>


      {cameraOpen && (
        <div className="fixed inset-0 bg-black z-[9999] flex flex-col">
          {/* Camera header */}
          <div className="flex justify-between items-center p-4 bg-black/80">
            <button
              onClick={() => {
                console.log('Cancel clicked');
                closeCamera();
              }}
              className="text-white px-4 py-2 hover:bg-white/10 rounded-lg"
            >
              Cancel
            </button>
            <h3 className="text-white text-lg font-medium">Take Photo</h3>
            <div className="w-16"></div>
          </div>

          {/* Camera view */}
          <div className="relative bg-black overflow-hidden">
            {!capturedImage ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-screen object-cover"
                  style={{ transform: 'scaleX(-1)' }}
                />

                {/* Capture button */}
                <div className="absolute bottom-2 left-0 right-0 flex justify-center">
                  <button
                    onClick={() => {
                      console.log('Capture clicked');
                      capturePhoto();
                    }}
                    className="w-16 h-16 rounded-full bg-white border-4 border-gray-300 hover:bg-gray-100 shadow-2xl active:scale-95 transition-transform"
                  />
                </div>
              </>
            ) : (
              <>
                <img
                  src={capturedImage}
                  alt="Captured photo"
                  className="w-full h-[78vh] object-contain bg-black"
                />
                {/* Review buttons */}
                <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-4">
                  <button
                    onClick={() => {
                      console.log('Retake clicked');
                      retakePhoto();
                    }}
                    className="px-6 py-3 bg-gray-600 text-white rounded-lg shadow-lg hover:bg-gray-700 active:scale-95 transition-transform"
                  >
                    Retake
                  </button>
                  <button
                    onClick={() => {
                      console.log('Use Photo clicked');
                      const photo = capturedImage;
                      closeCamera();
                      setTimeout(() => {
                        setPreviewImage(photo);
                        setShowCameraPreview(true);
                      }, 100);
                    }}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg shadow-lg hover:bg-blue-700 active:scale-95 transition-transform"
                  >
                    Use Photo
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showCameraPreview && previewImage && (
        <CameraPreviewModal
          isOpen={showCameraPreview}
          onClose={() => {
            setShowCameraPreview(false);
            setPreviewImage(null);
            closePreview();
          }}
          previewImage={previewImage}
          onRetake={() => {
            setShowCameraPreview(false);
            setPreviewImage(null);
            closePreview();
            retakePhoto();
          }}
          onSend={(image, text) => {
            handleSendPhoto(image, text);
            setShowCameraPreview(false);
            setPreviewImage(null);
            closePreview();
          }}
          onCancel={() => {
            setShowCameraPreview(false);
            setPreviewImage(null);
            closePreview();
          }}
          darkMode={dark}
        />
      )}
    </section>
  );
}

export default React.memo(RunnerChatScreen);