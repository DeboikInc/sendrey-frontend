// components/runner/ChatComposer
import { Button } from "@material-tailwind/react";
import { Camera } from "lucide-react";
import CustomInput from "../common/CustomInput";
import { useState, useRef } from "react";

export default function ChatComposer({
  // State
  isCollectingCredentials,
  credentialStep,
  credentialQuestions,
  needsOtpVerification,
  registrationComplete,
  isChatActive,
  kycStep,
  initialMessagesComplete,
  text,
  setText,
  selectedUser,
  selectedFiles,
  replyingTo,
  darkMode,

  // Handlers
  pickUp,
  runErrand,
  send,
  openCamera,
  handleIDTypeSelection,
  handleSelfieResponse,
  handleLocationClick,
  handleAttachClick,
  onRemoveFile,
  fileInputRef,
  isSearching,
  handleConnectToService,
  handleCancelConnect,
  setMessages,
  onCancelReply,
  handleAttachFlowClick,
  setIsAttachFlowOpen,

  handleTextChange,
  handleKeyDown,
  verificationState,
  currentOrder,
  onKycFileUpload
}) {
  const [isPickUpDisabled, setIsPickUpDisabled] = useState(false);
  const [isConnectDisabled, setIsConnectDisabled] = useState(false);
  const [isRunErrandDisabled, setIsRunErrandDisabled] = useState(false);
  const [isLetsGetStarted, setIsLetsGetStarted] = useState(false);
  const [isNotNow, setIsNotNow] = useState(false);
  const kycFileInputRef = useRef(null);

  const handlePickUp = () => {
    if (isPickUpDisabled) return;
    pickUp();
    setIsPickUpDisabled(true);
  };

  const handleConnect = () => {
    if (isConnectDisabled || isSearching) return;
    // disable
    setIsConnectDisabled(true);

    handleConnectToService();

    // Re-enable after parent completes (3 sec safety)
    setTimeout(() => {
      setIsConnectDisabled(false);
    }, 3000);
  };

  const handleRunErrand = () => {
    if (isRunErrandDisabled) return;
    runErrand();
    setIsRunErrandDisabled(true);
  }

  const handleGetStarted = () => {
    if (isLetsGetStarted) return;

    const okayMessage = {
      id: Date.now(),
      from: "me",
      text: "Okay, let's get started",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "sent",
    };
    setMessages(prev => [...prev, okayMessage]);

    handleSelfieResponse('okay', setMessages);
    setIsLetsGetStarted(true);
  }

  const handleNotNow = () => {
    if (isNotNow) return;

    const notNowMessage = {
      id: Date.now(),
      from: "me",
      text: "Not now",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "sent",
    };
    setMessages(prev => [...prev, notNowMessage]);

    handleSelfieResponse('not_now', setMessages);
    setIsNotNow(true);
  }

  // Initial state - Pick Up / Run Errand buttons
  if (!isCollectingCredentials && !needsOtpVerification && !registrationComplete && !isChatActive && !kycStep && initialMessagesComplete) {
    return (
      <div className="flex gap-5 p-4">
        <Button onClick={handlePickUp}
          className={`bg-secondary rounded-lg w-full h-14 sm:text-lg ${isPickUpDisabled ? 'bg-gray-500 opacity-50 cursor-not-allowed' : ''}`}>
          Pick Up
        </Button>
        <Button onClick={handleRunErrand} className={`bg-primary rounded-lg w-full sm:text-lg ${isRunErrandDisabled ? 'bg-gray-500 opacity-50 cursor-not-allowed' : ''}`}>
          Run Errand
        </Button>
      </div>
    );
  }

  // Credential collection input
  // OTP verification input — separate from credential collection
  if (needsOtpVerification) {
    return (
      <div className="px-4 py-10">
        <CustomInput
          showMic={false}
          send={send}
          showIcons={false}
          showEmojis={false}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Enter OTP e.g. 09726"
        />
      </div>
    );
  }

  // Credential collection input
  if (isCollectingCredentials && credentialStep !== null) {
    return (
      <div className="px-4 py-10">
        <CustomInput
          showMic={false}
          send={send}
          showIcons={false}
          showEmojis={false}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Your ${credentialQuestions[credentialStep]?.field}...`}
        />
      </div>
    );
  }

  // KYC Step 1 - Processing
  if (registrationComplete && !isChatActive && kycStep === 1) {
    return null;
  }

  // KYC Step 4 - ID Type Selection
  if (registrationComplete && !isChatActive && kycStep === 4) {
    return (
      <div className="p-4 grid grid-cols-2 gap-3">
        {['NIN', "Driver's License"].map((label) => (
          <Button
            key={label}
            onClick={() => {
              let choice;
              if (label === "NIN") {
                choice = 'nin';
              } else if (label === "Driver's License") {
                choice = 'driverLicense';
              }

              const message = {
                id: Date.now(),
                from: "me",
                text: label,
                time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                status: "sent",
              };
              setMessages(prev => [...prev, message]);
              handleIDTypeSelection(choice, setMessages);
            }}
            className="bg-primary rounded-lg py-3"
          >
            {label}
          </Button>
        ))}
      </div>
    );
  }

  // KYC Step 2 - ID Photo Camera
  if (registrationComplete && !isChatActive && kycStep === 2) {
    return (
      <div className="p-4 py-7 flex justify-center items-center gap-3">
        <Button
          onClick={openCamera}
          className="bg-primary rounded-lg w-24 h-14 sm:text-lg flex items-center justify-center gap-3"
        >
          <Camera size={28} />
        </Button>
        <p>OR</p>
        <Button
          onClick={() => kycFileInputRef.current?.click()}
          className="bg-secondary rounded-lg w-auto sm:text-lg gap-3"
        >
          Upload a File
        </Button>

        <input
          ref={kycFileInputRef}
          type="file"
          accept="image/*,.pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
              onKycFileUpload?.(ev.target.result, file); // ← separate handler
            };
            reader.readAsDataURL(file);
            e.target.value = "";
          }}
        />
      </div>
    );
  }

  // KYC Step 3 - Selfie Prompt (Okay / Not Now)
  if (registrationComplete && !isChatActive && kycStep === 3) {
    return (
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <Button
          onClick={() => {
            handleGetStarted();
          }}
          className={`bg-primary rounded-lg sm:text-sm flex items-center justify-center py-4 ${isLetsGetStarted ? 'bg-gray-500 opacity-50 cursor-not-allowed' : ''}`}
        >
          <span>Okay, let's get started</span>
        </Button>
        <Button
          onClick={() => {
            handleNotNow();
          }}
          className={`bg-secondary rounded-lg sm:text-sm flex items-center justify-center py-4 ${isNotNow ? 'bg-gray-500 opacity-50 cursor-not-allowed' : ''}`}
        >
          <span>Not now</span>
        </Button>
      </div>
    );
  }

  // KYC Step 5 - Selfie Camera
  if (registrationComplete && !isChatActive && kycStep === 5) {
    return (
      <div className="p-4 py-7 flex justify-center">
        <Button
          onClick={openCamera}
          className="bg-primary rounded-lg w-24 h-14 sm:text-lg flex items-center justify-center gap-3"
        >
          <Camera size={28} />
        </Button>
      </div>
    );
  }

  // KYC Step 6 - Connect to Service buttons
  if (registrationComplete && !isChatActive && kycStep === 6) {
    const { canAccept, dailyCount, maxDaily, status, resetIn, reason } = verificationState || {}; // eslint-disable-line no-unused-vars

    // Only disable if daily limit reached
    const isLimitReached = status === 'approved_limited' && dailyCount >= maxDaily;

    return (
      <div className="p-4">
        {isLimitReached && (
          <div className={`mb-3 p-3 rounded-xl border ${darkMode
            ? 'bg-yellow-500/10 border-yellow-500/20'
            : 'bg-yellow-50 border-yellow-500/20'
            }`}>
            <p className="text-sm text-yellow-600 dark:text-yellow-500 text-center">
              {reason || `You've reached your daily limit of ${maxDaily} errands.`}
            </p>
            {resetIn && (
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-1">
                Resets in {resetIn} hour{resetIn === 1 ? '' : 's'}
              </p>
            )}

            {/* Clickable verification prompt */}
            <Button
              onClick={() => {
                // Trigger selfie step
                const message = {
                  id: Date.now(),
                  from: "them",
                  text: "Let's complete your verification to unlock unlimited errands!",
                  time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                  status: "delivered",
                  isKyc: true
                };
                setMessages(prev => [...prev, message]);

                setTimeout(() => {
                  const promptMessage = {
                    id: Date.now() + 1,
                    from: "them",
                    text: "To complete your verification, take a quick selfie so I can confirm it's really you.",
                    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                    status: "delivered",
                    isKyc: true
                  };
                  setMessages(prev => [...prev, promptMessage]);

                  // Trigger selfie step after message
                  setTimeout(() => {
                    handleSelfieResponse('okay', setMessages);
                  }, 1000);
                }, 700);
              }}
              className="w-full mt-3 flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors"
            >
            </Button>
          </div>
        )}

        <Button
          onClick={handleConnect}
          disabled={isConnectDisabled || isSearching || isLimitReached || !!currentOrder}
          className={`w-full bg-primary rounded-lg sm:text-sm flex items-center justify-center py-4 ${isConnectDisabled || isSearching || isLimitReached || !!currentOrder
            ? 'bg-gray-500 opacity-50 cursor-not-allowed'
            : ''
            }`}
        >
          <span>
            {currentOrder
              ? 'Order in Progress'
              : isLimitReached
                ? 'Daily Limit Reached'
                : isSearching
                  ? 'Connecting...'
                  : 'Connect to an errand service'}
          </span>
        </Button>

        {status === 'approved_limited' && !isLimitReached && dailyCount !== undefined && (
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">
            Errands today: {dailyCount}/{maxDaily}
          </p>
        )}
      </div>
    );
  }

  // KYC Step 0 - After KYC complete, before active chat
  if (registrationComplete && !isChatActive && kycStep === 0) {
    return (
      <div className="p-4 py-7">

      </div>
    );
  }

  // Active chat input
  if (isChatActive) {
    return (
      <div>
        <div className="px-4 py-10">

          <CustomInput
            showMic={false}
            setLocationIcon={true}
            showIcons={true}
            send={send}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${selectedUser?.firstName || 'user'}...`}
            onLocationClick={handleLocationClick}
            onAttachClick={() => setIsAttachFlowOpen(true)}
            selectedFiles={selectedFiles}
            onRemoveFile={onRemoveFile}
            replyingTo={replyingTo}
            onCancelReply={onCancelReply}
            darkMode={darkMode}
            userName={selectedUser?.firstName}
          />
        </div>

        {/* Hidden file input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleAttachClick}
          className="hidden"
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
          multiple
        />
      </div>
    );
  }

  return null;
}