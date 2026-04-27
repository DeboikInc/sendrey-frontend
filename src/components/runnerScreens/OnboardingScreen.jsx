/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Avatar, Button } from "@material-tailwind/react";
import Message from "../common/Message";
import ChatComposer from "./chatComposer";
import RunnerNotifications from "./RunnerNotifications";
import sendreyBot from "../../assets/sendrey_bot.jpg";
import { FaWalking, FaMotorcycle } from "react-icons/fa";
import { Bike, Car, Truck, RefreshCw, Sun, Moon } from "lucide-react";
import { useCameraHook } from "../../hooks/useCameraHook";

const FLEET_OPTIONS = [
  { type: "cycling", icon: Bike, label: "Cycling" },
  { type: "car", icon: Car, label: "Car" },
  { type: "van", icon: Truck, label: "Van" },
  { type: "pedestrian", icon: FaWalking, label: "Pedestrian" },
  { type: "bike", icon: FaMotorcycle, label: "Bike" },
];

function OnboardingScreen({
  initialMessages,
  onMessagesChange,
  onRegisterSetMessages,
  active,
  text, setText,
  dark, setDark,
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
  kycStep, kycStatus,
  onIdVerified, handleIDTypeSelection, onSelfieVerified,
  handleSelfieResponse, checkVerificationStatus,
  onConnectToService,
  nearbyUsers, onPickService,
  socket, isConnected, reconnect,
  runnerData,
  canShowNotifications,
  hasSearched,
  replyingTo, setReplyingTo,
  currentOrder,
  verificationState,
  isConnectLocked,
  handleCredentialAnswer,
  runnerLocation,
  onFindMore,
  onStartNewOrder,
  onNewOrderFleetAndServiceSelected,
  newOrderTrigger,
  newOrderComplete,
  onSetNewOrderComplete,
  botRefreshTrigger,
  onBannedDetected,
  isVerified,

  isReturningUser,
  onReturningUserChoice,
  returningUserData,
  isVerifyingOtp
}) {

  // ADD at the top of OnboardingScreen function, after the props destructure:
  const renderCountOS = useRef(0);
  renderCountOS.current += 1;
  const prevOSProps = useRef({});

  const osTrack = {
    registrationComplete,
    isCollectingCredentials,
    needsOtpVerification,
    kycStep,
    isReturningUser,
    initialMessagesLength: initialMessages?.length,
    runnerId,
  };
  const osChanged = Object.entries(osTrack)
    .filter(([k, v]) => prevOSProps.current[k] !== v)
    .map(([k, v]) => `${k}: ${JSON.stringify(prevOSProps.current[k])} → ${JSON.stringify(v)}`).join(' | ');
  if (osChanged) console.log(`[OS] render #${renderCountOS.current} — changed: ${osChanged}`);
  prevOSProps.current = osTrack;

  const listRef = useRef(null);
  const connectMessageSentRef = useRef(false);
  // const lastNewOrderTriggerRef = useRef(newOrderTrigger);
  const onMessagesChangeRef = useRef(onMessagesChange);
  const kycPollStartedRef = useRef(false);
  const isSyncingFromParent = useRef(false);
  const mountedRef = useRef(true);

  const [messages, setMessages] = useState(initialMessages || []);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isSubmitting] = useState(false);
  const [isUpdatingServer] = useState(false);

  // trust the prop, which WhatsAppLikeChat reads fresh from manager
  const syncedNewOrderComplete = newOrderComplete;

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!botRefreshTrigger) return;
    // Force composer re-evaluation by bumping local render counter
    setMessages(prev => [...prev]);
  }, [botRefreshTrigger]);

  useEffect(() => {
    onMessagesChangeRef.current = onMessagesChange;
  }, [onMessagesChange]);

  // Register parent push — uses raw setMessages to avoid sync loop
  useEffect(() => {
    if (!onRegisterSetMessages) return;

    const pushFromParent = (updater) => {
      isSyncingFromParent.current = true;
      setMessages(prev => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        return next;
      });
      queueMicrotask(() => { isSyncingFromParent.current = false; });
    };

    onRegisterSetMessages(pushFromParent, 'sendrey-bot');
  }, [onRegisterSetMessages]);

  // KEY FIX: call onMessagesChange OUTSIDE the setMessages updater
  const setMessagesAndSync = useCallback((updater) => {
    setMessages(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;

      if (!isSyncingFromParent.current && onMessagesChangeRef.current && mountedRef.current) {
        queueMicrotask(() => {
          if (mountedRef.current) onMessagesChangeRef.current(next);
        });
      }

      return next;
    });
  }, []);

  const { cameraOpen, capturedImage, videoRef, openCamera, closeCamera,
    capturePhoto, retakePhoto, confirmPhoto, switchCamera } = useCameraHook();

  // Scroll to bottom
  useEffect(() => {
    if (listRef.current && messages.length > 0) {
      const t = setTimeout(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
      }, 100);
      return () => clearTimeout(t);
    }
  }, [messages, replyingTo]);

  useEffect(() => {
    console.log('[kyc poll] effect triggered', {
      registrationComplete,
      overallVerified: kycStatus.overallVerified,
      kycPollStarted: kycPollStartedRef.current,
      checkVerificationStatusType: typeof checkVerificationStatus,
    });

    if (!registrationComplete) { console.log('[kyc poll] blocked: not registered'); return; }
    if (kycStatus.overallVerified) { console.log('[kyc poll] blocked: already verified'); return; }
    if (kycPollStartedRef.current) { console.log('[kyc poll] blocked: already started'); return; }
    if (typeof checkVerificationStatus !== 'function') { console.log('[kyc poll] blocked: not a function'); return; }

    // if (kycStep === null || kycStep < 2 || kycStep === 6) {
    //   console.log('[kyc poll] blocked: kycStep not in pollable range', { kycStep });
    //   return;
    // }

    console.log('[kyc poll] starting poll');
    const handleBanned = () => onBannedDetected?.();

    kycPollStartedRef.current = true;
    checkVerificationStatus(setMessagesAndSync, handleBanned);
    const interval = setInterval(() => {
      console.log('[kyc poll] polling...');
      if (!registrationComplete) {
        clearInterval(interval);
        return;
      }
      checkVerificationStatus(setMessagesAndSync, handleBanned);
    }, 30000);
    return () => {
      clearInterval(interval);
      kycPollStartedRef.current = false;
    };
  }, [registrationComplete, kycStatus.overallVerified]);

  useEffect(() => {
    if (kycStep === null) {
      kycPollStartedRef.current = false;
    }
  }, [kycStep]);

  // Handle new order trigger
  const lastNewOrderTriggerRef = useRef(newOrderTrigger);
  useEffect(() => {
    if (newOrderTrigger === 0) return;
    if (newOrderTrigger === lastNewOrderTriggerRef.current) return;
    lastNewOrderTriggerRef.current = newOrderTrigger;
    connectMessageSentRef.current = false;
    onSetNewOrderComplete(true);
  }, [newOrderTrigger]);



  const handleConnectToService = () => {
    if (!connectMessageSentRef.current) {
      setMessagesAndSync(prev => [...prev, {
        id: Date.now(), from: "me", text: "Connect to an errand service",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), status: "sent",
      }]);
      connectMessageSentRef.current = true;
    }
    setShowNotifications(true);
    onConnectToService?.();
  };

  const handleCancelConnect = () => {
    connectMessageSentRef.current = false;
    setMessagesAndSync(prev => [...prev, {
      id: Date.now(), from: "me", text: "Cancel",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), status: "sent",
    }]);
    setTimeout(() => {
      setMessagesAndSync(prev => [...prev, {
        id: Date.now() + 100, from: "them",
        text: "Okay, let me know when you're ready to connect!",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), status: "delivered",
      }]);
    }, 500);
  };

  const handlePickServiceFromNotification = (user, specialInstructions, order) => {
    console.log('[OS] ========== handlePickServiceFromNotification ==========');
    console.log('[OS] user._id:', user?._id);
    console.log('[OS] runnerId:', runnerId);
    setShowNotifications(false);
    onPickService?.(user, specialInstructions, order);
    console.log('[OS] onPickService called');
  };

  return (
    <>

      <section className="flex flex-col min-w-0 h-full overflow-hidden scroll-smooth relative">
        {/* Header */}
        <div className="px-5 py-3 border-b dark:border-white/10 border-gray-200 flex items-center justify-between bg-white/5/10 backdrop-blur-xl">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar src={sendreyBot} alt="Sendrey Bot" size="sm" />
            <div className="truncate">
              <div className="font-bold text-[16px] truncate dark:text-white text-black-200">Sendrey Assistant</div>
              <div className="text-sm font-medium text-gray-900">Online</div>
            </div>
          </div>
          <div className="hidden lg:flex">
            <div onClick={() => setDark(!dark)} className="cursor-pointer bg-gray-1000 dark:bg-black-200 rounded-full w-10 h-10 flex items-center justify-center">
              {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5 text-gray-900" strokeWidth={3.0} />}
            </div>
          </div>
        </div>

        {/* Messages */}
        <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-6 py-4 bg-chat-pattern bg-gray-100 dark:bg-black-200">
          <div className="mx-auto max-w-3xl">
            {messages.map((m) => (
              <Message
                key={m.id}
                m={m}
                canResendOtp={registrationComplete ? false : canResendOtp}
                isActiveResend={registrationComplete ? false : canResendOtp}
                onMessageClick={() => handleMessageClick(m)}
                showCursor={false}
                userType="runner"
                disableContextMenu={true}
              />
            ))}
          </div>
        </div>


        {/* Registration fleet selection */}
        { isCollectingCredentials &&
          credentialStep !== null &&
          credentialQuestions[credentialStep]?.isFleetSelection &&
          !isSubmitting && (
            <div className="flex gap-2 justify-center mb-4 p-3 bg-gray-100 dark:bg-black-200">
              {FLEET_OPTIONS.map(({ type, icon: Icon, label }) => (
                <Button key={type} variant="outlined"
                  className="flex flex-col p-3 justify-center items-center"
                  onClick={() => handleCredentialAnswer(type, setText, setMessagesAndSync)}>
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
              isSubmitting={isSubmitting}
              isVerifyingOtp={isVerifyingOtp}
              isReturningUser={isReturningUser}
              returningUserData={returningUserData}
              onReturningUserChoice={onReturningUserChoice}
              isVerified={isVerified}
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
              setMessages={setMessagesAndSync}
              replyingTo={replyingTo}
              onCancelReply={() => setReplyingTo(null)}
              darkMode={dark}
              verificationState={verificationState}
              isConnectLocked={isConnectLocked}
              onKycFileUpload={(imageData) => onIdVerified(imageData, setMessagesAndSync)}
              newOrderComplete={syncedNewOrderComplete}
              // onServiceChoice={handleServiceChoice}
              isUpdatingServer={isUpdatingServer}
            />
          </div>
        )}

        {showNotifications && nearbyUsers?.length > 0 && (
          <RunnerNotifications
            requests={nearbyUsers}
            runnerId={runnerId}
            darkMode={dark}
            onPickService={handlePickServiceFromNotification}
            socket={socket}
            isConnected={isConnected}
            onClose={() => setShowNotifications(false)}
            currentOrder={currentOrder}
            runnerLocation={runnerLocation}
            reconnect={reconnect}
            onFindMore={onFindMore}
          />
        )}

        {/* Camera for KYC */}
        {cameraOpen && (
          <div className="fixed inset-0 bg-black z-[9999] flex flex-col overflow-hidden">
            <div className="flex justify-between items-center p-4 bg-black/80 flex-shrink-0">
              <Button onClick={closeCamera} className="text-white px-4 py-2">Cancel</Button>
              <h3 className="text-white">Take ID Photo</h3>
              <div className="w-16" />
            </div>
            <div className="flex-1 relative bg-black min-h-0 flex flex-col">
              {!capturedImage ? (
                <div className="flex-1 relative bg-black min-h-0">
                  <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />
                </div>
              ) : (
                <div className="flex-1 relative bg-black min-h-0">
                  <img src={capturedImage} alt="Captured ID" className="absolute inset-0 w-full h-full object-contain bg-black" />
                  <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-4 z-10">
                    <Button onClick={retakePhoto} className="px-6 py-3 bg-gray-600 text-white rounded-lg shadow-lg">Retake</Button>
                    <Button
                      onClick={() => {
                        const photo = confirmPhoto();
                        if (photo) {
                          if (kycStep === 2) onIdVerified(photo, setMessagesAndSync);
                          else if (kycStep === 5) onSelfieVerified(photo, setMessagesAndSync);
                        }
                      }}
                      className="px-6 py-3 bg-blue-600 text-white rounded-lg shadow-lg"
                    >
                      Use Photo
                    </Button>
                  </div>
                </div>
              )}
            </div>
            <div className="gap-3 flex-shrink-0 bg-black flex justify-center items-center p-4">
              <Button onClick={capturePhoto} className="w-16 h-16 rounded-full bg-white border-4 border-gray-300 hover:bg-gray-100 shadow-2xl active:scale-95 transition-transform" />
              <Button onClick={switchCamera} className="text-white px-3 py-2"><RefreshCw /></Button>
            </div>
          </div>
        )}
      </section>
    </>
  );
}

export default React.memo(OnboardingScreen);