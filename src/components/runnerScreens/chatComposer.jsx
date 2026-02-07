// components/runner/ChatComposer
import { Button } from "@material-tailwind/react";
import { Camera } from "lucide-react";
import CustomInput from "../common/CustomInput";
import { useState } from "react";

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
}) {
  const [isPickUpDisabled, setIsPickUpDisabled] = useState(false);
  const [isConnectDisabled, setIsConnectDisabled] = useState(false);
  const [isRunErrandDisabled, setIsRunErrandDisabled] = useState(false);
  const [isLetsGetStarted, setIsLetsGetStarted] = useState(false);
  const [isNotNow, setIsNotNow] = useState(false);

  const handlePickUp = () => {
    if (isPickUpDisabled) return;

    // Your existing pickUp logic
    pickUp();

    // Disable after click
    setIsPickUpDisabled(true);
  };


  const handleConnect = () => {
    if (isConnectDisabled || isSearching) return;

    // Your existing pickUp logic
    handleConnectToService();
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
  if (!isCollectingCredentials && !registrationComplete && !isChatActive && !kycStep && initialMessagesComplete) {
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
  if (isCollectingCredentials && credentialStep !== null) {
    return (
      <div className="p-4 py-7">
        <CustomInput
          showMic={false}
          send={send}
          showIcons={false}
          showEmojis={false}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={credentialStep === null}
          placeholder={
            needsOtpVerification
              ? "OTP - 09726"
              : credentialStep === null
                ? "Processing..."
                : `Your ${credentialQuestions[credentialStep]?.field}...`
          }
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
          className="bg-secondary rounded-lg w-auto sm:text-lg gap-3"
        >
          Upload a File
        </Button>
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

  // KYC Step 6 - Connect to Service buttons (after verification complete or "not now")
  if (registrationComplete && !isChatActive && kycStep === 6) {
    return (
      <div className="p-4 flex justify-center items-center w-full gap-4">
        <Button
          onClick={handleConnect}
          disabled={isConnectDisabled || isSearching}
          className={`bg-primary rounded-lg sm:text-sm flex items-center justify-center py-4 ${isConnectDisabled || isSearching ? 'bg-gray-500 opacity-50 cursor-not-allowed' : ''
            }`}
        >
          <span>Connect to an errand service</span>
        </Button>
        {/* <Button
          onClick={handleCancelConnect}
          className="bg-secondary rounded-lg sm:text-sm flex items-center justify-center py-4"
        >
          <span>Cancel</span>
        </Button> */}
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
        <div className="p-4 py-7">
          <CustomInput
            showMic={false}
            setLocationIcon={true}
            showIcons={true}
            send={send}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Message ${selectedUser?.firstName || 'user'}...`}
            onLocationClick={handleLocationClick}
            onAttachClick={handleAttachClick}
            selectedFiles={selectedFiles}
            onRemoveFile={onRemoveFile}
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