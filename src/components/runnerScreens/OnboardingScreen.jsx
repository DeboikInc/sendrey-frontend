import React, { useState, useEffect, useRef } from "react";
import { IconButton, Avatar, Button } from "@material-tailwind/react";
import { Camera } from "lucide-react";
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
import ChatComposer from "../runnerScreens/chatComposer";
import RunnerNotifications from "./RunnerNotifications"; // ADD THIS
import sendreyBot from "../../assets/sendrey_bot.jpg";

// hooks
import { useCameraHook } from "../../hooks/useCameraHook";

const HeaderIcon = ({ children, tooltip }) => (
  <IconButton variant="text" size="sm" className="rounded-full">
    {children}
  </IconButton>
);

function OnboardingScreen({
  active,
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
  runnerId,

  // KYC props
  kycStep,
  kycStatus,
  onIdVerified,
  handleIDTypeSelection,
  onSelfieVerified,
  handleSelfieResponse,
  checkVerificationStatus,
  onConnectToService,

  // Notifications
  nearbyUsers,
  onPickService,
  socket,
  isConnected,
  runnerData,
  canShowNotifications,
  hasSearched,

  replyingTo,
  setReplyingTo,
}) {
  const listRef = useRef(null);

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

  // State for showing notifications
  const [showNotifications, setShowNotifications] = useState(false);
   const [isOpen,setIsOpen] = useState(false)
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
    if (registrationComplete && !kycStatus.documentVerified) {
      if (typeof checkVerificationStatus !== 'function') {
        console.warn('checkVerificationStatus is not available');
        return;
      }

      const interval = setInterval(() => {
        checkVerificationStatus(setMessages);
      }, 30000);

      checkVerificationStatus(setMessages);

      return () => clearInterval(interval);
    }
  }, [registrationComplete, kycStatus.documentVerified, checkVerificationStatus, setMessages]);

  // Handle connect to service - show notifications
  const handleConnectToService = () => {
    const connectMessage = {
      id: Date.now(),
      from: "me",
      text: "Connect to an errand service",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "sent",
    };
    setMessages(prev => [...prev, connectMessage]);

    // Show notifications
    setShowNotifications(true);

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

  // Handle pick service from notifications
  const handlePickServiceFromNotification = (user) => {
    // Close notifications
    setShowNotifications(false);

    // Call the parent handler
    if (onPickService) {
      onPickService(user);
    }
  };

  // Close notifications
  const handleCloseNotifications = () => {
    setShowNotifications(false);
  };
  return (
    <section className="flex flex-col min-w-0 overflow-hidden scroll-smooth relative">
      {/* Chat Header */}
      <div className="px-5 py-3 border-b dark:border-white/10 border-gray-200 flex items-center justify-between bg-white/5/10 backdrop-blur-xl">
        <div className="flex items-center gap-3 min-w-0">
          <IconButton variant="text" className="rounded-full lg:hidden" onClick={() => setDrawerOpen(true)}>
            <ChevronLeft className="h-5 w-5" />
          </IconButton>

          <Avatar
            src={sendreyBot}
            alt="Sendrey Bot"
            size="sm"
          />

          <div className="truncate">
            <div className={`font-bold text-[16px] truncate dark:text-white text-black-200`}>
              Sendrey Assistant
            </div>
            <div className="text-sm font-medium text-gray-900">Online</div>
          </div>
        </div>

        <IconButton variant="text" className="rounded-full sm:hidden" onClick={() => setInfoOpen(true)}>
          <Ellipsis className="h-5 w-5" />
        </IconButton>

        <div className="hidden lg:block pl-2">
          <div
            onClick={() => setDark(!dark)}
            className="cursor-pointer bg-gray-1000 dark:bg-black-200 rounded-full w-10 h-10 flex items-center justify-center"
          >
            {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5 text-gray-900" strokeWidth={3.0} />}
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
              userType="runner"
              disableContextMenu={true}
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
          isChatActive={false}
          kycStep={kycStep}
          initialMessagesComplete={initialMessagesComplete}
          text={text}
          setText={setText}
          pickUp={pickUp}
          runErrand={runErrand}
          send={() => send(replyingTo)}
          openCamera={openCamera}
          handleIDTypeSelection={handleIDTypeSelection}
          handleSelfieResponse={handleSelfieResponse}
          handleConnectToService={handleConnectToService}
          handleCancelConnect={handleCancelConnect}
          setMessages={setMessages}
          replyingTo={replyingTo}
          onCancelReply={() => setReplyingTo(null)}
          darkMode={dark}
        />
      </div>

      {/* RunnerNotifications - Show when user clicks "Connect to an errand service" */}
      {showNotifications && nearbyUsers && nearbyUsers.length > 0 && (
        <RunnerNotifications
          requests={nearbyUsers}
          runnerId={runnerId}
          darkMode={dark}
          onPickService={handlePickServiceFromNotification}
          socket={socket}
          isConnected={isConnected}
          onClose={handleCloseNotifications}
        />
      )}

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

export default React.memo(OnboardingScreen);