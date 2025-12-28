import React, { useEffect, useRef } from "react";
import { IconButton, Avatar, Button } from "@material-tailwind/react";
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
import CustomInput from "../common/CustomInput";
import RunnerNotifications from "../common/RunnerNotifications";
import OrderStatusFlow from "../common/OrderStatusFlow";
import AttachmentOptionsFlow from "../common/AttachmentOptionsFlow";

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

}) {
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <section className="flex flex-col min-w-0 overflow-hidden scroll-smooth relative">
      {/* Chat Header */}
      <div className="px-4 py-3 border-b dark:border-white/10 border-gray-200 flex items-center justify-between bg-white/5/10 backdrop-blur-xl">
        <div className="flex items-center gap-3 min-w-0">
          <IconButton variant="text" className="rounded-full lg:hidden" onClick={() => setDrawerOpen(true)}>
            <ChevronLeft className="h-5 w-5" />
          </IconButton>

          <Avatar
            src={isChatActive && selectedUser ? selectedUser?.avatar : active?.avatar || "https://via.placeholder.com/128"}
            alt={isChatActive && selectedUser ? selectedUser?.firstName : active?.name || "User"}
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
            />
          ))}
        </div>
      </div>

      {/* Composer */}
      <div className="bg-gray-100 dark:bg-black-200">
        {!isCollectingCredentials && !registrationComplete && !isChatActive ? (
          <div className="flex gap-5 p-4">
            <Button onClick={pickUp} className="bg-secondary rounded-lg w-full h-14 sm:text-lg">
              Pick Up
            </Button>
            <Button onClick={runErrand} className="bg-primary rounded-lg w-full sm:text-lg">
              Run Errand
            </Button>
          </div>
        ) : isCollectingCredentials && credentialStep !== null ? (
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
        ) : registrationComplete && !isChatActive ? (
          <div className="p-4 py-7">
            <CustomInput
              showMic={false}
              setLocationIcon={true}
              showIcons={false}
              send={send}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type a message..."
            />
          </div>
        ) : isChatActive ? (
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
            />
          </div>
        ) : null}

        {/* RunnerNotifications */}
        {registrationComplete && !isChatActive && (
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
              deliveryLocation: selectedUser?.deliveryLocation || "No 90 alisquare ikeja mobolaji estate",
              pickupLocation: selectedUser?.pickupLocation || "Pickup Location",
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
    </section>
  );
}