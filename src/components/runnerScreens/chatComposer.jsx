// components/runner/ChatComposer
import { Button } from "@material-tailwind/react";
import { Camera } from "lucide-react";
import CustomInput from "../common/CustomInput";
import { useState, useRef, useCallback } from "react";
import { FaWalking, FaMotorcycle } from "react-icons/fa";
import { Bike, Car, Truck } from "lucide-react";

const FLEET_OPTIONS = [
  { type: "cycling", icon: Bike, label: "Cycling" },
  { type: "car", icon: Car, label: "Car" },
  { type: "van", icon: Truck, label: "Van" },
  { type: "pedestrian", icon: FaWalking, label: "Pedestrian" },
  { type: "bike", icon: FaMotorcycle, label: "Bike" },
];

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
  isSubmitting,

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
  onKycFileUpload,

  // Audio upload — passed down from RunnerChatScreen
  uploadFileWithProgress,
  chatId,
  runnerId,
  isConnectLocked,

  isNewOrderFlow,
  newOrderStep,
  onServiceChoice,
  onFleetChoice,
  newOrderComplete,
  isUpdatingServer,

  isReturningUser,
  onReturningUserChoice,
  returningUserData
}) {

  // console.log('ChatComposer state:', {
  //   newOrderComplete,
  //   isNewOrderFlow,
  //   newOrderStep,
  //   kycStep,
  //   registrationComplete,
  //   isChatActive,
  //   isCollectingCredentials,
  // });

  const [isPickUpDisabled, setIsPickUpDisabled] = useState(false);
  const [isConnectDisabled, setIsConnectDisabled] = useState(false);
  const [isRunErrandDisabled, setIsRunErrandDisabled] = useState(false);
  const [isLetsGetStarted, setIsLetsGetStarted] = useState(false);
  const kycFileInputRef = useRef(null);
  const [returningChoiceMade, setReturningChoiceMade] = useState(false);

  const handlePickUp = () => {
    if (isPickUpDisabled) return;
    pickUp();
    setIsPickUpDisabled(true);
  };

  const handleConnect = () => {
    if (isConnectDisabled || isSearching || isConnectLocked) return;
    setIsConnectDisabled(true);
    handleConnectToService();
    setTimeout(() => setIsConnectDisabled(false), 3000);
  };

  const handleRunErrand = () => {
    if (isRunErrandDisabled) return;
    runErrand();
    setIsRunErrandDisabled(true);
  };

  const handleGetStarted = () => {
    if (isLetsGetStarted) return;
    const okayMessage = {
      id: Date.now(), from: "me", text: "Okay, let's get started",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "sent",
    };
    setMessages(prev => [...prev, okayMessage]);
    handleSelfieResponse('okay', setMessages);
    setIsLetsGetStarted(true);
  };

  const handleAudioReady = useCallback(async (audioBlob, audioUrl, mimeType) => {
    if (!chatId || !runnerId || !uploadFileWithProgress) return;

    const ext = mimeType?.includes('ogg') ? 'ogg' : mimeType?.includes('mp4') ? 'm4a' : 'webm';
    const file = new File([audioBlob], `voice-${Date.now()}.${ext}`, { type: mimeType || 'audio/webm' });

    if (file.size > 10 * 1024 * 1024) {
      alert('Audio exceeds 10MB limit.');
      return;
    }

    const tempId = `temp-audio-${Date.now()}`;

    // Add optimistic message — use blob URL so it plays locally right away
    if (setMessages) {
      setMessages(prev => [...prev, {
        id: tempId,
        from: 'me',
        type: 'audio',
        fileType: mimeType || 'audio/webm',
        fileName: file.name,
        fileUrl: audioUrl,
        text: '',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'uploading',
        senderId: runnerId,
        senderType: 'runner',
        isUploading: true,
        tempId,
        createdAt: new Date().toISOString(),
      }]);
    }

    try {
      await uploadFileWithProgress(file, {
        chatId,
        senderId: runnerId,
        senderType: 'runner',
        type: 'audio',
        tempId,
      });
      // Don't revoke here — the message listener in RunnerChatScreen replaces
      // the temp message with the real server message (which has a cloudinary URL).
      // The blob URL becomes unreferenced and GC'd naturally.
    } catch (err) {
      console.error('Audio upload error:', err);
      if (setMessages) {
        setMessages(prev => prev.filter(m => m.id !== tempId));
      }
      URL.revokeObjectURL(audioUrl); // only revoke on failure
    }
  }, [chatId, runnerId, uploadFileWithProgress, setMessages]);

  // ── Returning user — Yes / No ─────────────────────────────────────────────
  if (isReturningUser) {
    return (
      <div className="flex gap-5 p-4">
        <Button
          onClick={() => {
            if (returningChoiceMade) return;
            setReturningChoiceMade(true);
            onReturningUserChoice('yes');
          }}

          disabled={returningChoiceMade}
          className={`bg-primary rounded-lg w-full h-14 sm:text-lg ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          Yes
        </Button>
        <Button
          onClick={() => {
            if (returningChoiceMade) return;
            setReturningChoiceMade(true);
            onReturningUserChoice('no');
          }}

          disabled={returningChoiceMade}
          className={`bg-secondary rounded-lg w-full h-14 sm:text-lg ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          No
        </Button>
      </div>
    );
  }

  // ── Initial state - Pick Up / Run Errand buttons ──────────────────────────
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

  // ── OTP verification input ────────────────────────────────────────────────
  if (needsOtpVerification) {
    return (
      <div className="px-3 py-3 pb-3">
        <CustomInput
          showMic={false}
          send={send}
          showIcons={false}
          showEmojis={false}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Enter OTP e.g. 09726"
          disabled={isSubmitting}
        />
      </div>
    );
  }

  // ── Credential collection input ───────────────────────────────────────────
  if (isCollectingCredentials && credentialStep !== null) {
    if (isSubmitting) {
      return <div className="p-4 py-7" />; // blank while waiting for server
    }

    return (
      <div className="px-3 py-3 pb-3">
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

  // ── KYC Step 1 - Processing ───────────────────────────────────────────────
  if (registrationComplete && !isChatActive && kycStep === 1) {
    return null;
  }



  // ── KYC Step 2 - ID Photo Camera ─────────────────────────────────────────
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
            reader.onload = (ev) => onKycFileUpload?.(ev.target.result, file);
            reader.readAsDataURL(file);
            e.target.value = "";
          }}
        />
      </div>
    );
  }

  // ── KYC Step 3 - Selfie Prompt ───────────────────────────────────────────
  if (registrationComplete && !isChatActive && kycStep === 3) {
    return (
      <div className="p-4 flex justify-center items-center w-full">
        <Button
          onClick={handleGetStarted}
          className={`bg-primary rounded-lg sm:text-sm flex items-center justify-center py-4 ${isLetsGetStarted ? 'bg-gray-500 opacity-50 cursor-not-allowed' : ''}`}
        >
          <span>Okay, let's get started</span>
        </Button>
      </div>
    );
  }

  // ── KYC Step 5 - Selfie Camera ───────────────────────────────────────────
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

  if (isNewOrderFlow && newOrderStep === 'service') {
    return (
      <div className="flex gap-5 p-4">
        <Button onClick={() => onServiceChoice('pick-up', 'Pick Up')}
          className="bg-secondary rounded-lg w-full h-14 sm:text-lg">Pick Up</Button>
        <Button onClick={() => onServiceChoice('run-errand', 'Run Errand')}
          className="bg-primary rounded-lg w-full sm:text-lg">Run Errand</Button>
      </div>
    );
  }

  if (isNewOrderFlow && newOrderStep === 'fleet') {
    return (
      <div className="flex gap-2 justify-center flex-wrap p-4">
        {FLEET_OPTIONS.map(({ type, icon: Icon, label }) => (
          <Button key={type} variant="outlined"
            className="flex flex-col p-3 justify-center items-center"
            onClick={() => onFleetChoice(type, label)}
            disabled={isUpdatingServer}
          >
            <Icon className="text-2xl" />
            <span className="text-[10px] capitalize">{label}</span>
          </Button>
        ))}
      </div>
    );
  }

  // ── New Order Complete - Connect to Service ───────────────────────────────
  if (newOrderComplete) {
    const { dailyCount, maxDaily, status, resetIn, reason } = verificationState || {};
    const isLimitReached = status === 'approved_limited' && dailyCount >= maxDaily;
    return (
      <div className="p-4">
        {isLimitReached && (
          <div className={`mb-3 p-3 rounded-xl border ${darkMode ? 'bg-yellow-500/10 border-yellow-500/20' : 'bg-yellow-50 border-yellow-500/20'}`}>
            <p className="text-sm text-yellow-600 dark:text-yellow-500 text-center">
              {reason || `You've reached your daily limit of ${maxDaily} errands.`}
            </p>
            {resetIn && (
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-1">
                Resets in {resetIn} hour{resetIn === 1 ? '' : 's'}
              </p>
            )}
            <Button
              onClick={() => {
                const message = { id: Date.now(), from: "them", text: "Let's complete your verification to unlock unlimited errands!", time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), status: "delivered", isKyc: true };
                setMessages(prev => [...prev, message]);
                setTimeout(() => {
                  const promptMessage = { id: Date.now() + 1, from: "them", text: "To complete your verification, take a quick selfie so I can confirm it's really you.", time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), status: "delivered", isKyc: true };
                  setMessages(prev => [...prev, promptMessage]);
                  setTimeout(() => handleSelfieResponse('okay', setMessages), 1000);
                }, 700);
              }}
              className="w-full mt-3 flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors"
            />
          </div>
        )}
        <Button
          onClick={handleConnect}
          disabled={isConnectDisabled || isSearching || isLimitReached || isConnectLocked | isUpdatingServer}
          className={`w-full bg-primary rounded-lg sm:text-sm flex items-center justify-center py-4 ${isConnectDisabled || isSearching || isLimitReached || isConnectLocked || isUpdatingServer ? 'bg-gray-500 opacity-50 cursor-not-allowed' : ''}`}
        >
          <span>
            {isUpdatingServer ? 'Updating...'
              : isConnectLocked ? 'Ongoing Order — complete or cancel current order to connect again'
                : isLimitReached ? 'Daily Limit Reached'
                  : isSearching ? 'Connecting...'
                    : 'Connect to an errand service'}
          </span>
        </Button>
        {status === 'approved_limited' && !isLimitReached && dailyCount !== undefined && (
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">Errands today: {dailyCount}/{maxDaily}</p>
        )}
      </div>
    );
  }


  // ── KYC Step 6 - Connect to Service ──────────────────────────────────────
  if (!newOrderComplete && registrationComplete && !isChatActive && kycStep === 6) {
    // console.log('rendering connect button, newOrderComplete:', newOrderComplete);
    const { canAccept, dailyCount, maxDaily, status, resetIn, reason } = verificationState || {}; // eslint-disable-line no-unused-vars
    const isLimitReached = status === 'approved_limited' && dailyCount >= maxDaily;

    return (
      <div className="p-4">
        {isLimitReached && (
          <div className={`mb-3 p-3 rounded-xl border ${darkMode
            ? 'bg-yellow-500/10 border-yellow-500/20'
            : 'bg-yellow-50 border-yellow-500/20'}`}>
            <p className="text-sm text-yellow-600 dark:text-yellow-500 text-center">
              {reason || `You've reached your daily limit of ${maxDaily} errands.`}
            </p>
            {resetIn && (
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-1">
                Resets in {resetIn} hour{resetIn === 1 ? '' : 's'}
              </p>
            )}
            <Button
              onClick={() => {
                const message = {
                  id: Date.now(), from: "them",
                  text: "Let's complete your verification to unlock unlimited errands!",
                  time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                  status: "delivered", isKyc: true,
                };
                setMessages(prev => [...prev, message]);
                setTimeout(() => {
                  const promptMessage = {
                    id: Date.now() + 1, from: "them",
                    text: "To complete your verification, take a quick selfie so I can confirm it's really you.",
                    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                    status: "delivered", isKyc: true,
                  };
                  setMessages(prev => [...prev, promptMessage]);
                  setTimeout(() => handleSelfieResponse('okay', setMessages), 1000);
                }, 700);
              }}
              className="w-full mt-3 flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors"
            />
          </div>
        )}

        <Button
          onClick={handleConnect}
          disabled={isConnectDisabled || isSearching || isLimitReached || isConnectLocked || isUpdatingServer}
          className={`w-full bg-primary rounded-lg sm:text-sm flex items-center justify-center py-4 ${isConnectDisabled || isSearching || isLimitReached || isConnectLocked || isUpdatingServer
            ? 'bg-gray-500 opacity-50 cursor-not-allowed' : ''
            }`}
        >
          <span>
            {isUpdatingServer ? 'Updating...'
              : isConnectLocked ? 'Ongoing Order — complete or cancel current order to connect again'
                : isLimitReached ? 'Daily Limit Reached'
                  : isSearching ? 'Connecting...'
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

  // ── KYC Step 0 ───────────────────────────────────────────────────────────
  if (registrationComplete && !isChatActive && kycStep === 0) {
    return <div className="p-4 py-7" />;
  }

  // ── Active chat input ─────────────────────────────────────────────────────
  if (isChatActive) {
    return (
      <div>
        <div className="px-3 py-3 pb-3">
          <CustomInput
            showMic={true}
            setLocationIcon={true}
            showIcons={false}
            showPlus={true}
            send={send}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${selectedUser?.firstName || 'user'}...`}
            onLocationClick={handleLocationClick}
            onPlusClick={() => setIsAttachFlowOpen(true)}
            selectedFiles={selectedFiles}
            onRemoveFile={onRemoveFile}
            replyingTo={replyingTo}
            onCancelReply={onCancelReply}
            darkMode={darkMode}
            userName={selectedUser?.firstName}
            onAudioReady={handleAudioReady}
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