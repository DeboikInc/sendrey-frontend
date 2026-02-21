import React, { useState, useRef, useEffect, useCallback } from "react";
import { IconButton, Tooltip } from "@material-tailwind/react";
import { Phone, Video, MoreHorizontal } from "lucide-react";
import Header from "../common/Header";
import Message from "../common/Message";
import CustomInput from "../common/CustomInput";
import CallScreen from "../common/CallScreen";

import { TrackDeliveryScreen } from "./TrackDeliveryScreen";
import ProfileCardMessage from "../runnerScreens/ProfileCardMessage";
import PaymentRequestMessage from "../common/PaymentRequestMessage";

import { useSocket } from "../../hooks/useSocket";
import { useCallHook } from "../../hooks/useCallHook";
import { usePushNotifications } from "../../hooks/usePushNotifications";
import { useTypingAndRecordingIndicator } from '../../hooks/useTypingIndicator';

import { useDispatch } from 'react-redux';
import { createPaymentIntent } from '../../Redux/paymentSlice';
import PaystackPaymentModal from "../common/PaystackPaymentModal";

import MoreOptionsSheet from './MoreOptionsSheet';
import UserWallet from './UserWallet';
import DisputeForm from '../common/DisputeForm';
import RatingModal from '../common/RatingModal';
import { checkCanRate } from '../../Redux/ratingSlice';
import OrderDetailsSheet from '../common/OrderDetailsSheet';

const HeaderIcon = ({ children, tooltip, onClick }) => (
  <Tooltip content={tooltip} placement="bottom" className="text-xs">
    <IconButton variant="text" size="sm" className="rounded-full" onClick={onClick}>
      {children}
    </IconButton>
  </Tooltip>
);

export default function ChatScreen({ runner, userData, darkMode, toggleDarkMode, onBack }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [uploadingFiles, setUploadingFiles] = useState(new Set());
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [replyingTo, setReplyingTo] = useState(null);

  const listRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingIntervalRef = useRef(null);
  const processedMessageIds = useRef(new Set());

  const dispatch = useDispatch();
  const [paystackModal, setPaystackModal] = useState(null);

  const [showMoreSheet, setShowMoreSheet] = useState(false);
  const [showWallet, setShowWallet] = useState(false);
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingOrderId, setRatingOrderId] = useState(null);
  const [currentOrder, setCurrentOrder] = useState(null);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  const [canRate, setCanRate] = useState(false);
  const [paidChatIds, setPaidChatIds] = useState(new Set());
  const currentOrderRef = useRef(null);
  const serviceType = userData?.currentRequest?.serviceType || null;

  const hasJoinedRef = useRef(false);

  const {
    socket,
    joinChat,
    sendMessage,
    isConnected,
    uploadFile,
    onFileUploadSuccess,
    onFileUploadError,
    onPromptRating,
    onOrderCreated,
    onPaymentConfirmed,
    onDeliveryConfirmed,
    onMessageDeleted,
    onDisputeResolved,
    onReceiveTrackRunner,
  } = useSocket();

  const { permission, requestPermission } = usePushNotifications({
    userId: userData?._id,
    userType: 'user',
    socket,
  });

  const chatId = userData?._id && runner?._id
    ? `user-${userData._id}-runner-${runner._id}`
    : null;

  const { handleTyping, handleRecordingStart, handleRecordingStop,
    otherUserTyping, otherUserRecording } = useTypingAndRecordingIndicator({
      socket, chatId, currentUserId: userData?._id, currentUserType: 'user',
    });

  const {
    callState, callType, isMuted, isCameraOff, formattedDuration,
    remoteUsers, localVideoTrack, initiateCall, acceptCall,
    declineCall, endCall, toggleMute, toggleCamera,
  } = useCallHook({
    socket, chatId, currentUserId: userData?._id, currentUserType: "user",
  });

  // ─── Helpers 

  const formatMessage = useCallback((msg) => ({
    ...msg,
    from: msg.from === 'system' || msg.senderType === 'system' || msg.senderId === 'system'
      ? 'system'
      : msg.senderId === userData?._id ? 'me' : 'them',
    type: msg.messageType === 'payment_request' ? 'payment_request'  // ← force it
      : msg.type || msg.messageType || 'text',
  }), [userData?._id]);

  // ─── Scroll 

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [selectedFiles.length, replyingTo]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  // ─── Setup 

  useEffect(() => {
    if (userData?._id && socket && permission === 'default') requestPermission();
  }, [userData?._id, socket, permission, requestPermission]);

  useEffect(() => {
    processedMessageIds.current = new Set();
  }, [chatId]);

  useEffect(() => {
    if (socket && userData?._id) {
      socket.emit('rejoinUserRoom', { userId: userData._id, userType: 'user' });
    }
  }, [socket, userData?._id]);

  // ─── File upload 

  useEffect(() => {
    onFileUploadSuccess((data) => {
      if (data.message?.id) processedMessageIds.current.add(data.message.id);
      setMessages(prev => prev.map(msg => {
        const isMatch = msg.tempId === data.tempId || msg.id === data.tempId;
        if (!isMatch) return msg;
        processedMessageIds.current.delete(msg.id);
        processedMessageIds.current.delete(msg.tempId);
        return {
          ...msg, ...data.message,
          id: data.message?.id || msg.id,
          from: "me", isUploading: false,
          fileUrl: data.message?.fileUrl || data.cloudinaryUrl,
          status: "sent", tempId: undefined,
        };
      }));
      setUploadingFiles(prev => { const s = new Set(prev); s.delete(data.tempId); return s; });
    });

    onFileUploadError((data) => {
      setMessages(prev => prev.map(msg => {
        if (msg.id !== data.tempId && msg.tempId !== data.tempId) return msg;
        return { ...msg, status: "failed", isUploading: false, text: `Failed to upload: ${data.error}` };
      }));
      setUploadingFiles(prev => { const s = new Set(prev); s.delete(data.tempId); return s; });
    });
  }, [onFileUploadSuccess, onFileUploadError]);

  // ─── Main chat join

  useEffect(() => {
    if (!socket || !isConnected || !chatId) return;
    if (hasJoinedRef.current) return;
    hasJoinedRef.current = true;

    joinChat(
      chatId,
      { taskId: runner?._id || userData?._id || 'pending', serviceType },
      async (msgs) => {
        console.log('RAW CHAT HISTORY:', msgs.map(m => ({
          id: m.id,
          type: m.type,
          messageType: m.messageType,
          hasPaymentData: !!m.paymentData,
          paymentData: m.paymentData,
        })));

        if (!msgs?.length) return;

        processedMessageIds.current = new Set();
        const formatted = msgs.map(msg => {
          processedMessageIds.current.add(msg.id);
          return formatMessage(msg);
        });
        console.log('FORMATTED:', formatted.map(m => ({ id: m.id, type: m.type, from: m.from })))
        setMessages(prev => {
          if (prev.length > 0) return prev; // already have messages, don't overwrite
          return formatted;
        });

        const invoiceMsg = msgs.find(m => m.type === 'invoice' && m.invoiceData?.orderId);
        if (invoiceMsg?.invoiceData) {
          setCurrentOrder(prev => prev || {
            orderId: invoiceMsg.invoiceData.orderId,
            ...invoiceMsg.invoiceData,
          });
        }

        const paymentMsg = msgs.find(m => m.type === 'payment_request');
        if (paymentMsg && invoiceMsg) {
          setPaidChatIds(prev => new Set(prev).add(chatId));
        }

        const taskDoneMsg = msgs.find(m =>
          m.type === 'task_completed' || m.messageType === 'task_completed' ||
          (m.type === 'system' && m.text?.toLowerCase().includes('task completed'))
        );
        if (taskDoneMsg) {
          const orderId = taskDoneMsg.orderId || invoiceMsg?.invoiceData?.orderId;
          if (orderId && orderId !== 'undefined') {
            try {
              const result = await dispatch(checkCanRate(orderId)).unwrap();
              if (result?.canRate || result.data?.canRate) { setRatingOrderId(orderId); setCanRate(true); }
            } catch (_) { }
          }
        }
      },
      (msg) => {
        if (processedMessageIds.current.has(msg.id)) return;
        if (msg.type === 'fileUploadSuccess' || msg.messageType === 'fileUploadSuccess') return;

        processedMessageIds.current.add(msg.id);

        setMessages(prev => {
          const exists = prev.some(m => m.id === msg.id);
          if (exists) {
            return prev.map(m => m.id === msg.id
              ? { ...m, ...formatMessage(msg), isUploading: false, fileUrl: msg.fileUrl || m.fileUrl }
              : m
            );
          }
          return [...prev, formatMessage(msg)];
        });

        // Detect task_completed in real-time and trigger rating flow
        const isTaskDone =
          msg.type === 'task_completed' ||
          msg.messageType === 'task_completed' ||
          (msg.type === 'system' && msg.text?.toLowerCase().includes('task completed'));

        if (isTaskDone) {

          // orderId may be on the message, or fall back to currentOrder
          const orderId = msg.orderId || currentOrderRef.current?.orderId || null;
          console.log('task_completed message received in real-time, orderId:', msg.orderId);
          if (orderId && orderId !== 'undefined') {
            dispatch(checkCanRate(orderId)).unwrap()
              .then(result => {
                console.log('checkCanRate result:', JSON.stringify(result));
                if (result?.canRate || result.data?.canRate) {
                  console.log('canRate=true, showing rating modal');
                  setRatingOrderId(orderId);
                  setCanRate(true);
                  setTimeout(() => setShowRatingModal(true), 1500);
                }
              })
              .catch(err => console.error('checkCanRate error:', err));
          } else {
            // No orderId on message yet — wait for promptRating from backend (1s delay)
            console.log('task_completed has no orderId, waiting for promptRating event...');
          }
        }
      }
    );
  }, [socket, chatId, isConnected]);

  // Reset when chatId changes
  useEffect(() => {
    hasJoinedRef.current = false;
  }, [chatId]);

  useEffect(() => {
    currentOrderRef.current = currentOrder;
  }, [currentOrder]);

  // ─── Socket listeners — all via useSocket (socketRef, no stale state) ─────────

  useEffect(() => {
    onReceiveTrackRunner((data) => {
      setMessages(prev => [...prev, {
        id: `track-${Date.now()}`, from: "them", type: "tracking",
        trackingData: data.trackingData,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "sent",
      }]);
    });
  }, [onReceiveTrackRunner]);

  useEffect(() => {
    onDeliveryConfirmed((data) => {
      setMessages(prev => prev.map(m =>
        m.type === 'delivery_confirmation_request' && m.orderId === data.orderId
          ? { ...m, confirmationStatus: 'confirmed' } : m
      ));
    });
  }, [onDeliveryConfirmed]);

  useEffect(() => {
    onMessageDeleted(({ messageId, deletedBy }) => {
      const isMe = deletedBy === userData?._id;
      setMessages(prev => prev.map(msg => msg.id === messageId
        ? { ...msg, deleted: true, text: isMe ? "You deleted this message" : "This message was deleted", type: "deleted", fileUrl: null, fileName: null }
        : msg
      ));
    });
  }, [onMessageDeleted, userData?._id]);

  useEffect(() => {
    onPromptRating(async (data) => {
      if (!data.orderId || data.orderId === 'undefined') return;
      setCurrentOrder(prev => prev || { orderId: data.orderId });
      try {
        const result = await dispatch(checkCanRate(data.orderId)).unwrap();
        console.log('checkCanRate result:', JSON.stringify(result));
        if (result?.canRate || result.data?.canRate) {
          setRatingOrderId(data.orderId);
          setCanRate(true);
          setTimeout(() => setShowRatingModal(true), 1500);
        }
      } catch (_) { }
    });
  }, [onPromptRating, dispatch]);

  useEffect(() => {
    onOrderCreated((data) => {
      setCurrentOrder(data.order);

      // Only mark as paid if order is actually paid
      if (data.order?.paymentStatus === 'paid') {
        setPaidChatIds(prev => new Set(prev).add(chatId));
      }
    });
  }, [onOrderCreated, chatId]);

  useEffect(() => {
    onPaymentConfirmed((data) => {
      if (data.order) setCurrentOrder(prev => ({ ...prev, ...data.order }));
      setPaidChatIds(prev => new Set(prev).add(chatId));
    });
  }, [onPaymentConfirmed, chatId]);

  useEffect(() => {
    onDisputeResolved((data) => {
      setMessages(prev => prev.map(m =>
        m.type === 'dispute_raised' && m.disputeId === data.disputeId
          ? { ...m, status: 'resolved' } : m
      ));
    });
  }, [onDisputeResolved]);

  useEffect(() => {
    return () => { if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current); };
  }, []);

  // ─── Payment 

  const handlePayment = async (paymentData, paymentMethod) => {
    // testing only
    setPaidChatIds(prev => new Set(prev).add(chatId));
    setCurrentOrder(prev => ({ ...prev, paymentStatus: 'paid', status: 'active' }));
    setMessages(prev => [...prev, {
      id: `payment-success-${Date.now()}`,
      from: 'system', type: 'payment_success',
      text: 'Payment successful! Your task is now funded.',
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    }]);
    // Also update backend so checkCanRate passes
    if (socket) socket.emit('mockPayment', {
      chatId,
      orderId: paymentData?.orderId || currentOrderRef.current?.orderId
    });
    return;

    const { totalAmount, userId, runnerId: pRunnerId } = paymentData;

    const pendingMsg = {
      id: `payment-pending-${Date.now()}`, from: 'system', type: 'payment_pending',
      text: 'Processing payment...',
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages(prev => [...prev, pendingMsg]);

    try {
      const result = await dispatch(createPaymentIntent({
        chatId,
        userId,
        runnerId: pRunnerId || runner?._id,
        amount: totalAmount,
        paymentMethod,
        serviceType,
      })).unwrap();

      setMessages(prev => prev.filter(m => m.id !== pendingMsg.id));

      if (paymentMethod === 'wallet') {
        setMessages(prev => [...prev, {
          id: `payment-success-${Date.now()}`, from: 'system', type: 'payment_success',
          text: 'Payment successful! Your task is now funded.',
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        }]);
        if (socket) socket.emit('paymentSuccess', { chatId, escrowId: result.data?.escrowId });

      } else if (paymentMethod === 'card') {
        setPaystackModal({
          reference: result.data.reference,
          amount: result.data.amount,
          chatId,
          email: userData?.email || 'user@example.com',
        });
      }

    } catch (error) {
      console.error('Payment failed:', error);
      setMessages(prev => prev.filter(m => m.id !== pendingMsg.id));
      setMessages(prev => [...prev, {
        id: `payment-failed-${Date.now()}`, from: 'system', type: 'payment_failed',
        text: 'Payment failed. Please try again.',
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      }]);
    }
  };

  const handlePaystackSuccess = (reference) => {
    const modal = paystackModal;
    setPaystackModal(null);
    setMessages(prev => [...prev, {
      id: `payment-success-${Date.now()}`, from: "system", type: "payment_success",
      text: "Payment successful! Your task is now funded.",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    }]);
    if (socket) socket.emit("paymentSuccess", { chatId, reference: reference.reference });
  };

  // ─── Item / delivery

  const handleApproveItems = (submissionId, escrowId) => {
    if (socket) socket.emit('approveItems', { chatId, submissionId, escrowId, userId: userData?._id });
  };

  const handleRejectItems = (submissionId, reason) => {
    if (socket) socket.emit('rejectItems', { chatId, submissionId, reason });
  };

  const handleConfirmDelivery = (orderId) => {
    if (socket) socket.emit('confirmDelivery', { chatId, orderId, userId: userData?._id });
  };

  // ─── Messaging 

  const send = async () => {
    const hasText = text.trim();
    const hasFiles = selectedFiles.length > 0;
    if (!hasText && !hasFiles) return;

    if (hasText) {
      const messageId = Date.now().toString();
      const newMsg = {
        id: messageId, from: "me", text: text.trim(),
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "sent", senderId: userData?._id, senderType: "user",
        ...(replyingTo && {
          replyTo: replyingTo.id,
          replyToMessage: replyingTo.text || replyingTo.fileName || "Media",
          replyToFrom: replyingTo.from,
        })
      };
      processedMessageIds.current.add(messageId);
      setMessages(p => [...p, newMsg]);
      setText("");
      setReplyingTo(null);
      if (socket) sendMessage(chatId, newMsg);
    }

    if (hasFiles) {
      const filesToSend = [...selectedFiles];
      setSelectedFiles([]);

      for (let i = 0; i < filesToSend.length; i++) {
        const { file, name, type, size, preview } = filesToSend[i];
        let messageType = "file";
        if (type.startsWith("image/")) messageType = "image";
        else if (type.startsWith("audio/")) messageType = "audio";
        else if (type.startsWith("video/")) messageType = "video";

        const fileSize = size < 1024 * 1024
          ? `${(size / 1024).toFixed(1)} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`;
        const tempId = `temp-${Date.now()}-${i}`;
        processedMessageIds.current.add(tempId);

        const localMsg = {
          id: tempId, from: "me", type: messageType, fileName: name,
          fileUrl: preview, fileSize, text: "",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          status: "uploading", senderId: userData?._id, senderType: "user",
          fileType: type, isUploading: true, tempId,
        };
        setMessages(prev => [...prev, localMsg]);
        setUploadingFiles(prev => new Set(prev).add(tempId));

        try {
          const base64 = await fileToBase64(file);
          uploadFile({ chatId, file: base64, fileName: name, fileType: type, senderId: userData?._id, senderType: "user", tempId });
        } catch (err) {
          console.error('Upload error:', err);
          setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: "failed", isUploading: false } : m));
          setUploadingFiles(prev => { const s = new Set(prev); s.delete(tempId); return s; });
        }

        if (i < filesToSend.length - 1) await new Promise(r => setTimeout(r, 300));
      }
    }
  };

  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
  });

  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files).map(file => ({
      file, name: file.name, type: file.type, size: file.size, preview: URL.createObjectURL(file),
    }));
    setSelectedFiles(prev => [...prev, ...files]);
    event.target.value = "";
  };

  const handleRemoveFile = (index) => {
    setSelectedFiles(prev => {
      const next = [...prev];
      if (next[index].preview) URL.revokeObjectURL(next[index].preview);
      next.splice(index, 1);
      return next;
    });
  };

  // ─── Recording 

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const tempId = `audio-temp-${Date.now()}`;
        processedMessageIds.current.add(tempId);

        const localMsg = {
          id: tempId, from: "me", type: "audio", fileName: "voice-message.webm",
          fileUrl: URL.createObjectURL(audioBlob),
          fileSize: `${(audioBlob.size / 1024).toFixed(1)} KB`,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          status: "uploading", senderId: userData?._id, senderType: "user", isUploading: true, tempId,
        };
        setMessages(p => [...p, localMsg]);
        setUploadingFiles(prev => new Set(prev).add(tempId));

        try {
          const base64 = await fileToBase64(audioBlob);
          uploadFile({ chatId, file: base64, fileName: "voice-message.webm", fileType: "audio/webm", senderId: userData?._id, senderType: "user", tempId });
        } catch (err) {
          setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: "failed", isUploading: false } : m));
        }
        handleRecordingStop();
        stream.getTracks().forEach(t => t.stop());
        setRecordingTime(0);
      };
      mediaRecorderRef.current.start();
      handleRecordingStart();
      setIsRecording(true);
      recordingIntervalRef.current = setInterval(() => setRecordingTime(p => p + 1), 1000);
    } catch (err) {
      console.error("Mic error:", err);
      alert("Could not access microphone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      handleRecordingStop();
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    }
  };

  const toggleRecording = () => { if (isRecording) stopRecording(); else startRecording(); };

  // ─── Message actions

  const handleDeleteMessage = (messageId, deleteForEveryone = false) => {
    setMessages(prev => prev.map(msg => msg.id === messageId
      ? { ...msg, deleted: true, text: "You deleted this message", type: "deleted", fileUrl: null, fileName: null }
      : msg
    ));
    if (deleteForEveryone && socket && chatId) {
      socket.emit("deleteMessage", { chatId, messageId, userId: userData?._id, deleteForEveryone: true });
    }
  };

  const handleEditMessage = (messageId, newText) => {
    setMessages(prev => prev.map(msg => msg.id === messageId ? { ...msg, text: newText, edited: true } : msg));
  };

  const handleMessageReact = (messageId, emoji) => {
    setMessages(prev => prev.map(msg => msg.id === messageId ? { ...msg, reaction: emoji } : msg));
    if (socket && chatId) socket.emit("reactToMessage", { chatId, messageId, emoji, userId: userData?._id });
  };

  const handleMessageReply = (message) => {
    setReplyingTo(message);
    setTimeout(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, 100);
  };

  const handleScrollToMessage = (messageId) => {
    const el = document.getElementById(`message-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('highlight-message');
      setTimeout(() => el.classList.remove('highlight-message'), 2000);
    }
  };

  const callerName = `${runner?.firstName || ''} ${runner?.lastName || ''}`.trim();
  const callerAvatar = runner?.avatar || runner?.profilePicture || null;

  const TypingRecordingIndicator = () => {
    if (otherUserRecording) return (
      <div className="flex items-center gap-2 px-4 py-2">
        <div className="flex gap-1">
          {[12, 14, 16, 14, 12].map((h, i) => (
            <div key={i} className="w-1 bg-red-500 rounded-full animate-pulse"
              style={{ height: `${h}px`, animationDelay: `${i * 0.2}s` }} />
          ))}
        </div>
        <span className="text-sm text-red-500">Recording audio...</span>
      </div>
    );
    if (otherUserTyping) return (
      <div className="flex items-center gap-2 px-4 py-2">
        <div className="flex gap-1">
          {[0, 150, 300].map((d, i) => (
            <span key={i} className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
          ))}
        </div>
        <span className="text-sm text-gray-500">typing...</span>
      </div>
    );
    return null;
  };



  return (
    <>
      {showOrderDetails && (
        <OrderDetailsSheet
          isOpen={showOrderDetails}
          onClose={() => setShowOrderDetails(false)}
          darkMode={darkMode}
          order={currentOrder}
          escrow={currentOrder?.escrow || { status: currentOrder?.escrowStatus }}
        />
      )}

      {showRatingModal && (
        <RatingModal
          isOpen={showRatingModal}
          onClose={() => { setShowRatingModal(false); setRatingOrderId(null); setCanRate(false); }}
          darkMode={darkMode}
          orderId={ratingOrderId}
          chatId={chatId}
          runnerId={runner?._id}
          runnerName={callerName}
          runnerAvatar={runner?.avatar}
          socket={socket}
        />
      )}

      {showDisputeForm && (
        <DisputeForm
          isOpen={showDisputeForm}
          onClose={() => setShowDisputeForm(false)}
          darkMode={darkMode}
          orderId={currentOrder?.orderId}
          chatId={chatId}
          userId={userData?._id}
          runnerId={runner?._id}
          raisedBy="user"
          raisedById={userData?._id}
          socket={socket}
        />
      )}

      {showWallet && (
        <div className="fixed inset-0 z-50">
          <UserWallet darkMode={darkMode} onBack={() => setShowWallet(false)} userData={userData} />
        </div>
      )}

      <MoreOptionsSheet
        isOpen={showMoreSheet}
        onClose={() => setShowMoreSheet(false)}
        darkMode={darkMode}
        serviceType={serviceType}
        onWallet={() => { setShowMoreSheet(false); setShowWallet(true); }}
        onRaiseDispute={() => { setShowMoreSheet(false); setShowDisputeForm(true); }}
        onOrderDetails={() => { setShowMoreSheet(false); setShowOrderDetails(true); }}
        hasActiveOrder={!!currentOrder}
        canRate={canRate}
        onRateRunner={() => { setShowMoreSheet(false); if (ratingOrderId) setShowRatingModal(true); }}
      />

      {paystackModal && (
        <PaystackPaymentModal
          reference={paystackModal.reference}
          amount={paystackModal.amount}
          email={paystackModal.email}
          darkMode={darkMode}
          onSuccess={handlePaystackSuccess}
          onCancel={() => setPaystackModal(null)}
        />
      )}

      {callState !== "idle" && (
        <CallScreen
          callState={callState} callType={callType} callerName={callerName}
          callerAvatar={callerAvatar} isMuted={isMuted} isCameraOff={isCameraOff}
          formattedDuration={formattedDuration} remoteUsers={remoteUsers}
          localVideoTrack={localVideoTrack} onAccept={acceptCall} onDecline={declineCall}
          onEnd={endCall} onToggleMute={toggleMute} onToggleCamera={toggleCamera}
        />
      )}

      <div className="h-full flex flex-col">
        <Header
          title={callerName || "Runner"}
          showBack={true} onBack={onBack}
          darkMode={darkMode} toggleDarkMode={toggleDarkMode}
          rightActions={
            <div className="items-center gap-3 hidden sm:flex">
              <HeaderIcon tooltip="More" onClick={() => setShowMoreSheet(true)}>
                <MoreHorizontal className="h-6 w-6" />
              </HeaderIcon>
              <HeaderIcon tooltip="Video call" onClick={() => initiateCall("video", runner?._id, "runner")}>
                <Video className="h-5 w-5" />
              </HeaderIcon>
              <HeaderIcon tooltip="Voice call" onClick={() => initiateCall("voice", runner?._id, "runner")}>
                <Phone className="h-5 w-5" />
              </HeaderIcon>
            </div>
          }
        />

        <div
          ref={listRef}
          className={`flex-1 overflow-y-auto px-3 sm:px-6 py-4 bg-chat-pattern bg-gray-100 dark:bg-black-200 ${selectedFiles.length > 0 ? 'pb-64' : replyingTo ? 'pb-40' : 'pb-32'
            }`}
        >
          <div className="mx-auto max-w-3xl">
            {messages.map((m) => {

              if (m.type === 'profile-card' || m.messageType === 'profile-card') {
                return (
                  <div key={m.id} className="my-4">
                    <ProfileCardMessage runnerInfo={m.runnerInfo} darkMode={darkMode} />
                  </div>
                );
              }

              // Payment request — handled here with full payment logic
              // Message.jsx also has a handler but uses different prop interface
              // This takes priority — Message never sees payment_request
              if (m.type === 'payment_request' || m.messageType === 'payment_request') {
                const alreadyPaid = paidChatIds.has(chatId);
                return (
                  <div key={m.id} className="my-4">
                    <PaymentRequestMessage
                      darkMode={darkMode}
                      paymentData={m.paymentData}
                      alreadyPaid={alreadyPaid}
                      onPayWithWallet={() => handlePayment(m.paymentData, 'wallet')}
                      onPayWithCard={() => handlePayment(m.paymentData, 'card')}
                    />
                  </div>
                );
              }

              if (m.type === 'tracking') {
                return (
                  <div key={m.id} className="my-2 flex justify-start">
                    <TrackDeliveryScreen darkMode={darkMode} trackingData={m.trackingData} />
                  </div>
                );
              }

              // All other types: system, text, image, audio, video, file,
              // payment_success, payment_failed, payment_pending,
              // item_submission, delivery_confirmation_request,
              // dispute_raised, dispute_resolved, rating_submitted
              return (
                <Message
                  key={m.id}
                  m={m}
                  darkMode={darkMode}
                  userType="user"
                  onDelete={handleDeleteMessage}
                  onEdit={handleEditMessage}
                  onReact={handleMessageReact}
                  onReply={handleMessageReply}
                  replyingToMessage={replyingTo?.id === m.id ? replyingTo : null}
                  onCancelReply={() => setReplyingTo(null)}
                  isChatActive={true}
                  showCursor={true}
                  isUploading={m.isUploading}
                  messages={messages}
                  onScrollToMessage={handleScrollToMessage}
                  onApproveItems={handleApproveItems}
                  onRejectItems={handleRejectItems}
                  onConfirmDelivery={handleConfirmDelivery}
                />
              );
            })}

            {(otherUserTyping || otherUserRecording) && <TypingRecordingIndicator />}
          </div>
        </div>

        <div className="w-full bg-gray-100 dark:bg-black-200 px-4 py-4">
          <div className="absolute w-full bottom-8 sm:bottom-[40px] px-4 sm:px-8 lg:px-64 right-0 left-0">
            <CustomInput
              value={text}
              onChange={(e) => { setText(e.target.value); handleTyping(); }}
              onKeyDown={handleTyping}
              send={send}
              showMic={true}
              showIcons={true}
              placeholder={isRecording ? `Recording... ${recordingTime}s` : "Type a message"}
              onMicClick={toggleRecording}
              isRecording={isRecording}
              toggleRecording={toggleRecording}
              onAttachClick={() => fileInputRef.current?.click()}
              selectedFiles={selectedFiles}
              onRemoveFile={handleRemoveFile}
              replyingTo={replyingTo}
              onCancelReply={() => setReplyingTo(null)}
              darkMode={darkMode}
            />
            <input
              type="file" ref={fileInputRef} onChange={handleFileSelect}
              className="hidden" accept="image/*,video/*,.pdf,.doc,.docx"
            />
          </div>
        </div>
      </div>
    </>
  );
}