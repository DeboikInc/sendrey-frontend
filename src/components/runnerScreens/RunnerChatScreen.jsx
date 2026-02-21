import React, { useState, useEffect, useRef, useCallback } from "react";
import { IconButton } from "@material-tailwind/react";
import ChatComposer from "../runnerScreens/chatComposer";
import {
  Phone, Video, MoreHorizontal, Ellipsis, ChevronLeft, Sun, Moon
} from "lucide-react";
import Message from "../common/Message";
import OrderStatusFlow from "./OrderStatusFlow";
import AttachmentOptionsFlow from "./AttachmentOptionsFlow";
import CameraPreviewModal from './CameraPreviewModal';
import SpecialInstructionsBanner from "./SpecialInstructionsBanner";
import SpecialInstructionsModal from "./SpecialInstructionsModal";
import ItemSubmissionForm from './ItemSubmissionForm';
import CallScreen from "../common/CallScreen";

import { usePushNotifications } from '../../hooks/usePushNotifications';
import { useTypingAndRecordingIndicator } from '../../hooks/useTypingIndicator';

const HeaderIcon = ({ children }) => (
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

  onSpecialInstructions,
  onOrderCreated,
  onPaymentSuccess,
  onDeliveryConfirmed,
  onMessageDeleted,

  showOrderFlow,
  setShowOrderFlow,
  handleOrderStatusClick,
  completedOrderStatuses,
  setCompletedOrderStatuses,

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
  streamRef,

  callState,
  callType,
  incomingCall,
  isMuted,
  isCameraOff,
  formattedDuration,
  remoteUsers,
  localVideoTrack,
  initiateCall,
  acceptCall,
  declineCall,
  endCall,
  toggleMute,
  toggleCamera,

  // currentOrder owned by Raw.jsx — single source of truth, no local duplicate
  currentOrder,
  setCurrentOrder,
}) {
  const listRef = useRef(null);
  const fileInputRef = useRef(null);
  const processedMessageIds = useRef(new Set());

  const [showCameraPreview, setShowCameraPreview] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [specialInstructions, setSpecialInstructions] = useState(null);
  const [showSpecialInstructionsModal, setShowSpecialInstructionsModal] = useState(false);
  const [showItemSubmissionForm, setShowItemSubmissionForm] = useState(false);
  const [deliveryMarked, setDeliveryMarked] = useState(false);

  const chatId = selectedUser?._id ? `user-${selectedUser._id}-runner-${runnerId}` : null;

  const { permission, requestPermission } = usePushNotifications({
    runnerId, userType: 'runner', socket,
  });

  const { handleTyping, otherUserTyping } = useTypingAndRecordingIndicator({
    socket, chatId, currentUserId: runnerId, currentUserType: 'runner',
  });

  const handleTextChange = (e) => { setText(e.target.value); handleTyping(); };

  // ─── Setup ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (runnerId && socket && permission === 'default') requestPermission();
  }, [runnerId, socket, permission, requestPermission]);

  useEffect(() => {
    if (selectedUser?.specialInstructions) setSpecialInstructions(selectedUser.specialInstructions);
  }, [selectedUser?.specialInstructions]);

  useEffect(() => {
    processedMessageIds.current = new Set();
  }, [selectedUser?._id, runnerId]);

  useEffect(() => {
    if (listRef.current) {
      const t = setTimeout(() => {
        listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
      }, 100);
      return () => clearTimeout(t);
    }
  }, [messages, replyingTo]);

  useEffect(() => {
    if (capturedImage && isPreviewOpen) { setPreviewImage(capturedImage); setShowCameraPreview(true); }
  }, [capturedImage, isPreviewOpen]);

  // ─── Socket listeners ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!onSpecialInstructions) return;
    onSpecialInstructions((data) => setSpecialInstructions(data.specialInstructions));
  }, [onSpecialInstructions]);

  // orderCreated via hook
  useEffect(() => {
    if (!onOrderCreated) return;
    onOrderCreated((data) => {
      const order = data.order || data;
      console.log('Runner orderCreated (hook):', order.orderId, '| paymentStatus:', order.paymentStatus);
      setCurrentOrder(prev => ({ ...(prev || {}), ...order }));
    });
  }, [onOrderCreated, setCurrentOrder]);

  // paymentSuccess via hook
  useEffect(() => {
    if (!onPaymentSuccess) return;
    onPaymentSuccess((data) => {
      console.log('Runner paymentSuccess (hook):', data);
      setCurrentOrder(prev => ({
        ...(prev || {}),
        escrowId: data.escrowId,
        orderId: data.orderId || prev?.orderId,
        paymentStatus: 'paid',
        status: 'active',
      }));
    });
  }, [onPaymentSuccess, setCurrentOrder]);

  // Direct socket fallback — catches paymentSuccess/orderCreated emitted to chatId room
  useEffect(() => {
    if (!socket || !chatId) return;

    const onPayment = (data) => {
      console.log('Runner direct paymentSuccess:', data);
      setCurrentOrder(prev => ({
        ...(prev || {}),
        escrowId: data.escrowId,
        orderId: data.orderId || prev?.orderId,
        paymentStatus: 'paid',
        status: 'active',
      }));
    };

    const onOrder = (data) => {
      const order = data.order || data;
      console.log('Runner direct orderCreated:', order.orderId, order.paymentStatus);
      setCurrentOrder(prev => ({ ...(prev || {}), ...order }));
    };

    socket.on('paymentSuccess', onPayment);
    socket.on('orderCreated', onOrder);
    return () => {
      socket.off('paymentSuccess', onPayment);
      socket.off('orderCreated', onOrder);
    };
  }, [socket, chatId, setCurrentOrder]);

  // deliveryConfirmed
  useEffect(() => {
    if (!onDeliveryConfirmed) return;
    onDeliveryConfirmed((data) => {
      console.log('Delivery confirmed by user:', data);
      setDeliveryMarked(false);
      setCurrentOrder(null);
    });
  }, [onDeliveryConfirmed, setCurrentOrder]);

  // messageDeleted
  useEffect(() => {
    if (!onMessageDeleted) return;
    onMessageDeleted(({ messageId, deletedBy }) => {
      const isMe = deletedBy === runnerId;
      setMessages(prev => prev.map(msg => msg.id === messageId
        ? { ...msg, deleted: true, text: isMe ? "You deleted this message" : "This message was deleted", type: "deleted", fileUrl: null, fileName: null }
        : msg
      ));
    });
  }, [onMessageDeleted, runnerId, setMessages]);

  // Single unified message listener
  useEffect(() => {
    if (!socket || !chatId) return;

    const handleIncomingMessage = (msg) => {
      if (processedMessageIds.current.has(msg.id)) return;
      processedMessageIds.current.add(msg.id);
      if (msg.type === 'fileUploadSuccess' || msg.messageType === 'fileUploadSuccess') return;

      const formattedMsg = {
        ...msg,
        from: msg.from === 'system' || msg.type === 'system' || msg.senderType === 'system' || msg.senderId === 'system'
          ? 'system' : msg.senderId === runnerId ? 'me' : 'them',
        type: msg.type || msg.messageType || 'text',
      };

      setMessages(prev => {
        const exists = prev.some(m => m.id === msg.id);
        if (exists) return prev.map(m => m.id === msg.id ? { ...m, ...formattedMsg } : m);
        return [...prev, formattedMsg];
      });
    };

    socket.on('message', handleIncomingMessage);
    return () => socket.off('message', handleIncomingMessage);
  }, [socket, chatId, runnerId, setMessages]);

  // ─── Message actions ──────────────────────────────────────────────────────────

  const handleDeleteMessage = (messageId, deleteForEveryone = false) => {
    if (!selectedUser) return;
    setMessages(prev => prev.map(msg => msg.id === messageId
      ? { ...msg, deleted: true, text: "You deleted this message", type: "deleted", fileUrl: null, fileName: null }
      : msg
    ));
    if (deleteForEveryone && socket && chatId) {
      socket.emit("deleteMessage", { chatId, messageId, userId: runnerId, deleteForEveryone: true });
    }
  };

  const handleEditMessage = (messageId, newText) => {
    setMessages(prev => prev.map(msg => msg.id === messageId ? { ...msg, text: newText, edited: true } : msg));
  };

  const handleMessageReact = (messageId, emoji) => {
    if (!selectedUser || !chatId) return;
    setMessages(prev => prev.map(msg => msg.id === messageId ? { ...msg, reaction: emoji } : msg));
    if (socket) socket.emit("reactToMessage", { chatId, messageId, emoji, userId: runnerId });
  };

  const handleMessageReply = (message) => {
    setReplyingTo(message);
    setTimeout(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, 100);
  };

  const handleCancelReply = () => setReplyingTo(null);

  const handleScrollToMessage = (messageId) => {
    const el = document.getElementById(`message-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('highlight-message');
      setTimeout(() => el.classList.remove('highlight-message'), 2000);
    }
  };

  // ─── File upload ──────────────────────────────────────────────────────────────

  const handleFileSelect = async (event) => {
    const files = Array.from(event.target.files);
    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) { alert(`"${file.name}" exceeds 10MB limit.`); continue; }
      setMessages(prev => [...prev, {
        id: `temp-${Date.now()}-${file.name}`, from: "me", type: "uploading",
        fileName: file.name, fileType: file.type, text: `Uploading ${file.name}...`,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), status: "uploading",
      }]);
      try { await uploadFileWithProgress(file, { chatId, senderId: runnerId, senderType: 'runner' }); }
      catch (error) { console.error('Upload error:', error); }
    }
    event.target.value = "";
  };

  const handleAttachClickInternal = () => fileInputRef.current?.click();

  const handleSendPhoto = async (image, replyText) => {
    if (!selectedUser || !runnerId) return;
    try {
      const blob = await (await fetch(image)).blob();
      const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
      const tempId = `temp-${Date.now()}-photo`;
      setMessages(prev => [...prev, {
        id: tempId, from: "me", type: "image", fileName: file.name, fileType: 'image/jpeg',
        fileUrl: image, text: replyText || '',
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "uploading", senderId: runnerId, senderType: "runner", isUploading: true, tempId,
        ...(replyingTo && { replyTo: replyingTo.id, replyToMessage: replyingTo.text || replyingTo.fileName || "Media", replyToFrom: replyingTo.from }),
      }]);
      await uploadFileWithProgress(file, {
        chatId, senderId: runnerId, senderType: 'runner', tempId, text: replyText || '', type: 'image',
        ...(replyingTo && { replyTo: replyingTo.id, replyToMessage: replyingTo.text || replyingTo.fileName || "Media", replyToFrom: replyingTo.from }),
      });
      setShowCameraPreview(false); setPreviewImage(null); closePreview(); setReplyingTo(null);
    } catch (error) {
      console.error('Error sending photo:', error);
      setShowCameraPreview(false); setPreviewImage(null); closePreview();
    }
  };

  // ─── Item submission ──────────────────────────────────────────────────────────

  const serviceType = selectedUser?.currentRequest?.serviceType ?? selectedUser?.serviceType;
  const isRunErrand = serviceType === 'run-errand';
  const canSubmitItems = isRunErrand && currentOrder?.paymentStatus === 'paid';

  const handleSubmitItems = async (itemsData) => {
    try {
      if (socket) {
        socket.emit('submitItems', {
          chatId, runnerId, userId: selectedUser?._id,
          submissionId: `submission-${Date.now()}`,
          escrowId: currentOrder?.escrowId || null,
          items: itemsData.items,
          receiptBase64: itemsData.receiptBase64,
          totalAmount: itemsData.totalAmount,
        });
      }
      setShowItemSubmissionForm(false);
    } catch (error) { console.error('Error submitting items:', error); throw error; }
  };

  const openItemSubmissionForm = () => {
    if (!currentOrder) return alert('No active order. Wait for user to place an order.');
    if (!isRunErrand) return alert('Item submission is only for run-errand tasks.');
    if (currentOrder.paymentStatus !== 'paid') return alert('Wait for user to complete payment.');
    setShowItemSubmissionForm(true);
  };

  // ─── Delivery ─────────────────────────────────────────────────────────────────

  const handleMarkDeliveryComplete = () => {
    if (!socket || !currentOrder || !chatId) {
      console.log('markDelivery blocked | currentOrder:', currentOrder?.orderId, '| socket:', !!socket);
      return;
    }
    socket.emit('markDeliveryComplete', { chatId, orderId: currentOrder.orderId, runnerId, deliveryProof: null });
    setDeliveryMarked(true);
  };

  // ─── Stable callbacks ─────────────────────────────────────────────────────────

  const handleStatusMessage = useCallback((systemMessage) => {
    setMessages(prev => {
      if (prev.some(m => m.id === systemMessage.id)) return prev;
      return [...prev, systemMessage];
    });
  }, [setMessages]);

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  const handleKeyDown = () => handleTyping();
  const getFirstLetter = (name) => name ? name.charAt(0).toUpperCase() : 'U';
  const getRandomBgColor = (name) => {
    if (!name) return 'bg-green-500';
    const colors = ['bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-green-500', 'bg-teal-500', 'bg-blue-500', 'bg-indigo-500', 'bg-purple-500', 'bg-pink-500', 'bg-rose-500'];
    return colors[name.charCodeAt(0) % colors.length];
  };

  const callerName = selectedUser ? `${selectedUser.firstName} ${selectedUser.lastName || ""}` : "User";
  const callerAvatar = selectedUser?.avatar || null;

  const TypingIndicator = () => (
    <div className="flex items-center gap-2 px-4 py-2">
      <div className="flex gap-1">
        {[0, 150, 300].map((d, i) => (
          <span key={i} className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
        ))}
      </div>
      <span className="text-sm text-gray-500">typing...</span>
    </div>
  );

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      {callState !== "idle" && (
        <CallScreen
          callState={callState} callType={callType} callerName={callerName}
          callerAvatar={callerAvatar} isMuted={isMuted} isCameraOff={isCameraOff}
          formattedDuration={formattedDuration} remoteUsers={remoteUsers}
          localVideoTrack={localVideoTrack} onAccept={acceptCall} onDecline={declineCall}
          onEnd={endCall} onToggleMute={toggleMute} onToggleCamera={toggleCamera}
        />
      )}

      <section className="flex flex-col min-w-0 overflow-hidden scroll-smooth relative">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 min-w-0 px-5 py-3">
          <div className="flex gap-3">
            <IconButton variant="text" className="rounded-full lg:hidden" onClick={() => setDrawerOpen(true)}>
              <ChevronLeft className="h-5 w-5" />
            </IconButton>
            <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center">
              {selectedUser?.avatar ? (
                <img src={selectedUser.avatar} alt={`${selectedUser.firstName} ${selectedUser.lastName || ''}`} className="w-full h-full object-cover" />
              ) : (
                <div className={`w-full h-full ${getRandomBgColor(selectedUser?.firstName || 'U')} flex items-center justify-center text-white font-bold text-lg`}>
                  {getFirstLetter(selectedUser?.firstName || 'U')}
                </div>
              )}
            </div>
            <div className="truncate">
              <div className="font-bold text-[16px] truncate dark:text-white text-black-200">
                {selectedUser ? `${selectedUser?.firstName} ${selectedUser?.lastName || ''}` : "User"}
              </div>
              <div className="text-sm font-medium text-gray-900">Online</div>
            </div>
          </div>

          <div>
            <IconButton variant="text" className="rounded-full sm:hidden" onClick={() => setInfoOpen(true)}>
              <Ellipsis className="h-5 w-5" />
            </IconButton>
            <div className="items-center gap-3 flex">
              <span className="bg-gray-1000 dark:bg-black-200 rounded-full w-10 h-10 flex items-center justify-center">
                <IconButton onClick={() => initiateCall("video", selectedUser?._id, "user")} variant="text" className="rounded-full">
                  <Video className="h-6 w-6" />
                </IconButton>
              </span>
              <span className="bg-gray-1000 dark:bg-black-200 rounded-full w-10 h-10 flex items-center justify-center">
                <IconButton onClick={() => initiateCall("voice", selectedUser?._id, "user")} variant="text" className="rounded-full">
                  <Phone className="h-6 w-6" />
                </IconButton>
              </span>
              <span className="bg-gray-1000 dark:bg-black-200 rounded-full w-10 h-10 flex items-center justify-center">
                <HeaderIcon><MoreHorizontal className="h-6 w-6" /></HeaderIcon>
              </span>
              <div className="hidden lg:block pl-2">
                <div onClick={() => setDark(!dark)} className="cursor-pointer bg-gray-1000 dark:bg-black-200 rounded-full w-10 h-10 flex items-center justify-center">
                  {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5 text-gray-900" strokeWidth={3.0} />}
                </div>
              </div>
            </div>
          </div>
        </div>

        {specialInstructions && (
          <SpecialInstructionsBanner
            userName={`${selectedUser?.firstName || 'User'} ${selectedUser?.lastName || ''}`}
            hasText={!!specialInstructions.text}
            mediaCount={specialInstructions.media?.length || 0}
            onClick={() => setShowSpecialInstructionsModal(true)}
            darkMode={dark}
          />
        )}

        {/* Messages */}
        <div ref={listRef} className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 bg-chat-pattern bg-gray-100 dark:bg-black-200">
          <div className="mx-auto max-w-3xl">
            {messages.map((m) => (
              <Message key={m.id} m={m} darkMode={dark} userType="runner"
                onMessageClick={() => {}} showCursor={false} isChatActive={isChatActive}
                onDelete={handleDeleteMessage} onEdit={handleEditMessage}
                onReact={handleMessageReact} onReply={handleMessageReply}
                onCancelReply={handleCancelReply} messages={messages}
                onScrollToMessage={handleScrollToMessage}
              />
            ))}
            {otherUserTyping && <TypingIndicator />}
          </div>
        </div>

        {/* Composer */}
        <div className="bg-gray-100 dark:bg-black-200">
          <ChatComposer
            isChatActive={isChatActive} text={text} handleKeyDown={handleKeyDown}
            setText={setText} selectedUser={selectedUser} handleTextChange={handleTextChange}
            send={() => send(replyingTo)} handleLocationClick={handleLocationClick}
            handleAttachClick={handleAttachClickInternal} fileInputRef={fileInputRef}
            replyingTo={replyingTo} onCancelReply={handleCancelReply} darkMode={dark}
            setIsAttachFlowOpen={setIsAttachFlowOpen}
          />

          <input type="file" ref={fileInputRef} onChange={handleFileSelect}
            className="hidden" accept="image/*,video/*,audio/*,.pdf,.doc,.docx" multiple />

          {showOrderFlow && selectedUser && (
            <OrderStatusFlow
              isOpen={showOrderFlow} onClose={() => setShowOrderFlow(false)}
              orderData={{
                deliveryLocation: selectedUser?.currentRequest?.deliveryLocation || "No address",
                pickupLocation: selectedUser?.currentRequest?.pickupLocation || selectedUser?.currentRequest?.marketLocation || "No address",
                userData: selectedUser, chatId, runnerId, userId: selectedUser?._id, serviceType,
              }}
              darkMode={dark} onStatusClick={handleOrderStatusClick}
              completedStatuses={completedOrderStatuses} setCompletedStatuses={setCompletedOrderStatuses}
              socket={socket} taskType={isRunErrand ? 'shopping' : 'pickup_delivery'}
              onStatusMessage={handleStatusMessage}
            />
          )}

          {isAttachFlowOpen && (
            <AttachmentOptionsFlow
              isOpen={isAttachFlowOpen} onClose={() => setIsAttachFlowOpen(false)}
              currentOrder={currentOrder} deliveryMarked={deliveryMarked}
              onMarkDelivery={() => { setIsAttachFlowOpen(false); handleMarkDeliveryComplete(); }}
              darkMode={dark} onSelectCamera={() => { setIsAttachFlowOpen(false); openCamera(); }}
              showSubmitItems={canSubmitItems}
              onSubmitItems={() => { setIsAttachFlowOpen(false); openItemSubmissionForm(); }}
              onSelectGallery={() => {
                setIsAttachFlowOpen(false);
                const input = document.createElement('input');
                input.type = 'file'; input.accept = 'image/*,video/*'; input.multiple = false;
                input.onchange = (e) => {
                  const file = e.target.files[0];
                  if (file) { const reader = new FileReader(); reader.onload = (e) => openPreview(e.target.result); reader.readAsDataURL(file); }
                };
                input.click();
              }}
            />
          )}

          {showCameraPreview && previewImage && (
            <CameraPreviewModal
              isOpen={showCameraPreview}
              onClose={() => { setShowCameraPreview(false); setPreviewImage(null); closePreview(); }}
              previewImage={previewImage}
              onRetake={() => { setShowCameraPreview(false); setPreviewImage(null); closePreview(); retakePhoto(); }}
              onSend={(image, text) => { handleSendPhoto(image, text); setShowCameraPreview(false); setPreviewImage(null); closePreview(); }}
              onCancel={() => { setShowCameraPreview(false); setPreviewImage(null); closePreview(); }}
              darkMode={dark}
            />
          )}
        </div>

        {cameraOpen && (
          <div className="fixed inset-0 bg-black z-[9999] flex flex-col">
            <div className="flex justify-between items-center p-4 bg-black/80">
              <button onClick={closeCamera} className="text-white px-4 py-2 hover:bg-white/10 rounded-lg">Cancel</button>
              <h3 className="text-white text-lg font-medium">Take Photo</h3>
              <div className="w-16"></div>
            </div>
            <div className="relative bg-black overflow-hidden">
              {!capturedImage ? (
                <>
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-screen object-cover" style={{ transform: 'scaleX(-1)' }} />
                  <div className="absolute bottom-2 left-0 right-0 flex justify-center">
                    <button onClick={capturePhoto} className="w-16 h-16 rounded-full bg-white border-4 border-gray-300 hover:bg-gray-100 shadow-2xl active:scale-95 transition-transform" />
                  </div>
                </>
              ) : (
                <>
                  <img src={capturedImage} alt="Captured" className="w-full h-[78vh] object-contain bg-black" />
                  <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-4">
                    <button onClick={retakePhoto} className="px-6 py-3 bg-gray-600 text-white rounded-lg shadow-lg hover:bg-gray-700 active:scale-95 transition-transform">Retake</button>
                    <button onClick={() => { const photo = capturedImage; closeCamera(); setTimeout(() => { setPreviewImage(photo); setShowCameraPreview(true); }, 100); }}
                      className="px-6 py-3 bg-blue-600 text-white rounded-lg shadow-lg hover:bg-blue-700 active:scale-95 transition-transform">Use Photo</button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <SpecialInstructionsModal
          isOpen={showSpecialInstructionsModal} onClose={() => setShowSpecialInstructionsModal(false)}
          userName={`${selectedUser?.firstName || 'User'} ${selectedUser?.lastName || ''}`}
          instructions={specialInstructions} darkMode={dark}
        />
      </section>

      {showItemSubmissionForm && (
        <ItemSubmissionForm
          isOpen={showItemSubmissionForm} onClose={() => setShowItemSubmissionForm(false)}
          onSubmit={handleSubmitItems} darkMode={dark}
          orderBudget={currentOrder?.budget || currentOrder?.itemBudget || 0}
        />
      )}
    </>
  );
}

export default React.memo(RunnerChatScreen);