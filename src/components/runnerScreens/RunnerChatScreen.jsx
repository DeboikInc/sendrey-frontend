import React, { useState, useEffect, useRef } from "react";
import { IconButton, Avatar, Button } from "@material-tailwind/react";
import ChatComposer from "../runnerScreens/chatComposer";
import { Camera } from "lucide-react";
import {
  Phone,
  Video,
  MoreHorizontal,
  Ellipsis,
  ChevronLeft,
  Sun,
  Moon,
  Bot
} from "lucide-react";
import Message from "../common/Message";
import CustomInput from "../common/CustomInput";
import RunnerNotifications from "./RunnerNotifications";
import OrderStatusFlow from "./OrderStatusFlow";
import AttachmentOptionsFlow from "../common/AttachmentOptionsFlow";
import sendreyBot from "../../assets/sendrey_bot.jpg";

// hooks
import { useCameraHook } from "../../hooks/useCameraHook";

const HeaderIcon = ({ children, tooltip }) => (
  <IconButton variant="text" size="sm" className="rounded-full">
    {children}
  </IconButton>
);

// use React.Memo to prevent unnecessary re-renders

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
  isCollectingCredentials,
  credentialStep,
  credentialQuestions,
  needsOtpVerification,
  registrationComplete,
  canResendOtp,
  send,
  handleMessageClick,
  pickUp,
  runErrand,
  setDrawerOpen,
  setInfoOpen,
  initialMessagesComplete,
  hasSearched,

  // Runner notifications props
  nearbyUsers,
  runnerId,
  onPickService,
  socket,
  isConnected,
  runnerData,

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

  // KYC props
  kycStep,
  setKycStep,
  kycStatus,
  onIdVerified,
  handleIDTypeSelection,
  onSelfieVerified,
  handleSelfieResponse,
  checkVerificationStatus,
  onConnectToService,


  uploadFileWithProgress,
  onFileUploadSuccess,
  onFileUploadError,

}) {
  const listRef = useRef(null);
  const fileInputRef = useRef(null);
  const processedMessageIds = useRef(new Set());

  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadingFiles, setUploadingFiles] = useState(new Map());
  const [uploadProgress, setUploadProgress] = useState(new Map());
  const [replyingTo, setReplyingTo] = useState(null);

  const {
    cameraOpen,
    capturedImage,
    videoRef,
    openCamera,
    closeCamera,
    capturePhoto,
    retakePhoto,
    confirmPhoto
  } = useCameraHook();

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
  }, [messages, kycStep, replyingTo]);


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

    // ADD: Handle incoming messages to prevent duplicates
    const handleIncomingMessage = (msg) => {
      // Skip if already processed
      if (processedMessageIds.current.has(msg.id)) {
        console.log('⏭️ Skipping duplicate message:', msg.id);
        return;
      }

      // Skip file upload success messages (handled separately)
      if (msg.type === 'fileUploadSuccess' || msg.messageType === 'fileUploadSuccess') {
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
        // Check if message already exists
        const exists = prev.some(m => m.id === msg.id);
        if (exists) {
          console.log('Message already exists, updating:', msg.id);
          return prev.map(m =>
            m.id === msg.id
              ? {
                ...m,
                ...msg,
                from: msg.senderId === runnerId ? "me" : "them",
                isUploading: false,
              }
              : m
          );
        }

        // Add new message
        console.log('Adding new message:', msg.id);
        const formattedMsg = {
          ...msg,
          from: msg.from === 'system' ? 'system' :
            (msg.senderId === runnerId ? "me" : "them"),
          type: msg.type || msg.messageType || 'text',
        };

        return [...prev, formattedMsg];
      });
    };

    socket.on("messageDeleted", handleMessageDeleted);
    socket.on("message", handleIncomingMessage);

    return () => {
      socket.off("messageDeleted", handleMessageDeleted);
      socket.off("message", handleIncomingMessage);
    };
  }, [socket, isChatActive, selectedUser, runnerId, setMessages, uploadingFiles, messages]);

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




  useEffect(() => {
    if (registrationComplete && !isChatActive && kycStatus.documentVerified) {

      // Don't proceed if checkVerificationStatus is not a function
      if (typeof checkVerificationStatus !== 'function') {
        console.warn('checkVerificationStatus is not available');
        return;
      }

      const interval = setInterval(() => {
        checkVerificationStatus(setMessages);
      }, 30000);

      // Check immediately on mount
      checkVerificationStatus(setMessages);

      return () => clearInterval(interval);
    }
  }, [registrationComplete, isChatActive, kycStatus.documentVerified, checkVerificationStatus, setMessages]);


  useEffect(() => {
    if (!socket || !isChatActive) return;

    // Listen for successful uploads
    const handleUploadSuccess = (data) => {
      console.log('✅ File uploaded successfully:', data.cloudinaryUrl);

      const newMessage = {
        id: Date.now(),
        from: "me",
        type: "file",
        fileUrl: data.cloudinaryUrl,
        fileName: data.message.fileName,
        fileType: data.message.fileType,
        text: data.message.text || "",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "sent",
        senderId: runnerId,
        senderType: "runner"
      };

      setMessages(prev => [...prev, newMessage]);

      // Remove from uploading state
      setUploadingFiles(prev => {
        const updated = new Map(prev);
        updated.delete(data.message.fileName);
        return updated;
      });

      setUploadProgress(prev => {
        const updated = new Map(prev);
        updated.delete(data.message.fileName);
        return updated;
      });
    };

    // Listen for upload errors
    const handleUploadError = (data) => {
      console.error('❌ File upload failed:', data.error);

      const errorMessage = {
        id: Date.now(),
        from: "system",
        text: `Failed to upload file: ${data.error}`,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "error"
      };

      setMessages(prev => [...prev, errorMessage]);

      // Clear uploading state
      setUploadingFiles(prev => {
        const updated = new Map(prev);
        for (const [key, value] of updated.entries()) {
          if (value.chatId === data.chatId) {
            updated.delete(key);
          }
        }
        return updated;
      });
    };

    onFileUploadSuccess(handleUploadSuccess);
    onFileUploadError(handleUploadError);

    return () => {
      if (socket) {
        socket.off('fileUploadSuccess', handleUploadSuccess);
        socket.off('fileUploadError', handleUploadError);
      }
    };
  }, [socket, isChatActive, onFileUploadSuccess, onFileUploadError, runnerId, setMessages])

  const handleFileSelect = async (event) => {
    const files = Array.from(event.target.files);

    // if (!isChatActive || !selectedUser) {
    //   alert("Please select a chat first");
    //   event.target.value = "";
    //   return;
    // }

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

  const handleRemoveFile = (index) => {
    setSelectedFiles(prev => {
      const newFiles = [...prev];
      // Revoke URL to free memory
      if (newFiles[index].preview) {
        URL.revokeObjectURL(newFiles[index].preview);
      }
      newFiles.splice(index, 1);
      return newFiles;
    });
  };



  // Cleanup on unmount
  useEffect(() => {
    const currentFiles = selectedFiles;
    return () => {
      currentFiles.forEach(f => {
        if (f?.preview) URL.revokeObjectURL(f.preview);
      });
    };
  }, [selectedFiles]);

  const handleAttachClickInternal = () => {
    fileInputRef.current?.click();
  };


  const handleConnectToService = () => {
    const connectMessage = {
      id: Date.now(),
      from: "me",
      text: "Connect to an errand service",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "sent",
    };
    setMessages(prev => [...prev, connectMessage]);

    if (onConnectToService) {
      onConnectToService();
    }
  };


  const handleCancelConnect = () => {
    const cancelMessage = {
      id: Date.now(),
      from: "me",
      text: "Cancel",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "sent",
    };
    setMessages(prev => [...prev, cancelMessage]);

    setTimeout(() => {
      const botMessage = {
        id: Date.now() + 100,
        from: "them",
        text: "Okay, let me know when you're ready to connect!",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "delivered",
      };
      setMessages(prev => [...prev, botMessage]);
    }, 500);
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
            src={isChatActive && selectedUser ? selectedUser?.avatar : active?.avatar || sendreyBot}
            alt={isChatActive && selectedUser ? selectedUser?.firstName : active?.name || "Sendrey Bot"}
            size="sm"
          />

          <div className="truncate">
            <div className={`font-bold text-[16px] truncate dark:text-white text-black-200`}>
              {isChatActive && selectedUser
                ? `${selectedUser?.firstName} ${selectedUser?.lastName || ''}`
                : active?.name || "Welcome"}
            </div>
            <div className="text-sm font-medium text-gray-900">{isChatActive ? "Online" : ""}</div>
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
              canResendOtp={canResendOtp}
              onMessageClick={() => handleMessageClick(m)}
              showCursor={false}

              isChatActive={isChatActive}
              onDelete={handleDeleteMessage}
              onEdit={handleEditMessage}
              onReact={handleMessageReact}
              onReply={handleMessageReply}
              onCancelReply={handleCancelReply}
              messages={messages}
              onScrollToMessage={handleScrollToMessage}
            />
          ))}
        </div>
      </div>

      {/* Composer */}
      <div className="bg-gray-100 dark:bg-black-200">
        <ChatComposer
          isCollectingCredentials={isCollectingCredentials}
          credentialStep={credentialStep}
          credentialQuestions={credentialQuestions}
          needsOtpVerification={needsOtpVerification}
          registrationComplete={registrationComplete}
          isChatActive={isChatActive}
          kycStep={kycStep}
          initialMessagesComplete={initialMessagesComplete}
          text={text}
          setText={setText}
          selectedUser={selectedUser}
          selectedFiles={selectedFiles}
          pickUp={pickUp}
          runErrand={runErrand}
          send={() => send(replyingTo)}
          openCamera={openCamera}
          handleIDTypeSelection={handleIDTypeSelection}
          handleSelfieResponse={handleSelfieResponse}
          handleLocationClick={handleLocationClick}
          handleAttachClick={handleAttachClick}
          onRemoveFile={handleRemoveFile}
          fileInputRef={fileInputRef}
          handleConnectToService={handleConnectToService}
          handleCancelConnect={handleCancelConnect}
          setMessages={setMessages}
          uploadingFiles={uploadingFiles}
          uploadProgress={uploadProgress}
          replyingTo={replyingTo} //
          onCancelReply={handleCancelReply}
          darkMode={dark}
        />

        {/* RunnerNotifications */}
        {registrationComplete && !isChatActive && kycStep === 0 && hasSearched && (
          <RunnerNotifications
            requests={nearbyUsers}
            runnerId={runnerId}
            darkMode={dark}
            onPickService={onPickService}
            socket={socket}
            isConnected={isConnected}
            onClose={() => setKycStep(6)}
          />
        )}

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
              userId: selectedUser?._id
            }}
            darkMode={dark}
            onStatusClick={handleOrderStatusClick}
            completedStatuses={completedOrderStatuses}
            setCompletedStatuses={setCompletedOrderStatuses}
            socket={socket}
            taskType={selectedUser?.taskType}
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


      {cameraOpen && (
        <div className="fixed inset-0 bg-black z-[9999] flex flex-col">
          {/* Camera header */}
          <div className="flex justify-between items-center p-4 bg-black/80">
            <button onClick={closeCamera} className="text-white px-4 py-2">
              Cancel
            </button>
            <h3 className="text-white">Take ID Photo</h3>
            <div className="w-16"></div>
          </div>

          {/* Camera view with overlaid controls */}
          <div className="h-[75vh] relative bg-black">
            {!capturedImage ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              </>
            ) : (
              <>
                <img
                  src={capturedImage}
                  alt="Captured ID"
                  className="w-full h-full object-contain bg-black"
                />
                {/* Review buttons overlaid on preview */}
                <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-4">
                  <button
                    onClick={retakePhoto}
                    className="px-6 py-3 bg-gray-600 text-white rounded-lg shadow-lg"
                  >
                    Retake
                  </button>
                  <button
                    onClick={() => {
                      const photo = confirmPhoto();
                      if (photo) {
                        if (kycStep === 2) {
                          onIdVerified(photo, setMessages);
                        } else if (kycStep === 5) {
                          onSelfieVerified(photo, setMessages);
                        }
                      }
                    }}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg shadow-lg"
                  >
                    Use Photo
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Bottom black section with capture button */}
          <div className="flex-1 bg-black flex justify-center items-center p-4">
            <button
              onClick={capturePhoto}
              className="w-16 h-16 rounded-full bg-white border-4 border-gray-300 hover:bg-gray-100 shadow-2xl"
            />
          </div>
        </div>
      )}
    </section>
  );
}