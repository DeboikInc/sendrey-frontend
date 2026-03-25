/* eslint-disable react-hooks/exhaustive-deps */
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
import PickupItemForm from "./PickupItemForm";
import VideoCallScreen from "../common/VideoCallScreen";
import CallScreen from "../common/CallScreen";
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { useTypingAndRecordingIndicator } from '../../hooks/useTypingIndicator';

// ─── Normalise any service-type string → canonical form ───────────────────────
const normaliseServiceType = (raw) => {
  if (!raw) return null;
  const s = String(raw).toLowerCase().replace(/_/g, '-');
  if (s === 'run-errand') return 'run-errand';
  if (s === 'pick-up' || s === 'pick-up' || s === 'pickup') return 'pick-up';
  return null;
};

function RunnerChatScreen({
  initialMessages,
  onMessagesChange,
  onRegisterSetMessages,
  active,
  selectedUser,
  isChatActive,
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
  callState,
  callType,
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
  onBackToHome,
  cancellationReason,
  switchCamera,
  facingMode,
  taskCompleted,
  setTaskCompleted,
  onSaveDeliveryMarked,
  onSaveUserConfirmedDelivery,
  onSaveSpecialInstructions,
  initialDeliveryMarked,
  initialUserConfirmedDelivery,
  initialSpecialInstructions,
}) {
  const chatId = selectedUser?._id ? `user-${selectedUser._id}-runner-${runnerId}` : null;
  const listRef = useRef(null);
  const fileInputRef = useRef(null);
  const processedMessageIds = useRef(new Set());
  const cameraUsedByItemFormRef = useRef(false);
  const completedStatusesRef = useRef([]);
  const isSyncingFromParent = useRef(false);
  const mountedRef = useRef(true);
  const hasFetchedPayoutRef = useRef(false);

  const [showCameraPreview, setShowCameraPreview] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [showSpecialInstructionsModal, setShowSpecialInstructionsModal] = useState(false);
  const [showItemSubmissionForm, setShowItemSubmissionForm] = useState(false);
  const [runnerLocation, setRunnerLocation] = useState(null); // eslint-disable-line no-unused-vars

  const [specialInstructions, setSpecialInstructions] = useState(initialSpecialInstructions ?? null);
  const [deliveryMarked, setDeliveryMarked] = useState(initialDeliveryMarked ?? false);
  const [userConfirmedDelivery, setUserConfirmedDelivery] = useState(initialUserConfirmedDelivery ?? false);
  const [backHomeDisabled] = useState(() => {
    try { return localStorage.getItem(`backHome_disabled_${chatId}`) === 'true'; } catch { return false; }
  });
  const [showPickupItemForm, setShowPickupItemForm] = useState(false);

  const [messages, setMessages] = useState(initialMessages || []);
  const onMessagesChangeRef = useRef(onMessagesChange);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => { onMessagesChangeRef.current = onMessagesChange; }, [onMessagesChange]);

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

  // Register parent push function
  useEffect(() => {
    if (!onRegisterSetMessages) return;
    const pushFromParent = (updater) => {
      isSyncingFromParent.current = true;
      setMessages(prev => typeof updater === 'function' ? updater(prev) : updater);
      queueMicrotask(() => { isSyncingFromParent.current = false; });
    };
    onRegisterSetMessages(pushFromParent);
  }, [onRegisterSetMessages]);

  const { permission, requestPermission } = usePushNotifications({
    runnerId, userType: 'runner', socket,
  });

  const { handleTyping, otherUserTyping } = useTypingAndRecordingIndicator({
    socket, chatId, currentUserId: runnerId, currentUserType: 'runner',
  });

  // ── Derive service type ONCE from currentOrder, locked for this render ────
  // We read from currentOrder (server-authoritative) and never from selectedUser
  // to avoid stale data flipping the task type mid-session.
  const resolvedServiceType = normaliseServiceType(
    currentOrder?.serviceType
    ?? currentOrder?.taskType
    ?? currentOrder?.type
    // Fall back to selectedUser only if currentOrder has no service type at all
    ?? selectedUser?.currentRequest?.serviceType
    ?? selectedUser?.serviceType
  );

  const isRunErrand = resolvedServiceType === 'run-errand';
  const isPickUp = resolvedServiceType === 'pick-up';
  const canSubmitItems = isRunErrand && currentOrder?.paymentStatus === 'paid';

  // ── Stable orderData object passed to OrderStatusFlow ─────────────────────
  // Everything OrderStatusFlow needs is here so it can also re-fetch from server.
  // We memoise with useMemo so it doesn't cause spurious re-renders.
  const orderFlowData = React.useMemo(() => ({
    // Identity
    chatId,
    orderId: currentOrder?.orderId ?? null,
    runnerId,
    userId: selectedUser?._id ?? null,

    // Service type — authoritative from currentOrder
    serviceType: resolvedServiceType,

    // Addresses + coords — from currentOrder first, fall back to selectedUser.currentRequest
    deliveryLocation: currentOrder?.deliveryLocation ?? selectedUser?.currentRequest?.deliveryLocation ?? null,
    deliveryCoordinates: currentOrder?.deliveryCoordinates ?? selectedUser?.currentRequest?.deliveryCoordinates ?? null,
    pickupLocation: currentOrder?.pickupLocation ?? selectedUser?.currentRequest?.pickupLocation ?? selectedUser?.currentRequest?.marketLocation ?? null,
    pickupCoordinates: currentOrder?.pickupCoordinates ?? selectedUser?.currentRequest?.pickupCoordinates ?? null,
    marketLocation: currentOrder?.marketLocation ?? selectedUser?.currentRequest?.marketLocation ?? null,
    marketCoordinates: currentOrder?.marketCoordinates ?? selectedUser?.currentRequest?.marketCoordinates ?? null,

    // Payout
    usedPayoutSystem: currentOrder?.usedPayoutSystem ?? false,

    // Full user object (OrderStatusFlow may use this as fallback)
    userData: selectedUser,
  }), [
    chatId, runnerId,
    currentOrder?.orderId,
    currentOrder?.serviceType, currentOrder?.taskType, currentOrder?.type,
    currentOrder?.deliveryLocation, currentOrder?.deliveryCoordinates,
    currentOrder?.pickupLocation, currentOrder?.pickupCoordinates,
    currentOrder?.marketLocation, currentOrder?.marketCoordinates,
    currentOrder?.usedPayoutSystem,
    selectedUser?._id,
    selectedUser?.currentRequest?.deliveryLocation,
    selectedUser?.currentRequest?.deliveryCoordinates,
    selectedUser?.currentRequest?.pickupLocation,
    selectedUser?.currentRequest?.pickupCoordinates,
    selectedUser?.currentRequest?.marketLocation,
    selectedUser?.currentRequest?.marketCoordinates,
    selectedUser?.serviceType,
    resolvedServiceType,
  ]);

  // ── Persist state ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (mountedRef.current) onSaveDeliveryMarked?.(deliveryMarked);
  }, [deliveryMarked, onSaveDeliveryMarked]);

  useEffect(() => {
    if (mountedRef.current) onSaveUserConfirmedDelivery?.(userConfirmedDelivery);
  }, [userConfirmedDelivery, onSaveUserConfirmedDelivery]);

  useEffect(() => {
    if (mountedRef.current) onSaveSpecialInstructions?.(specialInstructions);
  }, [specialInstructions, onSaveSpecialInstructions]);

  // Permissions
  useEffect(() => {
    if (runnerId && socket && permission === 'default' && mountedRef.current) {
      requestPermission();
    }
  }, [runnerId, socket, permission, requestPermission]);

  // Sync completedStatusesRef
  useEffect(() => {
    completedStatusesRef.current = completedOrderStatuses;
  }, [completedOrderStatuses]);

  // New order reset
  const prevOrderIdRef = useRef(null);
  useEffect(() => {
    if (!currentOrder?.orderId || !mountedRef.current) return;
    const isTerminal = ['completed', 'cancelled', 'task_completed'].includes(currentOrder?.status);
    if (!isTerminal && prevOrderIdRef.current && prevOrderIdRef.current !== currentOrder.orderId) {
      setDeliveryMarked(false);
      setUserConfirmedDelivery(false);
      setCompletedOrderStatuses([]);
    }
    prevOrderIdRef.current = currentOrder.orderId;
  }, [currentOrder?.orderId, currentOrder?.status]);

  // Reset if no order
  useEffect(() => {
    if (selectedUser?._id && runnerId && !currentOrder && mountedRef.current) {
      setDeliveryMarked(false);
      setUserConfirmedDelivery(false);
    }
  }, [selectedUser?._id, runnerId, currentOrder]);

  // Special instructions
  useEffect(() => {
    if (selectedUser?.specialInstructions && mountedRef.current) {
      setSpecialInstructions(selectedUser.specialInstructions);
    }
  }, [selectedUser?.specialInstructions]);

  // Payout receipt
  useEffect(() => {
    if (!socket || !chatId || !mountedRef.current) return;
    const handler = () => {
      if (mountedRef.current) setCurrentOrder(prev => prev ? { ...prev, usedPayoutSystem: true } : prev);
    };
    socket.on('payoutReceiptSubmitted', handler);
    return () => socket.off('payoutReceiptSubmitted', handler);
  }, [socket, chatId, setCurrentOrder]);

  useEffect(() => {
    if (!socket || !chatId || !runnerId || !mountedRef.current) return;

    // Only fetch once per order
    if (hasFetchedPayoutRef.current) return;
    hasFetchedPayoutRef.current = true;

    socket.emit('getRunnerPayout', { chatId, runnerId });
    const handler = ({ payout }) => {
      if (mountedRef.current && payout?.usedPayoutSystem) {
        setCurrentOrder(prev => prev ? { ...prev, usedPayoutSystem: true } : prev);
      }
    };
    socket.on('runnerPayoutData', handler);
    return () => socket.off('runnerPayoutData', handler);
  }, [socket, chatId, runnerId, setCurrentOrder]);

  // Reset when order changes
  useEffect(() => {
    if (currentOrder?.orderId) {
      hasFetchedPayoutRef.current = false;
    }
  }, [currentOrder?.orderId]);

  // Reset processedMessageIds
  useEffect(() => {
    processedMessageIds.current = new Set();
  }, [selectedUser?._id, runnerId, currentOrder?.orderId]);

  // Scroll to bottom
  useEffect(() => {
    if (listRef.current && messages.length > 0 && mountedRef.current) {
      const t = setTimeout(() => {
        if (listRef.current) listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
      }, 100);
      return () => clearTimeout(t);
    }
  }, [messages, replyingTo]);

  // Camera preview
  useEffect(() => {
    if (capturedImage && isPreviewOpen && !cameraUsedByItemFormRef.current && mountedRef.current) {
      setPreviewImage(capturedImage);
      setShowCameraPreview(true);
    }
  }, [capturedImage, isPreviewOpen]);

  // Special instructions socket handler
  useEffect(() => {
    if (!onSpecialInstructions || !mountedRef.current) return;
    onSpecialInstructions((data) => {
      if (mountedRef.current) setSpecialInstructions(data.specialInstructions);
    });
  }, [onSpecialInstructions]);

  // Order created handler — merge new order data, preserving serviceType
  useEffect(() => {
    if (!onOrderCreated || !mountedRef.current) return;
    onOrderCreated((data) => {
      if (!mountedRef.current) return;
      const order = data.order || data;
      if (!order?.orderId) return;
      setCurrentOrder(prev => {
        if (prev?.orderId === order.orderId) return { ...prev, ...order };
        return order;
      });
    });
  }, [onOrderCreated, setCurrentOrder]);

  // GPS tracking
  useEffect(() => {
    if (!socket || !currentOrder?.orderId || !mountedRef.current) return;
    if (!completedOrderStatuses.includes('en_route_to_delivery')) return;
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (!mountedRef.current) return;
        const { latitude, longitude, heading, speed } = position.coords;
        const loc = { lat: latitude, lng: longitude, heading: heading || 0, speed: speed || 0 };
        setRunnerLocation(loc);
        socket.emit('runner:locationUpdate', { orderId: currentOrder.orderId, ...loc });
      },
      (err) => console.error('Geolocation error:', err),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    );
    return () => { navigator.geolocation.clearWatch(watchId); setRunnerLocation(null); };
  }, [socket, currentOrder?.orderId, completedOrderStatuses]);

  // Delivery confirmed/denied
  useEffect(() => {
    if (!socket || !chatId || !mountedRef.current) return;
    const onConfirmed = () => { if (mountedRef.current) setUserConfirmedDelivery(true); };
    const onDenied = () => {
      if (mountedRef.current) {
        setUserConfirmedDelivery(false);
        setDeliveryMarked(false);
      }
    };
    socket.on('deliveryConfirmed', onConfirmed);
    socket.on('deliveryAutoConfirmed', onConfirmed);
    socket.on('deliveryDenied', onDenied);
    return () => {
      socket.off('deliveryConfirmed', onConfirmed);
      socket.off('deliveryAutoConfirmed', onConfirmed);
      socket.off('deliveryDenied', onDenied);
    };
  }, [socket, chatId]);

  useEffect(() => {
    if (!onDeliveryConfirmed || !mountedRef.current) return;
    onDeliveryConfirmed(() => {
      if (mountedRef.current) setDeliveryMarked(false);
    });
  }, [onDeliveryConfirmed]);

  // Message deleted
  useEffect(() => {
    if (!onMessageDeleted || !mountedRef.current) return;
    onMessageDeleted(({ messageId, deletedBy }) => {
      if (!mountedRef.current) return;
      const isMe = deletedBy === runnerId;
      setMessagesAndSync(prev => prev.map(msg => msg.id === messageId
        ? { ...msg, deleted: true, text: isMe ? "You deleted this message" : "This message was deleted", type: "deleted", fileUrl: null, fileName: null }
        : msg
      ));
    });
  }, [onMessageDeleted, runnerId, setMessagesAndSync]);

  // Incoming message listener
  useEffect(() => {
    if (!socket || !chatId || !mountedRef.current) return;

    const handleIncomingMessage = (msg) => {
      if (!mountedRef.current) return;
      if (!msg.text && !msg.fileUrl && !msg.fileName) return;
      if (processedMessageIds.current.has(msg.id)) return;
      processedMessageIds.current.add(msg.id);

      if (msg.type === 'fileUploadSuccess' || msg.messageType === 'fileUploadSuccess') return;
      if (msg.type === 'system' && msg.text?.includes('must approve the items you sent')) return;

      if (msg.type === 'order_created' || (msg.type === 'system' && msg.text?.includes('order created')) || (msg.type === 'payment_request' && msg.paymentData?.orderId)) {
        const newOrderId = msg.paymentData?.orderId || msg.orderId;
        if (newOrderId && currentOrder?.orderId !== newOrderId) {
          setTaskCompleted(false);
          setDeliveryMarked(false);
          setUserConfirmedDelivery(false);
        }
      }

      if (msg.type === 'system' && msg.id?.startsWith('delivery-confirmed-runner-')) {
        setUserConfirmedDelivery(true);
      }

      if (msg.type === 'system' && (msg.text?.toLowerCase().includes('task completed') || msg.id?.includes('task_completed'))) {
        setTaskCompleted(true);
      }

      if (msg.paymentConfirmed && msg.type === 'system') {
        setCurrentOrder(prev => ({ ...(prev || {}), paymentStatus: 'paid', status: 'active' }));
      }

      const formattedMsg = {
        ...msg,
        from: (msg.from === 'system' || msg.type === 'system' || msg.senderType === 'system' || msg.senderId === 'system')
          ? 'system' : msg.senderId === runnerId ? 'me' : 'them',
        type: msg.type || msg.messageType || 'text',
      };

      if (msg.type === 'system' && msg.text?.includes('approved the items')) {
        formattedMsg.itemsApproved = true;
      }

      setMessagesAndSync(prev => {
        if (msg.tempId) {
          const hasTmp = prev.some(m => m.id === msg.tempId || m.tempId === msg.tempId);
          if (hasTmp) return prev.map(m => (m.id === msg.tempId || m.tempId === msg.tempId) ? formattedMsg : m);
        }
        const exists = prev.some(m => m.id === msg.id);
        if (exists) return prev.map(m => m.id === msg.id ? { ...m, ...formattedMsg } : m);
        return [...prev, formattedMsg];
      });
    };

    socket.on('message', handleIncomingMessage);
    return () => socket.off('message', handleIncomingMessage);
  }, [socket, chatId, runnerId, setMessagesAndSync, setCurrentOrder, setTaskCompleted, currentOrder?.orderId]);

  // Item submission update
  useEffect(() => {
    if (!socket || !mountedRef.current) return;
    const handler = (data) => {
      if (!mountedRef.current) return;
      setMessagesAndSync(prev => prev.map(m =>
        m.submissionId === data.submissionId || m.id === data.submissionId
          ? { ...m, status: data.status, rejectionReason: data.rejectionReason }
          : m
      ));
    };
    socket.on('itemSubmissionUpdated', handler);
    return () => socket.off('itemSubmissionUpdated', handler);
  }, [socket, setMessagesAndSync]);

  // Reconnect / missed messages
  useEffect(() => {
    if (!socket || !chatId || !mountedRef.current) return;

    const handleReconnect = () => {
      socket.emit('rejoinChat', { chatId, runnerId, userType: 'runner' });
    };

    const handleMissedMessages = (msgs) => {
      if (!mountedRef.current) return;
      if (!msgs?.length) return;
      setMessagesAndSync(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        const toAdd = msgs
          .filter(m => !existingIds.has(m.id) && !processedMessageIds.current.has(m.id))
          .map(msg => {
            processedMessageIds.current.add(msg.id);
            if (msg.paymentConfirmed || (msg.type === 'system' && msg.text?.toLowerCase().includes('made payment for this task'))) {
              setCurrentOrder(p => p ? { ...p, paymentStatus: 'paid', status: 'active' } : p);
            }
            const isSystem = msg.from === 'system' || msg.type === 'system' || msg.messageType === 'system' || msg.senderType === 'system' || msg.senderId === 'system';
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
  }, [socket, chatId, runnerId, setMessagesAndSync, setCurrentOrder, setCompletedOrderStatuses]);

  // Task completed from message scan
  useEffect(() => {
    if (!currentOrder?.orderId || !mountedRef.current) return;
    if (['completed', 'cancelled', 'task_completed'].includes(currentOrder?.status)) return;
    const has = messages.some(m =>
      (m.type === 'system' || m.from === 'system') && m.text?.toLowerCase().includes('task completed')
    );
    if (has) setTaskCompleted(true);
  }, [messages, setTaskCompleted, currentOrder?.orderId, currentOrder?.status]);

  // ── Message actions ────────────────────────────────────────────────────────
  const handleDeleteMessage = useCallback((messageId, deleteForEveryone = false) => {
    setMessagesAndSync(prev => prev.map(msg => msg.id === messageId
      ? { ...msg, deleted: true, text: "You deleted this message", type: "deleted", fileUrl: null, fileName: null }
      : msg
    ));
    if (deleteForEveryone && socket && chatId) {
      socket.emit("deleteMessage", { chatId, messageId, userId: runnerId, deleteForEveryone: true });
    }
  }, [socket, chatId, runnerId, setMessagesAndSync]);

  const handleEditMessage = useCallback((messageId, newText) => {
    setMessagesAndSync(prev => prev.map(msg => msg.id === messageId ? { ...msg, text: newText, edited: true } : msg));
  }, [setMessagesAndSync]);

  const handleMessageReact = useCallback((messageId, emoji) => {
    setMessagesAndSync(prev => prev.map(msg => msg.id === messageId ? { ...msg, reaction: emoji } : msg));
    if (socket) socket.emit("reactToMessage", { chatId, messageId, emoji, userId: runnerId });
  }, [socket, chatId, runnerId, setMessagesAndSync]);

  const handleMessageReply = useCallback((message) => {
    setReplyingTo(message);
    setTimeout(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, 100);
  }, [setReplyingTo]);

  const handleCancelReply = useCallback(() => setReplyingTo(null), [setReplyingTo]);

  const handleScrollToMessage = useCallback((messageId) => {
    const el = document.getElementById(`message-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('highlight-message');
      setTimeout(() => el.classList.remove('highlight-message'), 2000);
    }
  }, []);

  // ── File upload ────────────────────────────────────────────────────────────
  const handleFileSelect = useCallback(async (event) => {
    const files = Array.from(event.target.files);
    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) { alert(`"${file.name}" exceeds 10MB limit.`); continue; }
      let msgType = 'file';
      if (file.type.startsWith('image/')) msgType = 'image';
      else if (file.type.startsWith('video/')) msgType = 'video';
      else if (file.type.startsWith('audio/')) msgType = 'audio';
      const tempId = `temp-${Date.now()}-${file.name}`;
      const localUrl = URL.createObjectURL(file);
      setMessagesAndSync(prev => [...prev, {
        id: tempId, tempId, from: 'me', type: msgType,
        fileName: file.name, fileType: file.type, fileUrl: localUrl, text: '',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'uploading', senderId: runnerId, senderType: 'runner',
        isUploading: true, createdAt: new Date().toISOString(),
      }]);
      try {
        await uploadFileWithProgress(file, { chatId, senderId: runnerId, senderType: 'runner', tempId, type: msgType });
      } catch (error) {
        console.error('Upload error:', error);
        setMessagesAndSync(prev => prev.filter(m => m.id !== tempId));
        URL.revokeObjectURL(localUrl);
      }
    }
    event.target.value = '';
  }, [uploadFileWithProgress, chatId, runnerId, setMessagesAndSync]);

  const handleAttachClickInternal = useCallback(() => fileInputRef.current?.click(), []);

  const handleSendPhoto = useCallback(async (image, replyText) => {
    if (!selectedUser || !runnerId) return;
    try {
      const blob = await (await fetch(image)).blob();
      const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
      const tempId = `temp-${Date.now()}-photo`;
      setMessagesAndSync(prev => [...prev, {
        id: tempId, tempId, from: 'me', type: 'image',
        fileName: file.name, fileType: 'image/jpeg', fileUrl: image, text: replyText || '',
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
  }, [selectedUser, runnerId, uploadFileWithProgress, chatId, replyingTo, setMessagesAndSync, closePreview]);

  // ── Item submission ────────────────────────────────────────────────────────
  const handleSubmitItems = useCallback(async (itemsData) => {
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
      setMessagesAndSync(prev => [...prev, {
        id: `items-submitted-${Date.now()}`,
        from: 'system', type: 'system', messageType: 'system',
        text: `You submitted item(s). ${selectedUser?.firstName || 'User'} must approve the items you sent before marking "Purchase completed".`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'sent', senderId: 'system', senderType: 'system',
        style: 'info', isItemSubmissionProof: true, hasItemPhotos: itemsData.hasItemPhotos ?? false,
      }]);
      setShowItemSubmissionForm(false);
    } catch (error) { console.error('Error submitting items:', error); throw error; }
  }, [socket, chatId, runnerId, selectedUser, currentOrder, setMessagesAndSync]);

  const openItemSubmissionForm = useCallback(() => {
    if (!currentOrder) return alert('No active order. Wait for user to place an order.');
    if (!isRunErrand) return alert('Item submission is only for run-errand tasks.');
    if (currentOrder.paymentStatus !== 'paid') return alert('Wait for user to complete payment.');
    setShowItemSubmissionForm(true);
  }, [currentOrder, isRunErrand]);

  // ── Pickup item submission 
  const handleSubmitPickupItem = useCallback(async (itemData) => {
    try {
      if (socket) {
        socket.emit('submitPickupItem', {
          chatId,
          runnerId,
          userId: selectedUser?._id,
          submissionId: `pickup-${Date.now()}`,
          itemName: itemData.itemName,
          photoBase64: itemData.photoBase64,
        });
      }
      setMessagesAndSync(prev => [...prev, {
        id: `pickup-submitted-${Date.now()}`,
        from: 'system',
        type: 'system',
        messageType: 'system',
        text: `You submitted pickup item: "${itemData.itemName}". ${selectedUser?.firstName || 'User'} must approve before you can mark as collected.`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'sent',
        senderId: 'system',
        senderType: 'system',
        style: 'info',
        isPickupSubmission: true,
        pickupItemName: itemData.itemName,
        pickupPhotoUrl: itemData.photoUrl,
      }]);
      setShowPickupItemForm(false);
    } catch (error) {
      console.error('Error submitting pickup item:', error);
      throw error;
    }
  }, [socket, chatId, runnerId, selectedUser, setMessagesAndSync]);

  const openPickupItemForm = useCallback(() => {
    if (!currentOrder) return alert('No active order. Wait for user to place an order.');
    if (!isPickUp) return alert('Item submission is only for pick-up tasks.');
    if (currentOrder.paymentStatus !== 'paid') return alert('Wait for user to complete payment.');
    setShowPickupItemForm(true);
  }, [currentOrder, isPickUp]);

  // ── Delivery ───────────────────────────────────────────────────────────────
  const handleMarkDeliveryComplete = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (!socket || !currentOrder || !chatId) return reject(new Error('Missing data'));
      const onError = (err) => { socket.off('error', onError); socket.off('deliveryMarkedComplete', onSuccess); reject(new Error(err.message)); };
      const onSuccess = () => { socket.off('error', onError); socket.off('deliveryMarkedComplete', onSuccess); setDeliveryMarked(true); resolve(); };
      socket.once('error', onError);
      socket.once('deliveryMarkedComplete', onSuccess);
      if (!currentOrder?.orderId) return reject(new Error('No active order'));
      socket.emit('markDeliveryComplete', { chatId, orderId: currentOrder.orderId, runnerId, deliveryProof: null });
      setTimeout(() => { socket.off('error', onError); socket.off('deliveryMarkedComplete', onSuccess); reject(new Error('No response from server')); }, 10000);
    });
  }, [socket, currentOrder, chatId, runnerId]);

  const handleStatusMessage = useCallback((systemMessage) => {
    setMessagesAndSync(prev => {
      if (prev.some(m => m.id === systemMessage.id)) return prev;
      return [...prev, systemMessage];
    });
  }, [setMessagesAndSync]);

  const handleTextChange = useCallback((e) => {
    setText(e.target.value);
    handleTyping();
  }, [setText, handleTyping]);

  const handleKeyDown = useCallback(() => handleTyping(), [handleTyping]);

  const getFirstLetter = useCallback((name) => name ? name.charAt(0).toUpperCase() : 'U', []);
  const getRandomBgColor = useCallback((name) => {
    if (!name) return 'bg-green-500';
    const colors = ['bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-green-500', 'bg-teal-500', 'bg-blue-500', 'bg-indigo-500', 'bg-purple-500', 'bg-pink-500', 'bg-rose-500'];
    return colors[name.charCodeAt(0) % colors.length];
  }, []);

  const callerName = selectedUser ? `${selectedUser.firstName} ${selectedUser.lastName || ''}` : 'User';
  const callerAvatar = selectedUser?.avatar || null;

  const TypingIndicator = useCallback(() => (
    <div className="flex items-center gap-2 px-4 py-2">
      <div className="flex gap-1">
        {[0, 150, 300].map((d, i) => (
          <span key={i} className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
        ))}
      </div>
      <span className="text-sm text-gray-500">typing...</span>
    </div>
  ), []);

  return (
    <>
      {callState !== "idle" && callType === "voice" && (
        <CallScreen
          callState={callState} callType={callType} callerName={callerName} callerAvatar={callerAvatar}
          isMuted={isMuted} isCameraOff={isCameraOff} formattedDuration={formattedDuration}
          remoteUsers={remoteUsers} localVideoTrack={localVideoTrack}
          onAccept={acceptCall} onDecline={declineCall} onEnd={endCall}
          onToggleMute={toggleMute} onToggleCamera={toggleCamera}
        />
      )}

      {callState !== "idle" && callType === "video" && (
        <VideoCallScreen
          callState={callState} callType={callType} callerName={callerName} callerAvatar={callerAvatar}
          isMuted={isMuted} isCameraOff={isCameraOff} isSpeakerOn={isSpeakerOn}
          formattedDuration={formattedDuration} remoteUsers={remoteUsers} localVideoTrack={localVideoTrack}
          networkQuality={networkQuality} darkMode={dark}
          onAccept={acceptCall} onDecline={declineCall} onEnd={endCall}
          onToggleMute={toggleMute} onToggleCamera={toggleCamera}
          onSwitchCamera={switchCamera} onToggleSpeaker={toggleSpeaker}
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
          <div className="items-center gap-3 flex">
            <span className="bg-gray-1000 dark:bg-black-200 rounded-full w-10 h-10 flex items-center justify-center">
              <IconButton variant="text" className="rounded-full" onClick={() => initiateCall('video', selectedUser?._id, 'user')}>
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
                onClick={() => onBackToHome?.()}
                disabled={backHomeDisabled}
                className={`w-full py-4 rounded-xl font-semibold text-white transition-all ${backHomeDisabled ? 'bg-gray-400 cursor-not-allowed opacity-60' : 'bg-primary hover:opacity-90'}`}
              >
                {backHomeDisabled ? 'Returning...' : 'Back to Home'}
              </button>
            </div>
          ) : orderCancelled ? (
            <div>
              <div className={`px-4 py-2 text-center text-sm font-medium ${dark ? 'text-gray-400 bg-black-100' : 'text-gray-500 bg-gray-100'} rounded-xl mx-4 mt-3`}>
                {cancellationReason === 'runner' ? 'You cancelled this order' : 'Order was cancelled'}
              </div>
              <div className="px-4 py-4">
                <button
                  onClick={() => onBackToHome?.()}
                  disabled={backHomeDisabled}
                  className={`w-full py-4 rounded-xl font-semibold text-white transition-all ${backHomeDisabled ? 'bg-gray-400 cursor-not-allowed opacity-60' : 'bg-primary hover:opacity-90'}`}
                >
                  {backHomeDisabled ? 'Returning...' : 'Back to Home'}
                </button>
              </div>
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
              uploadFileWithProgress={uploadFileWithProgress}
              chatId={chatId}
              setMessages={setMessagesAndSync}
              runnerId={runnerId}
            />
          )}

          <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden"
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx" multiple />

          {showOrderFlow && selectedUser && (
            <OrderStatusFlow
              isOpen={showOrderFlow}
              onClose={() => setShowOrderFlow(false)}
              // ── Single clean orderData object — all identity + location fields ──
              orderData={orderFlowData}
              // ── Pass the normalised service type as a hint; OrderStatusFlow
              //    will lock it from the server response and ignore stale values. ──
              taskType={resolvedServiceType}
              darkMode={dark}
              onStatusClick={handleOrderStatusClick}
              completedStatuses={completedOrderStatuses}
              setCompletedStatuses={setCompletedOrderStatuses}
              socket={socket}
              runnerFleetType={runnerFleetType}
              onStatusMessage={handleStatusMessage}
              messagesRef={{ current: messages }}
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
              showSubmitPickupItem={!isRunErrand && currentOrder?.paymentStatus === 'paid'}
              onSubmitPickupItem={() => { setIsAttachFlowOpen(false); openPickupItemForm(); }}
              serviceType={resolvedServiceType}
              messages={messages}
              socket={socket}
              chatId={chatId}
              onSelectGallery={() => {
                setIsAttachFlowOpen(false);
                const input = document.createElement('input');
                input.type = 'file'; input.accept = 'image/*,video/*'; input.multiple = false;
                input.onchange = async (e) => {
                  const file = e.target.files[0];
                  if (!file) return;
                  const msgType = file.type.startsWith('video/') ? 'video' : 'image';
                  const tempId = `temp-${Date.now()}-gallery`;
                  const localUrl = URL.createObjectURL(file);
                  setMessagesAndSync(prev => [...prev, {
                    id: tempId, tempId, from: 'me', type: msgType,
                    fileName: file.name, fileType: file.type, fileUrl: localUrl, text: '',
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    status: 'uploading', senderId: runnerId, senderType: 'runner',
                    isUploading: true, createdAt: new Date().toISOString(),
                  }]);
                  try {
                    await uploadFileWithProgress(file, { chatId, senderId: runnerId, senderType: 'runner', tempId, type: msgType });
                  } catch (err) {
                    console.error('Gallery upload error:', err);
                    setMessagesAndSync(prev => prev.filter(m => m.id !== tempId));
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
              onSend={(image, replyText) => { handleSendPhoto(image, replyText); setShowCameraPreview(false); setPreviewImage(null); closePreview(); }}
              onCancel={() => { setShowCameraPreview(false); setPreviewImage(null); closePreview(); }}
              darkMode={dark}
            />
          )}
        </div>

        {/* Camera */}
        {cameraOpen && (
          <div className="fixed inset-0 bg-black z-[9999] flex flex-col overflow-hidden">
            <div className="flex justify-between items-center p-4 bg-black/80 flex-shrink-0">
              <Button onClick={closeCamera} className="text-white px-4 py-2 hover:bg-white/10 rounded-lg">Cancel</Button>
              <h3 className="text-white text-lg font-medium">Take Photo</h3>
              <div className="w-16" />
            </div>
            <div className="flex-1 relative bg-black min-h-0">
              {!capturedImage ? (
                <video ref={videoRef} autoPlay playsInline muted
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{ transform: 'scaleX(-1)' }} />
              ) : (
                <img src={capturedImage} alt="Captured"
                  className="absolute inset-0 w-full h-full object-contain bg-black" />
              )}
            </div>
            <div className="flex-shrink-0 bg-black p-4">
              {!capturedImage ? (
                <div className="gap-3 flex justify-center">
                  <Button onClick={capturePhoto} className="w-16 h-16 rounded-full bg-white border-4 border-gray-300 hover:bg-gray-100 shadow-2xl active:scale-95 transition-transform" />
                  <Button onClick={switchCamera} className="text-white px-3 py-2 rounded-lg"><RefreshCw /></Button>
                </div>
              ) : (
                <div className="flex justify-center gap-4">
                  <Button onClick={retakePhoto} className="px-6 py-3 bg-gray-600 text-white rounded-lg shadow-lg hover:bg-gray-700 active:scale-95 transition-transform">Retake</Button>
                  <Button
                    onClick={() => { const photo = capturedImage; closeCamera(); setTimeout(() => { setPreviewImage(photo); setShowCameraPreview(true); }, 100); }}
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

      {showPickupItemForm && (
        <PickupItemForm
          isOpen={showPickupItemForm}
          onClose={() => setShowPickupItemForm(false)}
          onSubmit={handleSubmitPickupItem}
          darkMode={dark}
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