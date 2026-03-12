import React, { useState, useEffect, useRef } from "react";
import { Avatar, Button } from "@material-tailwind/react";
import Message from "../common/Message";
import { Sun, Moon } from "lucide-react";
import ChatComposer from "./chatComposer";
import RunnerNotifications from "./RunnerNotifications";
import sendreyBot from "../../assets/sendrey_bot.jpg";
import BannedModal from './BannedModal';
import StartNewOrder from './StartNewOrder';

import { FaWalking, FaMotorcycle } from "react-icons/fa";
import { Bike, Car, Truck, } from "lucide-react";

// hooks
import { useCameraHook } from "../../hooks/useCameraHook";

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

  currentOrder,
  setShowBannedModal,
  verificationState,
  showBannedModal,
  isConnectLocked,

  // StartNewOrder props
  isStartingNewOrder,
  onStartNewOrderComplete,
  onUpdateProfile,
  handleCredentialAnswer,
  isSubmitting,
  runnerLocation
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

  const [showNotifications, setShowNotifications] = useState(false);

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

  const handleConnectToService = () => {
    const connectMessage = {
      id: Date.now(),
      from: "me",
      text: "Connect to an errand service",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "sent",
    };
    setMessages(prev => [...prev, connectMessage]);
    setShowNotifications(true);
    if (onConnectToService) onConnectToService();
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
      setMessages(prev => [...prev, {
        id: Date.now() + 100,
        from: "them",
        text: "Okay, let me know when you're ready to connect!",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "delivered",
      }]);
    }, 500);
  };

  const handlePickServiceFromNotification = (user, specialInstructions, order) => {
    setShowNotifications(false);
    if (onPickService) onPickService(user, specialInstructions, order);
  };

  const handleCloseNotifications = () => setShowNotifications(false);

  return (
    <>
      <BannedModal
        isOpen={showBannedModal}
        reason={verificationState?.reason}
        darkMode={dark}
      />

      <section className="flex flex-col min-w-0 overflow-hidden scroll-smooth relative">
        {/* Header */}
        <div className="px-5 py-3 border-b dark:border-white/10 border-gray-200 flex items-center justify-between bg-white/5/10 backdrop-blur-xl">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar src={sendreyBot} alt="Sendrey Bot" size="sm" />
            <div className="truncate">
              <div className="font-bold text-[16px] truncate dark:text-white text-black-200">
                Sendrey Assistant
              </div>
              <div className="text-sm font-medium text-gray-900">Online</div>
            </div>
          </div>
          <div className="hidden lg:flex">
            <div onClick={() => setDark(!dark)} className="cursor-pointer bg-gray-1000 dark:bg-black-200 rounded-full w-10 h-10 flex items-center justify-center">
              {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5 text-gray-900" strokeWidth={3.0} />}
            </div>
          </div>
        </div>

        {/* ── StartNewOrder flow OR normal onboarding ── */}
        {isStartingNewOrder ? (
          <StartNewOrder
            runnerData={runnerData}
            dark={dark}
            onComplete={onStartNewOrderComplete}
            onUpdateProfile={onUpdateProfile}
          />
        ) : (
          <>
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

            {isCollectingCredentials && credentialStep !== null && 
              credentialQuestions[credentialStep]?.isFleetSelection && !isSubmitting && (
                <div className="flex gap-2 justify-center mb-4 p-3 bg-gray-100 dark:bg-black-200">
                  {[
                    { type: "cycling", icon: Bike, label: "Cycling" },
                    { type: "car", icon: Car, label: "Car"},
                    { type: "van", icon: Truck, label: "Van"},
                    { type: "pedestrian", icon: FaWalking, label: "Pedestrian" },
                    { type: "bike", icon: FaMotorcycle,  label: "Bike"}
                  ].map(({ type, icon: Icon, label}) => (
                    <Button
                      key={type}
                      variant="outlined"
                      className="flex flex-col p-3 justify-center items-center"
                      onClick={() => handleCredentialAnswer(type, setText, setMessages)}
                    >
                      <Icon className="text-2xl" />
                      <span className="text-[10px] capitalize">{label}</span>
                    </Button>
                  ))}
                </div>
              )}

            {/* Composer */}
            {!(isCollectingCredentials && !isSubmitting && credentialStep !== null && credentialQuestions[credentialStep]?.isFleetSelection) && (
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
                  verificationState={verificationState}
                  isConnectLocked={isConnectLocked}

                  onKycFileUpload={(imageData) => {
                    // treat same as captured ID photo — goes to KYC flow directly
                    onIdVerified(imageData, setMessages);
                  }}
                />
              </div>
            )}

            {/* Notifications */}
            {showNotifications && nearbyUsers && nearbyUsers.length > 0 && (
              <RunnerNotifications
                requests={nearbyUsers}
                runnerId={runnerId}
                darkMode={dark}
                onPickService={handlePickServiceFromNotification}
                socket={socket}
                isConnected={isConnected}
                onClose={handleCloseNotifications}
                currentOrder={currentOrder}
                runnerLocation={runnerLocation}
              />
            )}
          </>
        )}

        {/* Camera — always available regardless of flow */}
        {cameraOpen && (
          <div className="fixed inset-0 bg-black z-[9999] flex flex-col">
            <div className="flex justify-between items-center p-4 bg-black/80">
              <Button onClick={closeCamera} className="text-white px-4 py-2">Cancel</Button>
              <h3 className="text-white">Take ID Photo</h3>
              <div className="w-16"></div>
            </div>

            <div className="h-[75vh] relative bg-black">
              {!capturedImage ? (
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              ) : (
                <>
                  <img src={capturedImage} alt="Captured ID" className="w-full h-full object-contain bg-black" />
                  <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-4">
                    <Button onClick={retakePhoto} className="px-6 py-3 bg-gray-600 text-white rounded-lg shadow-lg">
                      Retake
                    </Button>
                    <Button
                      onClick={() => {
                        const photo = confirmPhoto();
                        if (photo) {
                          if (kycStep === 2) onIdVerified(photo, setMessages);
                          else if (kycStep === 5) onSelfieVerified(photo, setMessages);
                        }
                      }}
                      className="px-6 py-3 bg-blue-600 text-white rounded-lg shadow-lg"
                    >
                      Use Photo
                    </Button>
                  </div>
                </>
              )}
            </div>

            <div className="flex-1 bg-black flex justify-center items-center p-4">
              <Button onClick={capturePhoto} className="w-16 h-16 rounded-full bg-white border-4 border-gray-300 hover:bg-gray-100 shadow-2xl" />
            </div>
          </div>
        )}
      </section>
    </>
  );
}

export default React.memo(OnboardingScreen);