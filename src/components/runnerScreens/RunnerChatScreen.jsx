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
  kycStatus,
  onIdVerified,
  handleIDTypeSelection,
  onSelfieVerified,
  handleSelfieResponse,
  checkVerificationStatus,
  onConnectToService,

}) {
  const listRef = useRef(null);
  const fileInputRef = useRef(null);

  const [selectedFiles, setSelectedFiles] = useState([]);

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
    if (listRef.current) {
      const timeoutId = setTimeout(() => {
        listRef.current.scrollTo({
          top: listRef.current.scrollHeight,
          behavior: "smooth",
        });
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [messages, kycStep]);


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

  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files);

    const filesWithPreview = files.map(file => ({
      file,
      name: file.name,
      type: file.type,
      size: file.size,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null
    }));

    setSelectedFiles(prev => [...prev, ...filesWithPreview]);
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

  const handleSendFiles = () => {
    if (selectedFiles.length === 0) return;

    selectedFiles.forEach(fileData => {
      const { file, preview, name, size, type } = fileData;

      let messageType = "file";
      if (type.startsWith("image/")) messageType = "image";
      else if (type.startsWith("audio/")) messageType = "audio";
      else if (type.startsWith("video/")) messageType = "video";

      const fileSize = size < 1024 * 1024
        ? `${(size / 1024).toFixed(1)} KB`
        : `${(size / (1024 * 1024)).toFixed(1)} MB`;

      const fileMsg = {
        id: Date.now() + Math.random(),
        from: "me",
        type: messageType,
        fileName: name,
        fileUrl: preview,
        fileSize: fileSize,
        text: messageType === "image" ? "" : `File: ${name}`,
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit"
        }),
        status: "sent",
        senderId: runnerId,
        senderType: "runner",
        file: file
      };

      // Use your existing send function
      send("file", fileMsg);
    });

    // Clear files
    selectedFiles.forEach(f => URL.revokeObjectURL(f.preview));
    setSelectedFiles([]);
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
          send={send}
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
        />

        {/* RunnerNotifications */}
        {registrationComplete && !isChatActive && kycStep === 0 && (
          <RunnerNotifications
            requests={nearbyUsers}
            runnerId={runnerId}
            darkMode={dark}
            onPickService={onPickService}
            socket={socket}
            isConnected={isConnected}
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