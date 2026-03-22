import React, { useState, useEffect, useRef, useCallback } from "react";
import { IconButton, Button } from "@material-tailwind/react";
import ChatComposer from "../runnerScreens/chatComposer";
import { Phone, Video, Sun, Moon, RefreshCw } from "lucide-react";
import Message from "../common/Message";
import OrderStatusFlow from "./OrderStatusFlow";
import AttachmentOptionsFlow from "./AttachmentOptionsFlow";
import CameraPreviewModal from './CameraPreviewModal';
import SpecialInstructionsBanner from "./SpecialInstructionsBanner";
import SpecialInstructionsModal from "./SpecialInstructionsModal";
import ItemSubmissionForm from './ItemSubmissionForm';

import VideoCallScreen from "../common/VideoCallScreen";
import CallScreen from "../common/CallScreen";

import chatStorage from '../../utils/chatStorage';

import { usePushNotifications } from '../../hooks/usePushNotifications';
import { useTypingAndRecordingIndicator } from '../../hooks/useTypingIndicator';

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
  isSpeakerOn,
  networkQuality,
  toggleSpeaker,
  switchCallCamera,
  declineCall,
  endCall,
  toggleMute,
  toggleCamera,

  currentOrder,
  setCurrentOrder,
  runnerFleetType,

  orderCancelled,
  onStartNewOrder,
  cancellationReason,

  messagesRef,
  switchCamera,
  facingMode,
  taskCompleted,
  setTaskCompleted
}) {
  const listRef = useRef(null);
  const fileInputRef = useRef(null);
  const processedMessageIds = useRef(new Set());
  const cameraUsedByItemFormRef = useRef(false);

  const [showCameraPreview, setShowCameraPreview] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [specialInstructions, setSpecialInstructions] = useState(null);
  const [showSpecialInstructionsModal, setShowSpecialInstructionsModal] = useState(false);
  const [showItemSubmissionForm, setShowItemSubmissionForm] = useState(false);

  const [deliveryMarked, setDeliveryMarked] = useState(false);
  const [userConfirmedDelivery, setUserConfirmedDelivery] = useState(false);

  const [runnerLocation, setRunnerLocation] = useState(null); // eslint-disable-line no-unused-vars


  const chatId = selectedUser?._id ? `user-${selectedUser._id}-runner-${runnerId}` : null;

  const { permission, requestPermission } = usePushNotifications({
    runnerId, userType: 'runner', socket,
  });

  const { handleTyping, otherUserTyping } = useTypingAndRecordingIndicator({
    socket, chatId, currentUserId: runnerId, currentUserType: 'runner',
  });

  const [backHomeDisabled, setBackHomeDisabled] = useState(() => {
    try {
      return localStorage.getItem(`backHome_disabled_${chatId}`) === 'true';
    } catch { return false; }
  });

  const handleTextChange = (e) => {
    setText(e.target.value);
    handleTyping();
    chatStorage.saveDraft(chatId, e.target.value);
  };

  useEffect(() => {
    if (runnerId && socket && permission === 'default') requestPermission();
  }, [runnerId, socket, permission, requestPermission]);


  useEffect(() => {
    if (currentOrder?.orderId) {
      // Don't reset taskCompleted if the order is already completed/cancelled
      const isTerminal = ['completed', 'cancelled', 'task_completed']
        .includes(currentOrder?.status);
      if (!isTerminal) {
        setTaskCompleted(false);
        setDeliveryMarked(false);
        setUserConfirmedDelivery(false);
      }
    }
  }, [currentOrder?.orderId, setTaskCompleted, currentOrder?.status]);

  useEffect(() => {
    if (!socket || !chatId) return;

    const handlePayoutReceiptSubmitted = () => {
      setCurrentOrder(prev => prev ? { ...prev, usedPayoutSystem: true } : prev);
    };

    socket.on('payoutReceiptSubmitted', handlePayoutReceiptSubmitted);
    return () => socket.off('payoutReceiptSubmitted', handlePayoutReceiptSubmitted);
  }, [socket, chatId, setCurrentOrder]);

  useEffect(() => {
    if (!socket || !chatId || !runnerId) return;
    socket.emit('getRunnerPayout', { chatId, runnerId });

    const handlePayoutData = ({ payout }) => {
      if (payout?.usedPayoutSystem) {
        setCurrentOrder(prev => prev ? { ...prev, usedPayoutSystem: true } : prev);
      }
    };

    socket.on('runnerPayoutData', handlePayoutData);
    return () => socket.off('runnerPayoutData', handlePayoutData);
  }, [socket, chatId, runnerId, setCurrentOrder]);


  useEffect(() => {
    if (selectedUser?.specialInstructions) setSpecialInstructions(selectedUser.specialInstructions);
  }, [selectedUser?.specialInstructions]);

  useEffect(() => {
    processedMessageIds.current = new Set();
  }, [selectedUser?._id, runnerId]);



  useEffect(() => {
    if (listRef.current && messages.length > 0) {
      const t = setTimeout(() => {
        listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
      }, 100);
      return () => clearTimeout(t);
    }
  }, [messages, replyingTo]);

  // save recent convos
  useEffect(() => {
    if (!chatId) return;
    chatStorage.saveActiveChat(chatId, currentOrder?.orderId || null);
  }, [chatId, currentOrder?.orderId]);


  useEffect(() => {
    // Only reset when there's no currentOrder (new session)
    if (selectedUser?._id && runnerId && !currentOrder) {
      setTaskCompleted(false);
      setDeliveryMarked(false);
      setUserConfirmedDelivery(false);
    }
  }, [selectedUser?._id, runnerId, currentOrder, setTaskCompleted]);

  useEffect(() => {
    if (capturedImage && isPreviewOpen && !cameraUsedByItemFormRef.current) {
      setPreviewImage(capturedImage);
      setShowCameraPreview(true);
    }
  }, [capturedImage, isPreviewOpen]);

  useEffect(() => {
    if (!onSpecialInstructions) return;
    onSpecialInstructions((data) => setSpecialInstructions(data.specialInstructions));
  }, [onSpecialInstructions]);

  useEffect(() => {
    if (!onOrderCreated) return;
    onOrderCreated((data) => {
      const order = data.order || data;
      if (!order?.orderId) return;
      setCurrentOrder(prev => {
        // Same order — merge updates only
        if (prev?.orderId === order.orderId) return { ...prev, ...order };
        // New order — set it, but don't touch messages
        // Messages come from chatHistory via server, not here
        return order;
      });
    });
  }, [onOrderCreated, setCurrentOrder]);


  useEffect(() => {
    if (!socket || !currentOrder?.orderId) return;
    const isEnRoute = completedOrderStatuses.includes('en_route_to_delivery');
    if (!isEnRoute) return;
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, heading, speed } = position.coords;
        const location = { lat: latitude, lng: longitude, heading: heading || 0, speed: speed || 0 };
        setRunnerLocation(location);
        socket.emit('runner:locationUpdate', { orderId: currentOrder.orderId, ...location });
      },
      (err) => console.error('Geolocation error:', err),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    );
    return () => { navigator.geolocation.clearWatch(watchId); setRunnerLocation(null); };
  }, [socket, currentOrder?.orderId, completedOrderStatuses]);

  useEffect(() => {
    if (!socket || !chatId) return;

    const handleDeliveryConfirmed = () => {
      setUserConfirmedDelivery(true);
    };

    const handleDeliveryDenied = () => {
      setUserConfirmedDelivery(false);
      setDeliveryMarked(false);
    };

    socket.on('deliveryConfirmed', handleDeliveryConfirmed);
    socket.on('deliveryAutoConfirmed', handleDeliveryConfirmed);
    socket.on('deliveryDenied', handleDeliveryDenied);

    return () => {
      socket.off('deliveryConfirmed', handleDeliveryConfirmed);
      socket.off('deliveryAutoConfirmed', handleDeliveryConfirmed);
      socket.off('deliveryDenied', handleDeliveryDenied);
    };
  }, [socket, chatId]);

  useEffect(() => {
    if (!onDeliveryConfirmed) return;
    onDeliveryConfirmed(() => { setDeliveryMarked(false); });
  }, [onDeliveryConfirmed, setCurrentOrder]);

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

  // Single unified message listener — also replaces temp messages by tempId
  useEffect(() => {
    if (!socket || !chatId) return;

    const handleIncomingMessage = (msg) => {
      if (processedMessageIds.current.has(msg.id)) return;
      processedMessageIds.current.add(msg.id);

      // Check for order created message to reset taskCompleted
      if (msg.type === 'order_created' ||
        (msg.type === 'system' && msg.text?.includes('order created')) ||
        (msg.type === 'payment_request' && msg.paymentData?.orderId)) {

        // Only reset if this is a new order (different from current order)
        const newOrderId = msg.paymentData?.orderId || msg.orderId;
        if (newOrderId && currentOrder?.orderId !== newOrderId) {
          setTaskCompleted(false);
          setDeliveryMarked(false);
          setUserConfirmedDelivery(false);
        }
      }

      if (msg.type === 'fileUploadSuccess' || msg.messageType === 'fileUploadSuccess') return;

      if (
        msg.type === 'system' &&
        msg.text?.includes('must approve the items you sent')
      ) {
        processedMessageIds.current.add(msg.id);
        return;
      }

      if (
        msg.type === 'system' &&
        msg.id?.startsWith('delivery-confirmed-runner-')
      ) {
        setUserConfirmedDelivery(true);
      }

      if (
        msg.type === 'system' &&
        (msg.text?.toLowerCase().includes('task completed') || msg.id?.includes('task_completed'))
      ) {
        setTaskCompleted(true);
      }


      // Fast payment status update from system message flag
      if (msg.paymentConfirmed && msg.type === 'system') {
        setCurrentOrder(prev => ({
          ...(prev || {}),
          paymentStatus: 'paid',
          status: 'active',
        }));
      }

      const formattedMsg = {
        ...msg,
        from: msg.from === 'system' || msg.type === 'system' || msg.senderType === 'system' || msg.senderId === 'system'
          ? 'system' : msg.senderId === runnerId ? 'me' : 'them',
        type: msg.type || msg.messageType || 'text',
      };

      // Flag item approval so OrderStatusFlow can unlock 'purchase_completed'
      if (msg.type === 'system' && msg.text?.includes('approved the items')) {
        formattedMsg.itemsApproved = true;
      }

      setMessages(prev => {
        // Replace optimistic temp message if tempId matches
        if (msg.tempId) {
          const hasTmp = prev.some(m => m.id === msg.tempId || m.tempId === msg.tempId);
          if (hasTmp) {
            return prev.map(m =>
              (m.id === msg.tempId || m.tempId === msg.tempId)
                ? { ...formattedMsg }
                : m
            );
          }
        }
        const exists = prev.some(m => m.id === msg.id);
        if (exists) return prev.map(m => m.id === msg.id ? { ...m, ...formattedMsg } : m);
        return [...prev, formattedMsg];
      });


    };

    socket.on('message', handleIncomingMessage);
    return () => socket.off('message', handleIncomingMessage);
  }, [socket, chatId, runnerId, setMessages, setCurrentOrder, setTaskCompleted, currentOrder?.orderId]);

  useEffect(() => {
    if (!socket) return;
    const handleItemUpdate = (data) => {
      setMessages(prev => prev.map(m =>
        m.submissionId === data.submissionId || m.id === data.submissionId
          ? { ...m, status: data.status, rejectionReason: data.rejectionReason }
          : m
      ));
    };
    socket.on('itemSubmissionUpdated', handleItemUpdate);
    return () => socket.off('itemSubmissionUpdated', handleItemUpdate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  useEffect(() => {
    if (!socket || !chatId) return;

    const handleReconnect = () => {
      // Seed processedMessageIds from current messages so nothing already shown gets re-added
      messagesRef.current?.forEach(m => { if (m.id) processedMessageIds.current.add(m.id); });
      socket.emit('rejoinChat', { chatId, runnerId, userType: 'runner' });
    };

    const handleMissedMessages = (msgs) => {
      if (!msgs?.length) return;
      setMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        const toAdd = msgs
          .filter(m => !existingIds.has(m.id) && !processedMessageIds.current.has(m.id))
          .map(msg => {
            processedMessageIds.current.add(msg.id);

            // Update order payment status if payment confirmation arrives
            if (msg.paymentConfirmed ||
              (msg.type === 'system' && msg.text?.toLowerCase().includes('made payment for this task'))) {
              setCurrentOrder(prev => prev ? { ...prev, paymentStatus: 'paid', status: 'active' } : prev);
            }

            const isSystem = msg.from === 'system' || msg.type === 'system' ||
              msg.messageType === 'system' || msg.senderType === 'system' || msg.senderId === 'system';
            return {
              ...msg,
              from: isSystem ? 'system' : (msg.senderId === runnerId ? 'me' : 'them'),
              type: msg.type || msg.messageType || 'text',
            };
          });
        return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
      });
    };

    socket.on('connect', handleReconnect);
    socket.on('missedMessages', handleMissedMessages);
    return () => {
      socket.off('connect', handleReconnect);
      socket.off('missedMessages', handleMissedMessages);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, chatId, runnerId]);

  useEffect(() => {
    const hasTaskCompleted = messages.some(m =>
      (m.type === 'system' || m.from === 'system') &&
      m.text?.toLowerCase().includes('task completed')
    );
    if (hasTaskCompleted) setTaskCompleted(true);
  }, [messages, setTaskCompleted]);

  // ─── Message actions ──────────────────────────────────────────────────────

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

  // ─── File upload ──────────────────────────────────────────────────────────

  const handleFileSelect = async (event) => {
    const files = Array.from(event.target.files);
    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) { alert(`"${file.name}" exceeds 10MB limit.`); continue; }

      // Derive type for optimistic message
      let msgType = 'file';
      if (file.type.startsWith('image/')) msgType = 'image';
      else if (file.type.startsWith('video/')) msgType = 'video';
      else if (file.type.startsWith('audio/')) msgType = 'audio';

      const tempId = `temp-${Date.now()}-${file.name}`;
      const localUrl = URL.createObjectURL(file);

      // Add optimistic message with local preview immediately
      setMessages(prev => [...prev, {
        id: tempId,
        tempId,
        from: 'me',
        type: msgType,
        fileName: file.name,
        fileType: file.type,
        fileUrl: localUrl,
        text: '',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'uploading',
        senderId: runnerId,
        senderType: 'runner',
        isUploading: true,
        createdAt: new Date().toISOString(),
      }]);

      try {
        await uploadFileWithProgress(file, {
          chatId,
          senderId: runnerId,
          senderType: 'runner',
          tempId,
          type: msgType,
        });
      } catch (error) {
        console.error('Upload error:', error);
        // Remove failed optimistic message
        setMessages(prev => prev.filter(m => m.id !== tempId));
        URL.revokeObjectURL(localUrl);
      }
    }
    event.target.value = '';
  };

  const handleAttachClickInternal = () => fileInputRef.current?.click();

  const handleSendPhoto = async (image, replyText) => {
    if (!selectedUser || !runnerId) return;
    try {
      const blob = await (await fetch(image)).blob();
      const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
      const tempId = `temp-${Date.now()}-photo`;
      setMessages(prev => [...prev, {
        id: tempId, tempId, from: 'me', type: 'image', fileName: file.name, fileType: 'image/jpeg',
        fileUrl: image, text: replyText || '',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'uploading', senderId: runnerId, senderType: 'runner', isUploading: true,
        ...(replyingTo && { replyTo: replyingTo.id, replyToMessage: replyingTo.text || replyingTo.fileName || 'Media', replyToFrom: replyingTo.from }),
      }]);
      await uploadFileWithProgress(file, {
        chatId, senderId: runnerId, senderType: 'runner', tempId, text: replyText || '', type: 'image',
        ...(replyingTo && { replyTo: replyingTo.id, replyToMessage: replyingTo.text || replyingTo.fileName || 'Media', replyToFrom: replyingTo.from }),
      });
      setShowCameraPreview(false); setPreviewImage(null); closePreview(); setReplyingTo(null);
    } catch (error) {
      console.error('Error sending photo:', error);
      setShowCameraPreview(false); setPreviewImage(null); closePreview();
    }
  };

  // ─── Item submission ──────────────────────────────────────────────────────

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
      setMessages(prev => [...prev, {
        id: `items-submitted-${Date.now()}`,
        from: 'system',
        type: 'system',
        messageType: 'system',
        text: `You submitted item(s). ${selectedUser?.firstName || 'User'} must approve the items you sent before marking "Purchase completed".`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'sent',
        senderId: 'system',
        senderType: 'system',
        style: 'info',
        isItemSubmissionProof: true,
        hasItemPhotos: itemsData.hasItemPhotos ?? false,
      }]);

      setShowItemSubmissionForm(false);
    } catch (error) { console.error('Error submitting items:', error); throw error; }
  };

  const openItemSubmissionForm = () => {
    if (!currentOrder) return alert('No active order. Wait for user to place an order.');
    if (!isRunErrand) return alert('Item submission is only for run-errand tasks.');
    if (currentOrder.paymentStatus !== 'paid') return alert('Wait for user to complete payment.');
    setShowItemSubmissionForm(true);
  };

  // ─── Delivery 
  const handleMarkDeliveryComplete = () => {
    return new Promise((resolve, reject) => {
      if (!socket || !currentOrder || !chatId) return reject(new Error('Missing data'));

      // Listen for server error response
      const onError = (err) => {
        socket.off('error', onError);
        socket.off('deliveryMarkedComplete', onSuccess);
        reject(new Error(err.message));
      };

      const onSuccess = () => {
        socket.off('error', onError);
        socket.off('deliveryMarkedComplete', onSuccess);
        setDeliveryMarked(true);
        resolve();
      };

      socket.once('error', onError);
      socket.once('deliveryMarkedComplete', onSuccess);

      socket.emit('markDeliveryComplete', {
        chatId,
        orderId: currentOrder.orderId,
        runnerId,
        deliveryProof: null
      });

      // Timeout fallback — if no response in 10s, reject
      setTimeout(() => {
        socket.off('error', onError);
        socket.off('deliveryMarkedComplete', onSuccess);
        reject(new Error('No response from server'));
      }, 10000);
    });
  };

  const handleStatusMessage = useCallback((systemMessage) => {
    setMessages(prev => {
      if (prev.some(m => m.id === systemMessage.id)) return prev;
      return [...prev, systemMessage];
    });
  }, [setMessages]);

  const handleKeyDown = () => handleTyping();

  const getFirstLetter = (name) => name ? name.charAt(0).toUpperCase() : 'U';
  const getRandomBgColor = (name) => {
    if (!name) return 'bg-green-500';
    const colors = ['bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-green-500', 'bg-teal-500', 'bg-blue-500', 'bg-indigo-500', 'bg-purple-500', 'bg-pink-500', 'bg-rose-500'];
    return colors[name.charCodeAt(0) % colors.length];
  };

  const callerName = selectedUser ? `${selectedUser.firstName} ${selectedUser.lastName || ''}` : 'User';
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


  console.log('canSubmitItems:', canSubmitItems, {
    isRunErrand,
    paymentStatus: currentOrder?.paymentStatus,
    currentOrder,
  });

  return (
    <>
      {callState !== "idle" && callType === "voice" && (
        <CallScreen
          callState={callState}
          callType={callType}
          callerName={callerName}
          callerAvatar={callerAvatar}
          isMuted={isMuted}
          isCameraOff={isCameraOff}
          formattedDuration={formattedDuration}
          remoteUsers={remoteUsers}
          localVideoTrack={localVideoTrack}
          onAccept={acceptCall}
          onDecline={declineCall}
          onEnd={endCall}
          onToggleMute={toggleMute}
          onToggleCamera={toggleCamera}
        />
      )}

      {callState !== "idle" && callType === "video" && (
        <VideoCallScreen
          callState={callState}
          callType={callType}
          callerName={callerName}
          callerAvatar={callerAvatar}
          isMuted={isMuted}
          isCameraOff={isCameraOff}
          isSpeakerOn={isSpeakerOn}
          formattedDuration={formattedDuration}
          remoteUsers={remoteUsers}
          localVideoTrack={localVideoTrack}
          networkQuality={networkQuality}
          darkMode={dark}
          onAccept={acceptCall}
          onDecline={declineCall}
          onEnd={endCall}
          onToggleMute={toggleMute}
          onToggleCamera={toggleCamera}
          onSwitchCamera={switchCamera}
          onToggleSpeaker={toggleSpeaker}
        />
      )}

      <section className="flex flex-col min-w-0 overflow-hidden h-full scroll-smooth relative">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 min-w-0 px-5 py-3">
          <div className="flex gap-3">
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
                {selectedUser ? `${selectedUser?.firstName} ${selectedUser?.lastName || ''}` : 'User'}
              </div>
              <div className="text-sm font-medium text-gray-900">Online</div>
            </div>
          </div>

          <div>
            <div className="items-center gap-3 flex">
              <span className="bg-gray-1000 dark:bg-black-200 rounded-full w-10 h-10 flex items-center justify-center">
                <IconButton variant="text" className="rounded-full" onClick={() => initiateCall('video', selectedUser?._id, 'user')} >
                  <Video className="h-6 w-6" />
                </IconButton>
              </span>
              <span className="bg-gray-1000 dark:bg-black-200 rounded-full w-10 h-10 flex items-center justify-center">
                <IconButton onClick={() => initiateCall('voice', selectedUser?._id, 'user')} variant="text" className="rounded-full">
                  <Phone className="h-6 w-6" />
                </IconButton>
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
            media={specialInstructions?.media || []}
            onClick={() => setShowSpecialInstructionsModal(true)}
            darkMode={dark}
          />
        )}

        {/* Messages */}
        <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-6 py-4 bg-chat-pattern bg-gray-100 dark:bg-black-200">
          <div className="mx-auto max-w-3xl">
            {messages.map((m) => (
              <Message key={m.id} m={m} darkMode={dark} userType="runner"
                onMessageClick={() => { }} showCursor={false} isChatActive={isChatActive}
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
          {taskCompleted ? (
            <div className="px-4 py-4">
              <button
                onClick={() => {
                  if (backHomeDisabled) return;
                  setBackHomeDisabled(true);
                  try {
                    localStorage.setItem(`backHome_disabled_${chatId}`, 'true');
                  } catch { }
                  onStartNewOrder?.();
                }}
                disabled={backHomeDisabled}
                className={`w-full py-4 rounded-xl font-semibold text-white transition-all
          ${backHomeDisabled ? 'bg-gray-400 cursor-not-allowed opacity-60' : 'bg-primary hover:opacity-90'}`}
              >
                {backHomeDisabled ? 'Returning...' : 'Back to Home'}
              </button>
            </div>
          ) : orderCancelled ? (
            <div className={`px-4 py-4 text-center text-sm font-medium ${dark ? 'text-gray-400 bg-black-100' : 'text-gray-500 bg-gray-100'} rounded-xl mx-4 my-3`}>
              {cancellationReason === 'runner' ? 'You cancelled this order' : 'Order was cancelled'}
            </div>
          ) : (
            <ChatComposer
              isChatActive={isChatActive}
              text={text}
              handleKeyDown={handleKeyDown}
              setText={setText}
              selectedUser={selectedUser}
              handleTextChange={handleTextChange}
              send={() => send(replyingTo)}
              handleLocationClick={handleLocationClick}
              handleAttachClick={handleAttachClickInternal}
              fileInputRef={fileInputRef}
              replyingTo={replyingTo}
              onCancelReply={handleCancelReply}
              darkMode={dark}
              setIsAttachFlowOpen={setIsAttachFlowOpen}
              currentOrder={currentOrder}
              // required for audio upload + optimistic messages ───
              uploadFileWithProgress={uploadFileWithProgress}
              chatId={chatId}
              setMessages={setMessages}
              runnerId={runnerId}
            />
          )}


          {/* Hidden file input — onChange wired to handleFileSelect */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
            multiple
          />

          {showOrderFlow && selectedUser && (
            <OrderStatusFlow
              isOpen={showOrderFlow}
              onClose={() => setShowOrderFlow(false)}
              orderData={{
                deliveryLocation: selectedUser?.currentRequest?.deliveryLocation || 'No address',
                deliveryCoordinates: selectedUser?.currentRequest?.deliveryCoordinates || null,
                pickupLocation: selectedUser?.currentRequest?.pickupLocation || selectedUser?.currentRequest?.marketLocation || 'No address',
                pickupCoordinates: selectedUser?.currentRequest?.pickupCoordinates || null,
                marketLocation: selectedUser?.currentRequest?.marketLocation || null,
                marketCoordinates: selectedUser?.currentRequest?.marketCoordinates || null,
                userData: selectedUser,
                chatId,
                orderId: currentOrder?.orderId,
                runnerId,
                userId: selectedUser?._id,
                serviceType,
                usedPayoutSystem: currentOrder?.usedPayoutSystem ?? false
              }}
              darkMode={dark}
              onStatusClick={handleOrderStatusClick}
              completedStatuses={completedOrderStatuses}
              setCompletedStatuses={setCompletedOrderStatuses}
              socket={socket}
              taskType={isRunErrand ? 'run-errand' : 'pickup_delivery'}
              runnerFleetType={runnerFleetType}
              onStatusMessage={handleStatusMessage}
              messagesRef={messagesRef}
              deliveryMarked={deliveryMarked}
              userConfirmedDelivery={userConfirmedDelivery}
            />
          )}

          {isAttachFlowOpen && (
            <AttachmentOptionsFlow
              isOpen={isAttachFlowOpen}
              onClose={() => setIsAttachFlowOpen(false)}
              currentOrder={currentOrder}
              deliveryMarked={deliveryMarked}
              onMarkDelivery={() => { setIsAttachFlowOpen(false); handleMarkDeliveryComplete(); }}
              darkMode={dark}
              onSelectCamera={() => { setIsAttachFlowOpen(false); openCamera(); }}
              showSubmitItems={canSubmitItems}
              onSubmitItems={() => { setIsAttachFlowOpen(false); openItemSubmissionForm(); }}
              serviceType={serviceType}
              messages={messages}
              onSelectGallery={() => {
                setIsAttachFlowOpen(false);
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*,video/*';
                input.multiple = false;
                input.onchange = async (e) => {
                  const file = e.target.files[0];
                  if (!file) return;

                  let msgType = 'image';
                  if (file.type.startsWith('video/')) msgType = 'video';

                  const tempId = `temp-${Date.now()}-gallery`;
                  const localUrl = URL.createObjectURL(file);

                  // Show optimistic message immediately
                  setMessages(prev => [...prev, {
                    id: tempId, tempId, from: 'me', type: msgType,
                    fileName: file.name, fileType: file.type,
                    fileUrl: localUrl, text: '',
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    status: 'uploading', senderId: runnerId, senderType: 'runner', isUploading: true,
                    createdAt: new Date().toISOString(),
                  }]);

                  try {
                    await uploadFileWithProgress(file, {
                      chatId, senderId: runnerId, senderType: 'runner', tempId, type: msgType,
                    });
                  } catch (err) {
                    console.error('Gallery upload error:', err);
                    setMessages(prev => prev.filter(m => m.id !== tempId));
                    URL.revokeObjectURL(localUrl);
                  }
                };
                input.click();
              }}
            />
          )}

          {showCameraPreview && previewImage && !showItemSubmissionForm && (
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
          <div className="fixed inset-0 bg-black z-[9999] flex flex-col overflow-hidden">
            <div className="flex justify-between items-center p-4 bg-black/80 flex-shrink-0">
              <Button onClick={closeCamera} className="text-white px-4 py-2 hover:bg-white/10 rounded-lg">Cancel</Button>
              <h3 className="text-white text-lg font-medium">Take Photo</h3>
              <div className="w-16"></div>
            </div>

            {/* Camera preview area - takes remaining space */}
            <div className="flex-1 relative bg-black min-h-0">
              {!capturedImage ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="absolute inset-0 w-full h-full object-cover"
                    style={{ transform: 'scaleX(-1)' }}
                  />
                </>
              ) : (
                <>
                  <img
                    src={capturedImage}
                    alt="Captured"
                    className="absolute inset-0 w-full h-full object-contain bg-black"
                  />
                </>
              )}
            </div>

            {/* Action buttons - fixed at bottom */}
            <div className="flex-shrink-0 bg-black p-4">
              {!capturedImage ? (
                <div className="gap-3 flex justify-center">
                  <Button
                    onClick={capturePhoto}
                    className="w-16 h-16 rounded-full bg-white border-4 border-gray-300 hover:bg-gray-100 shadow-2xl active:scale-95 transition-transform"
                  />

                  <Button onClick={switchCamera} className="text-white px-3 py-2 rounded-lg">
                    <RefreshCw />
                  </Button>
                </div>
              ) : (
                <div className="flex justify-center gap-4">
                  <Button
                    onClick={retakePhoto}
                    className="px-6 py-3 bg-gray-600 text-white rounded-lg shadow-lg hover:bg-gray-700 active:scale-95 transition-transform"
                  >
                    Retake
                  </Button>
                  <Button
                    onClick={() => {
                      const photo = capturedImage;
                      closeCamera();
                      setTimeout(() => { setPreviewImage(photo); setShowCameraPreview(true); }, 100);
                    }}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg shadow-lg hover:bg-blue-700 active:scale-95 transition-transform"
                  >
                    Use Photo
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        <SpecialInstructionsModal
          isOpen={showSpecialInstructionsModal}
          onClose={() => setShowSpecialInstructionsModal(false)}
          userName={`${selectedUser?.firstName || 'User'} ${selectedUser?.lastName || ''}`}
          instructions={specialInstructions}
          darkMode={dark}
        />
      </section>

      {showItemSubmissionForm && (
        <ItemSubmissionForm
          isOpen={showItemSubmissionForm}
          onClose={() => setShowItemSubmissionForm(false)}
          onSubmit={handleSubmitItems}
          darkMode={dark}
          orderBudget={currentOrder?.budget || currentOrder?.itemBudget || 0}

          openCamera={openCamera}
          closeCamera={closeCamera}
          capturePhoto={capturePhoto}
          retakePhoto={retakePhoto}
          capturedImage={capturedImage}
          videoRef={videoRef}
          cameraOpen={cameraOpen}
          isPreviewOpen={isPreviewOpen}
          closePreview={closePreview}
          cameraUsedByItemFormRef={cameraUsedByItemFormRef}
        />
      )}
    </>
  );
}

export default React.memo(RunnerChatScreen);