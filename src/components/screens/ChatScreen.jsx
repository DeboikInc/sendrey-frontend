import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { IconButton, Tooltip } from "@material-tailwind/react";
import { Phone, Video, MoreHorizontal, AlertTriangle } from "lucide-react";
import Header from "../common/Header";
import Message from "../common/Message";
import CustomInput from "../common/CustomInput";

import VideoCallScreen from "../common/VideoCallScreen";
import CallScreen from "../common/CallScreen";

import { TrackDeliveryScreen } from "./TrackDeliveryScreen";
import ProfileCardMessage from "../runnerScreens/ProfileCardMessage";
import PaymentRequestMessage from "../common/PaymentRequestMessage";
import ItemSubmissionMessage from "./ItemSubmissionMessage";
import PickupItemSubmissionMessage from './PickupItemSubmissionMessage';
import DeliveryConfirmationMessage from './DeliveryConfirmationMessage';

import { useSocket } from "../../hooks/useSocket";
import { useCallHook } from "../../hooks/useCallHook";
import { useMessageQueue } from "../../hooks/useMessageQueue";
import { useTypingAndRecordingIndicator } from '../../hooks/useTypingIndicator';

import { useDispatch, useSelector } from 'react-redux';
import PaystackPaymentModal from "../common/PaystackPaymentModal";

import MoreOptionsSheet from './MoreOptionsSheet';
import UserWallet from './UserWallet';

import TeamNotifyPrompt from './TeamNotifyPrompt'
import Settings from "../../pages/user/settings/Settings";
import DisputeForm from '../common/DisputeForm';
import RatingModal from '../common/RatingModal';

import { checkCanRate } from '../../Redux/ratingSlice';
import OrderDetailsSheet from '../common/OrderDetailsSheet';
import { PinPad } from '../common/PinPad';
import chatStorage from '../../utils/chatStorage';
import { getAvailableReasons } from '../../utils/disputeReasons';

import { createPaymentIntent } from '../../Redux/paymentSlice';
import { fetchOrderByChatId } from '../../Redux/orderSlice';
import { enqueueSocketEvent, flushSocketQueue } from '../../utils/socketQueue';

import useUserOrderStore from '../../store/userOrderStore';

const HeaderIcon = ({ children, tooltip, onClick }) => (
  <Tooltip content={tooltip} placement="bottom" className="text-xs">
    <IconButton variant="text" size="sm" className="rounded-full" onClick={onClick}>
      {children}
    </IconButton>
  </Tooltip>
);

// testing only
// onBack
export default function ChatScreen({ runner, userData, darkMode, toggleDarkMode, onOrderComplete, onReady }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [uploadingFiles, setUploadingFiles] = useState(new Set()); // eslint-disable-line no-unused-vars
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [replyingTo, setReplyingTo] = useState(null);

  const listRef = useRef(null);
  const fileInputRef = useRef(null);

  const dispatch = useDispatch();
  const [paystackModal, setPaystackModal] = useState(null);

  const [showMoreSheet, setShowMoreSheet] = useState(false);
  const [showWallet, setShowWallet] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);

  const [cancelledByName, setCancelledByName] = useState(null);
  const [deliveryConfirmations, setDeliveryConfirmations] = useState({});

  const [ratingOrderId, setRatingOrderId] = useState(null);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  const [canRate, setCanRate] = useState(false);
  const [, setAwaitingNewOrder] = useState(false);
  const [paidChatIds, setPaidChatIds] = useState(new Set());

  const currentOrder = useUserOrderStore((s) => s.currentOrder);
  const orderCancelled = useUserOrderStore((s) => s.orderCancelled);
  const taskCompleted = useUserOrderStore((s) => s.taskCompleted);

  const serviceType =
    currentOrder?.serviceType ||
    currentOrder?.taskType ||
    userData?.currentRequest?.serviceType ||
    null;

  const isPinSet = useSelector(s => s.pin.isPinSet);
  const [pendingWalletPayment, setPendingWalletPayment] = useState(null);
  const [rated, setRated] = useState(false);
  const [showTeamNotify, setShowTeamNotify] = useState(false);
  const [partnerOnline, setPartnerOnline] = useState(true);
  const hasJoinedRef = useRef(false);
  const resetPaymentUIRef = useRef(null);
  const markPaidRef = useRef(null);
  const currentOrderRef = useRef(null);
  const lastProcessedSystemMsgRef = useRef(null);
  const paidChatIdsRef = useRef(new Set());
  const prevChatIdRef = useRef(null);
  const tempIdCounterRef = useRef(0);
  const onReadyCalledRef = useRef(false);
  const hasRestoredFromStorageRef = useRef(false);
  const initialHistoryProcessedRef = useRef(false);

  const paymentInProgressRef = useRef(false);

  // store
  const { setCurrentOrder, updateCurrentOrder, setOrderCancelled, setTaskCompleted } = useUserOrderStore();


  const seenMessageIdsRef = useRef(new Set());
  const replaceTempIdRef = useRef(new Map()); // tempId → realId
  const replaceTempId = useCallback((tempId, realId) => {
    replaceTempIdRef.current.set(tempId, realId);
  }, []);
  const resetDedup = useCallback(() => {
    seenMessageIdsRef.current = new Set();
  }, []);


  const {
    socket,
    // joinChat, isConnected,
    sendMessage,
    uploadFile,
    onFileUploadSuccess,
    onFileUploadError,
    onPromptRating,
    onOrderCreated,
    onPaymentConfirmed,
    onDeliveryConfirmed, // eslint-disable-line no-unused-vars
    onMessageDeleted,
    onDisputeResolved,
    onReceiveTrackRunner, setPresenceContext // eslint-disable-line no-unused-vars
  } = useSocket();

  const partnerOnlineRef = useRef(true);

  // Reset refs on unmount to prevent cross-chat contamination if component reused
  useEffect(() => {
    hasJoinedRef.current = null;
    onReadyCalledRef.current = false;
    initialHistoryProcessedRef.current = false;
  }, []);

  useEffect(() => {
    console.log('[ChatScreen MOUNT] store state:', {
      orderId: useUserOrderStore.getState().currentOrder?.orderId,
      status: useUserOrderStore.getState().currentOrder?.status,
      hasOrder: !!useUserOrderStore.getState().currentOrder,
    });
  }, []);

  useEffect(() => {
    if (!messages.length) return;

    // Check for duplicates
    const seen = new Set();
    const uniqueMessages = [];

    for (const msg of messages) {
      const key = msg.id || msg.tempId;
      if (key && !seen.has(key)) {
        seen.add(key);
        uniqueMessages.push(msg);
      } else if (!key) {
        // Messages without ID (shouldn't happen, but keep them)
        uniqueMessages.push(msg);
      }
    }

    // If duplicates were found, update state
    if (uniqueMessages.length !== messages.length) {
      console.log(`[Dedupe] Removed ${messages.length - uniqueMessages.length} duplicates`);
      setMessages(uniqueMessages);
    }
  }, [messages]);

  const chatId = useMemo(() => {
    return userData?._id && runner?._id
      ? `user-${userData._id}-runner-${runner._id}`
      : null;
  }, [userData?._id, runner?._id]);

  useEffect(() => {
    if (!chatId) return;
    chatStorage.getDeliveryConfirmations(chatId).then(saved => {
      if (saved) setDeliveryConfirmations(saved);
    });
  }, [chatId]);

  // Persist on change
  useEffect(() => {
    if (!chatId || !Object.keys(deliveryConfirmations).length) return;
    chatStorage.saveDeliveryConfirmations(chatId, deliveryConfirmations);
  }, [deliveryConfirmations, chatId]);

  // Restore paid chats on mount
  useEffect(() => {
    if (!chatId) return;
    chatStorage.getPaidChats().then(saved => {
      if (saved.has(chatId)) setPaidChatIds(saved);
    });
  }, [chatId]);

  // Persist on change
  useEffect(() => {
    if (paidChatIds.size) chatStorage.savePaidChats(paidChatIds);
  }, [paidChatIds])

  const handleMessageStatusUpdate = useCallback((idOrTempId, status, realId) => {
    setMessages(prev => prev.map(m => {
      // match by id or tempId
      if (m.id !== idOrTempId && m.tempId !== idOrTempId) return m;
      return {
        ...m,
        status,
        // if server gave us a real id to replace tempId with
        ...(realId && m.id === idOrTempId ? { id: realId, tempId: undefined } : {}),
      };
    }));
  }, []);

  const { enqueue } = useMessageQueue({
    socket,
    isConnected: socket?.connected,
    chatId,
    sendMessage,
    onStatusUpdate: handleMessageStatusUpdate,
    enabled: true,
  });

  const { handleTyping, handleRecordingStart, handleRecordingStop,
    otherUserTyping, otherUserRecording } = useTypingAndRecordingIndicator({
      socket, chatId, currentUserId: userData?._id, currentUserType: 'user',
    });

  const {
    callState, callType, isMuted, isCameraOff, formattedDuration,
    remoteUsers, localVideoTrack, initiateCall, acceptCall, isSpeakerOn, networkQuality,
    declineCall, endCall, toggleMute, toggleCamera, switchCamera, toggleSpeaker,
    isConnecting, callError,
  } = useCallHook({
    socket, chatId, currentUserId: userData?._id, currentUserType: "user",
  });

  // ─── Helpers 

  const formatMessage = (msg, userId = userData?._id) => ({
    ...msg,
    from: msg.from === 'system' || msg.senderType === 'system' || msg.senderId === 'system'
      ? 'system'
      : msg.senderId === userId ? 'me' : 'them',
    // payment_request must take priority — never override with 'system'
    type: (msg.type === 'payment_request' || msg.messageType === 'payment_request')
      ? 'payment_request'
      : msg.type || msg.messageType || 'text',
  });

  // Deduplicate messages by id, keeping the most complete version
  const mergeMessages = (existingMessages, newMessages) => {
    const mergedMap = new Map();

    // First add existing messages
    existingMessages.forEach(msg => {
      const key = msg.tempId || msg.id;
      if (key) mergedMap.set(key, msg);
    });

    // Then add/override with new messages (server is source of truth)
    newMessages.forEach(msg => {
      const key = msg.tempId || msg.id;
      if (!key) return;
      const existing = mergedMap.get(key);
      if (existing) {
        mergedMap.set(key, { ...existing, ...msg, status: msg.status || existing.status });
      } else {
        mergedMap.set(key, msg);
      }
    });

    return [...mergedMap.values()];
  };

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
    paidChatIdsRef.current = paidChatIds;
  }, [paidChatIds]);

  useEffect(() => {
    console.log('🔴 chatId CHANGED to:', chatId, 'at', Date.now());
  }, [chatId]);

  useEffect(() => {
    if (socket && userData?._id) {
      socket.emit('rejoinUserRoom', { userId: userData._id, userType: 'user' });
    }
  }, [socket, userData?._id]);

  useEffect(() => {
    if (chatId && userData?._id) {
      setPresenceContext(userData._id, 'user', chatId);
    }
  }, [chatId, userData?._id, setPresenceContext]);

  // presence useEffect
  useEffect(() => {
    if (!socket || !chatId) return;

    const onPartnerOnline = ({ chatId: inc }) => {
      if (inc !== chatId) return;
      partnerOnlineRef.current = true;
      setPartnerOnline(true);
    };

    const onPartnerOffline = ({ chatId: inc }) => {
      if (inc !== chatId) return;
      partnerOnlineRef.current = false;
      setPartnerOnline(false);
    };

    const onPresenceStatus = ({ chatId: inc, isOnline }) => {
      if (inc !== chatId) return;
      partnerOnlineRef.current = isOnline;
      setPartnerOnline(isOnline);
    };

    socket.on('partnerOnline', onPartnerOnline);
    socket.on('partnerOffline', onPartnerOffline);
    socket.on('partnerPresenceStatus', onPresenceStatus);

    socket.emit('userOnline', { userId: userData?._id, userType: 'user', chatId });
    socket.emit('queryPresence', { chatId, userId: userData?._id, userType: 'user' });

    return () => {
      socket.off('partnerOnline', onPartnerOnline);
      socket.off('partnerOffline', onPartnerOffline);
      socket.off('partnerPresenceStatus', onPresenceStatus);
    };
  }, [socket, chatId, userData?._id]);

  useEffect(() => {
    if (!socket || !chatId || !userData?._id) return;

    const sendHeartbeat = () => {
      if (socket.connected) {
        socket.emit('presenceHeartbeat');
      }
    };

    sendHeartbeat(); // immediate on mount
    const heartbeat = setInterval(sendHeartbeat, 5000);

    return () => clearInterval(heartbeat);
  }, [socket, chatId, userData?._id]);

  useEffect(() => {
    onFileUploadSuccess((data) => {
      console.log('FILE UPLOAD SUCCESS:', data);

      setMessages(prev => {
        // Find the temp message
        const tempIndex = prev.findIndex(m => m.tempId === data.tempId || m.id === data.tempId);

        if (tempIndex === -1) return prev;

        // Replace temp message with real message
        const updated = [...prev];
        updated[tempIndex] = {
          ...data.message,
          from: 'me',
          isUploading: false,
          tempId: undefined,
          id: data.message.id
        };

        console.log('REPLACED TEMP:', data.tempId, 'WITH REAL:', updated[tempIndex].id);
        console.log('TEMP ID STILL EXISTS?', updated[tempIndex].tempId);

        return updated;
      });

      setUploadingFiles(prev => {
        const s = new Set(prev);
        s.delete(data.tempId);
        return s;
      });
    });

    onFileUploadError((data) => {
      setMessages(prev => prev.map(msg => {
        if (msg.id !== data.tempId && msg.tempId !== data.tempId) return msg;
        return { ...msg, status: "failed", isUploading: false, text: `Failed to upload: ${data.error}` };
      }));
      setUploadingFiles(prev => { const s = new Set(prev); s.delete(data.tempId); return s; });
    });
  }, [onFileUploadSuccess, onFileUploadError, replaceTempId]);

  // ─── Main chat join

  // Reset when chatId changes
  useEffect(() => {
    console.log('[chatId changed]', {
      prev: prevChatIdRef.current,
      next: chatId,
      hasJoinedBefore: hasJoinedRef.current,
    });

    if (!prevChatIdRef.current) {
      prevChatIdRef.current = chatId;
      return;
    }
    if (prevChatIdRef.current !== chatId) {
      console.log('[chatId changed] resetting hasJoinedRef to false');
      hasJoinedRef.current = null;
      prevChatIdRef.current = chatId;
      resetDedup();
    }
  }, [chatId, resetDedup]);

  useEffect(() => {
    currentOrderRef.current = currentOrder;
    console.log('currentOrder at payment time:', currentOrder);
  }, [currentOrder]);

  // Restore persisted messages before socket delivers history
  useEffect(() => {
    if (!chatId) return;

    const loadAndMergeMessages = async () => {
      // Get stored messages while waiting for server
      const stored = await chatStorage.getMessages(chatId);
      if (stored?.length) {
        console.log('[Storage] loaded stored messages:', stored.length);
        setMessages(stored);
      }

      // Mark that we're ready to merge when server history arrives
      hasRestoredFromStorageRef.current = !!stored?.length;
    };

    loadAndMergeMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  // Restore persisted chat status on mount
  useEffect(() => {
    if (!chatId) return;
    chatStorage.getChatStatus(chatId).then(saved => {
      if (!saved) return;

      // ← Don't restore terminal orders for new sessions
      if (['completed', 'cancelled', 'task_completed', 'paid'].includes(saved.currentOrder?.status)) {
        chatStorage.clearChatStatus(chatId);
        chatStorage.clearMessages(chatId);
        return;
      }

      if (saved.orderCancelled) {
        setOrderCancelled(true);
        setCancelledByName(saved.cancelledByName || null);
      }
      if (saved.taskCompleted) setTaskCompleted(true);
      if (saved.currentOrder) {
        setCurrentOrder(saved.currentOrder);
        currentOrderRef.current = saved.currentOrder;
      }
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  // Persist chat status whenever it changes
  useEffect(() => {
    if (!chatId) return;
    chatStorage.saveChatStatus(chatId, {
      orderCancelled,
      cancelledByName,
      taskCompleted,
      currentOrder: currentOrder || null,
    });
  }, [chatId, orderCancelled, cancelledByName, taskCompleted, currentOrder]);

  useEffect(() => {
    if (!chatId || !messages.length) return;

    // Only save stable messages (not uploading, not temp)
    const stable = messages.filter(m =>
      !m.isUploading &&
      !m.tempId &&
      m.id &&
      !m.id.toString().startsWith('temp-')
    );

    if (!stable.length) return;

    // Don't save if we just restored and haven't processed history yet
    if (hasRestoredFromStorageRef.current && !initialHistoryProcessedRef.current) return;

    chatStorage.saveMessages(chatId, stable);
    chatStorage.saveActiveChat(chatId, currentOrder?.orderId || null);
  }, [messages, chatId, currentOrder?.orderId]);

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
    if (!socket) return;

    socket.on('orderCancelled', (data) => {
      setOrderCancelled(true);
      setCancelledByName(data.runnerName || 'Runner');

      // Add system message if not already added via 'message' event
      if (data.systemMessage) {
        setMessages(prev => {
          if (prev.some(m => m.id === data.systemMessage.id)) return prev;
          return [...prev, data.systemMessage];
        });
      }
    });

    socket.on('task_completed', ({ orderId, triggeredBy }) => {
      setTaskCompleted(true);

      // If triggered by system (auto-confirm), check rating eligibility
      const resolvedOrderId = orderId || currentOrderRef.current?.orderId;

      if (resolvedOrderId && resolvedOrderId !== 'undefined') {
        dispatch(checkCanRate(resolvedOrderId)).unwrap()
          .then(result => {
            if (result?.canRate || result.data?.canRate) {
              setRatingOrderId(resolvedOrderId);
              setCanRate(true);
              setTimeout(() => setShowRatingModal(true), 1500);
            }
          }).catch(() => { });
      }
    });

    socket.on('chatReset', () => {
      hasJoinedRef.current = null;
      onReadyCalledRef.current = false;
      // Clear immediately — don't wait for server
      setCurrentOrder(null);
      currentOrderRef.current = null;
      setTaskCompleted(false);
      setPaidChatIds(prev => { const n = new Set(prev); n.delete(chatId); return n; });
      lastProcessedSystemMsgRef.current = null;
      seenMessageIdsRef.current = new Set();

      chatStorage.clearMessages(chatId);
      chatStorage.clearActiveChat();
      chatStorage.clearDeliveryConfirmations(chatId);
      chatStorage.clearChatStatus(chatId);
      setAwaitingNewOrder(true);
    });

    return () => {
      socket.off('orderCancelled');
      socket.off('task_completed');
      socket.off('autoConfirmWarning');
      socket.off('chatReset');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, currentOrder?.orderId, dispatch, chatId]);

  useEffect(() => {
    const stageMap = {
      'Arrived at market': { stage: 1, progress: 20 },
      'Purchase in progress': { stage: 1, progress: 35 },
      'Purchase completed': { stage: 1, progress: 50 },
      'En route to delivery': { stage: 2, progress: 60 },
      'Arrived at delivery location': { stage: 3, progress: 80 },
      'Task completed': { stage: 4, progress: 100 },
      'Arrived at pickup location': { stage: 1, progress: 25 },
      'Item collected': { stage: 5, progress: 50 },
    };

    const systemMsgs = messages.filter(m => m.type === 'system');
    console.log('[stageMap] all system messages:', systemMsgs.map(m => ({ id: m.id, text: m.text })));

    const lastSystemMsg = [...messages].reverse().find(m => m.type === 'system');
    const allSystemMsgs = messages.filter(m => m.type === 'system');
    console.log('[STAGEMAP] all system message texts:', allSystemMsgs.map(m => `"${m.text}"`));
    console.log('[STAGEMAP] lastSystemMsg:', lastSystemMsg ? `"${lastSystemMsg.text}" (id: ${lastSystemMsg.id})` : 'none');
    console.log('[STAGEMAP] lastProcessed:', lastProcessedSystemMsgRef.current);
    if (lastSystemMsg) {
      console.log('[STAGEMAP] exact text bytes:', [...lastSystemMsg.text].map(c => c.charCodeAt(0)));
      console.log('[STAGEMAP] stageMap lookup result:', stageMap[lastSystemMsg.text]);
    }

    if (!lastSystemMsg) {
      console.log('[stageMap] no system message found, skipping');
      return;
    }
    if (lastProcessedSystemMsgRef.current === lastSystemMsg.id) {
      console.log('[stageMap] already processed, skipping');
      return;
    }

    const match = stageMap[lastSystemMsg.text];
    console.log('[stageMap] match for text:', lastSystemMsg.text, '→', match);

    if (!match) {
      console.log('[stageMap] no match in stageMap, skipping');
      return;
    }

    lastProcessedSystemMsgRef.current = lastSystemMsg.id;

    const trackingMsg = messages.find(m => m.type === 'tracking');
    console.log('[stageMap] tracking message exists?', !!trackingMsg);

    setMessages(prev => prev.map(m =>
      m.type === 'tracking'
        ? {
          ...m,
          trackingData: {
            ...m.trackingData,
            currentStage: match.stage,
            progressPercentage: match.progress,
            orderStatus: currentOrderRef.current?.status,
          }
        }
        : m
    ));

    console.log('[stageMap] updated tracking message to stage:', match.stage, 'progress:', match.progress);
  }, [messages]);

  // socket calls
  useEffect(() => {

    console.log('[ChatScreen socket useEffect] RUNNING', {
      hasSocket: !!socket,
      chatId,
      hasJoinedRef: hasJoinedRef.current,
    });

    if (!socket || !chatId) {
      console.log('[ChatScreen socket useEffect] BAILED — no socket or chatId');
      return;
    }

    const doJoin = () => {
      console.log('[ChatScreen doJoin] CALLED', {
        hasJoinedRef: hasJoinedRef.current,
        chatId,
        socketConnected: socket?.connected,
        currentOrderId: currentOrderRef.current?.orderId,
        joinKey: currentOrderRef.current?.orderId,
      });

      const joinKey = currentOrderRef.current?.orderId;

      if (joinKey && hasJoinedRef.current === joinKey) {
        console.warn('[ChatScreen doJoin] BLOCKED — already joined orderId:', joinKey);
        return;
      }

      // If no orderId yet, only skip if we already joined this exact chatId
      // AND it was a no-orderId join (marked with a special prefix)
      const noOrderKey = `pending:${chatId}`;
      if (!joinKey && hasJoinedRef.current === noOrderKey) {
        console.warn('[doJoin] already joined (pending, no orderId) — skipping');
        return;
      }

      hasJoinedRef.current = joinKey || chatId; // use chatId as fallback marker
      console.log("[doJoin] emitting userJoinChat");

      console.log('[ChatScreen doJoin] emitting userJoinChat', { chatId });
      socket.emit("userJoinChat", {
        chatId,
        userId: userData?._id,
        runnerId: runner?._id,
        serviceType: currentOrderRef.current?.serviceType || userData?.currentRequest?.serviceType || null,
      });
    };

    const handleChatHistory = (msgs) => {
      console.log('[ChatScreen chatHistory] received', { count: msgs?.length, chatId, onReadyCalled: onReadyCalledRef.current });
      console.log('[chatHistory] RECEIVED', msgs?.length, 'msgs, chatId:', chatId);

      if (!msgs?.length) {
        setTaskCompleted(false);
        setPaidChatIds(prev => { const n = new Set(prev); n.delete(chatId); return n; });
        if (!onReadyCalledRef.current) { onReadyCalledRef.current = true; onReady?.(); }
        return;
      }

      // Format server messages
      const serverMessages = msgs.map(msg => formatMessage(msg));

      // Check if this is a new session
      const firstMsg = msgs[0];
      const isNewSession =
        firstMsg?.type === "system" &&
        firstMsg?.text?.includes("joined the chat") &&
        !seenMessageIdsRef.current.has(firstMsg.id);

      if (isNewSession) {
        console.log('[chatHistory] new session detected, clearing stale data');
        seenMessageIdsRef.current = new Set();
        lastProcessedSystemMsgRef.current = null;
        setOrderCancelled(false);
        setTaskCompleted(false);

        // Don't wipe currentOrder if orderCreated already set a fresh one for this chatId
        const TERMINAL = ['completed', 'cancelled', 'task_completed'];
        const freshOrderExists =
          currentOrderRef.current?.chatId === chatId &&
          !TERMINAL.includes(currentOrderRef.current?.status);

        if (!freshOrderExists) {
          setCurrentOrder(null);
          currentOrderRef.current = null;
        }

        setPaidChatIds(prev => { const n = new Set(prev); n.delete(chatId); return n; });
        paidChatIdsRef.current.delete(chatId);
        chatStorage.savePaidChats(paidChatIdsRef.current);

        // Clear storage for new session
        chatStorage.clearMessages(chatId);
        setMessages(serverMessages);
        initialHistoryProcessedRef.current = true;

        // Save to storage
        const stableMessages = serverMessages.filter(m => !m.isUploading && !m.tempId);
        if (stableMessages.length) {
          chatStorage.saveMessages(chatId, stableMessages);
        }

        if (!onReadyCalledRef.current) { onReadyCalledRef.current = true; onReady?.(); }
        return;
      }

      const paymentMsg = msgs.find(m =>
        m.type === 'payment_request' || m.messageType === 'payment_request'
      );
      if (paymentMsg?.paymentData && !currentOrderRef.current) {
        const partial = {
          orderId: paymentMsg.paymentData.orderId,
          serviceType: paymentMsg.paymentData.serviceType,
          status: 'pending_payment',
          chatId,
        };
        setCurrentOrder(partial);
        currentOrderRef.current = partial;
      }

      // merge: combine stored messages with server messages
      setMessages(prev => {
        // If no stored messages, just use server messages
        if (!hasRestoredFromStorageRef.current || prev.length === 0) {
          console.log('[chatHistory] no stored messages, using server messages');
          initialHistoryProcessedRef.current = true;

          // Save to storage
          const stableMessages = serverMessages.filter(m => !m.isUploading && !m.tempId);
          if (stableMessages.length) {
            chatStorage.saveMessages(chatId, stableMessages);
          }

          return serverMessages;
        }

        // Merge existing (from storage) with server messages
        console.log('[chatHistory] merging:', {
          stored: prev.length,
          server: serverMessages.length
        });

        const merged = mergeMessages(prev, serverMessages);

        // Mark all server messages as seen
        serverMessages.forEach(m => { if (m.id) seenMessageIdsRef.current.add(m.id); });

        initialHistoryProcessedRef.current = true;

        // Save merged messages to storage (keep storage in sync)
        const stableMerged = merged.filter(m => !m.isUploading && !m.tempId);
        if (stableMerged.length) {
          chatStorage.saveMessages(chatId, stableMerged);
        }

        return merged;
      });

      // Process payment status from history
      const hasPaid = msgs.some(m =>
        (m.type === "system" && m.text?.toLowerCase().includes("made payment for this task")) ||
        m.paymentConfirmed === true
      );
      if (hasPaid) setPaidChatIds(prev => new Set(prev).add(chatId));

      const paymentConfirmations = serverMessages.filter(m =>
        m.type === 'system' && m.text?.toLowerCase().includes('made payment for this task')
      );
      paymentConfirmations.forEach(pm => {
        if (pm.id) seenMessageIdsRef.current.add(pm.id);
      });

      // Process order status from history
      const lastStatusMsg = [...msgs].reverse().find(m => {
        if (m.type !== 'system') return false;
        const t = m.text?.toLowerCase() || '';
        return t.includes('item delivered') || t.includes('task completed') ||
          t.includes('en route') || t.includes('made payment');
      });

      if (lastStatusMsg) {
        const t = lastStatusMsg.text?.toLowerCase() || '';
        const historyStatus = t.includes('task completed') ? 'task_completed'
          : t.includes('item delivered') ? 'item_delivered'
            : t.includes('en route') || t.includes('purchase') || t.includes('arrived') ? 'in_progress'
              : t.includes('made payment') ? 'paid'
                : null;

        if (historyStatus) {
          updateCurrentOrder({ status: historyStatus });
        }
      }

      // Process completion status
      const isCompleted = msgs.some(m =>
        m.type === "task_completed" ||
        m.messageType === "task_completed" ||
        (m.type === "system" && m.text?.toLowerCase().includes("task completed"))
      );
      setTaskCompleted(isCompleted);

      // Process cancellation
      const cancelMsg = msgs.find(m =>
        m.type === "system" && m.text?.toLowerCase().includes("cancelled this order")
      );
      if (cancelMsg) {
        setOrderCancelled(true);
        setCancelledByName(cancelMsg.text?.split(" ")[0] || "Runner");
      }

      if (!onReadyCalledRef.current) {
        onReadyCalledRef.current = true;

        console.log('[ChatScreen chatHistory] calling onReady');
        onReady?.();
      }
    };

    const handleMessage = (msg) => {
      if (msg.text?.toLowerCase().includes('item delivered') ||
        msg.type === 'item_delivered' ||
        msg.messageType === 'item_delivered') {
        console.log('[ITEM_DELIVERED] 🔵 raw message received:', JSON.stringify(msg, null, 2));
      }

      const isSystem =
        msg.type === "system" || msg.messageType === "system" ||
        msg.senderType === "system" || msg.senderId === "system";

      if (!msg?.id && !isSystem) return;
      if (msg.type === "fileUploadSuccess" || msg.messageType === "fileUploadSuccess") return;

      const msgId = msg.id || `system-${msg.text}-${Date.now()}`;
      const normalizedMsg = { ...msg, id: msgId };

      if (seenMessageIdsRef.current.has(msgId)) return;
      if (msg.type === 'item_submission' || msg.messageType === 'item_submission') {
        console.log('[ChatScreen Submit] item_submission received:', JSON.stringify(msg, null, 2));
      }

      seenMessageIdsRef.current.add(msgId);

      if (isSystem && normalizedMsg.text === "En route to delivery") {
        setMessages(prev => {
          if (prev.some(m => m.type === "tracking")) return prev;
          return [...prev, {
            id: `tracking-auto-${normalizedMsg.id}`,
            type: "tracking", messageType: "tracking",
            from: "system",
            time: normalizedMsg.time || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            senderId: "system", senderType: "system", status: "sent",
            trackingData: { orderId: currentOrderRef.current?.orderId, runnerId: null, status: "en_route_to_delivery" },
          }];
        });
      }

      const isPaymentConfirmation = isSystem &&
        msg.text?.toLowerCase().includes("made payment for this task");

      if (isPaymentConfirmation) {
        const existing = messages.some(m =>
          m.type === 'system' &&
          m.text?.toLowerCase().includes('made payment for this task') &&
          m.id !== msgId
        );
        if (existing) {
          console.log('[handleMessage] duplicate payment confirmation ignored');
          return;
        }

        setPaidChatIds(prev => new Set(prev).add(chatId));
        updateCurrentOrder({ paymentStatus: "paid", status: "paid" })
      }

      if (isSystem && msg.text?.toLowerCase().includes("cancelled this order")) {
        setOrderCancelled(true);

        setCancelledByName(msg.text?.split(" ")[0] || "Runner");

        chatStorage.saveChatStatus(chatId, {
          orderCancelled: true,
          cancelledByName: msg.text?.split(' ')[0] || 'Runner',
          taskCompleted: false,
          currentOrder: currentOrderRef.current || null,
        });

        chatStorage.clearMessages(chatId);
        chatStorage.clearActiveChat();
        chatStorage.clearDeliveryConfirmations(chatId);
        chatStorage.clearRunnerData();
      }

      const isTaskDone =
        msg.type === "task_completed" || msg.messageType === "task_completed" ||
        (isSystem && msg.text?.toLowerCase().includes("task completed"));
      if (isTaskDone) {
        setTaskCompleted(true);

        chatStorage.saveChatStatus(chatId, {
          orderCancelled: false,
          cancelledByName: null,
          taskCompleted: true,
          currentOrder: currentOrderRef.current || null,
        });

        chatStorage.clearMessages(chatId);
        chatStorage.clearActiveChat();
        chatStorage.clearDeliveryConfirmations(chatId);
        chatStorage.clearRunnerData();
        const orderId = msg.orderId || currentOrderRef.current?.orderId;
        if (orderId && orderId !== "undefined") {
          dispatch(checkCanRate(orderId)).unwrap()
            .then(result => {
              if (result?.canRate || result.data?.canRate) {
                setRatingOrderId(orderId);
                setCanRate(true);
                setTimeout(() => setShowRatingModal(true), 1500);
              }
            }).catch(() => { });
        }
      }

      if (isSystem) {
        const t = msg.text?.toLowerCase() || '';
        const mappedStatus =
          t.includes('task completed') ? 'task_completed'
            : t.includes('item delivered') ? 'item_delivered'
              : t.includes('arrived at pickup') ? 'arrived_at_pickup_location'
                : t.includes('item collected') ? 'item_collected'
                  : t.includes('en route') ? 'en_route_to_delivery'
                    : t.includes('arrived at delivery') ? 'arrived_at_delivery_location'
                      : t.includes('arrived at market') ? 'arrived_at_market'
                        : t.includes('purchase in progress') ? 'purchase_in_progress'
                          : t.includes('purchase completed') ? 'purchase_completed'
                            : t.includes('made payment') ? 'paid'
                              : null;

        console.log('[STATUS MAPPER] msg.text:', JSON.stringify(msg.text));
        console.log('[STATUS MAPPER] mappedStatus:', mappedStatus);
        console.log('[STATUS MAPPER] currentOrder.status before update:', currentOrderRef.current?.status);

        if (mappedStatus && currentOrderRef.current) updateCurrentOrder({ status: mappedStatus })

        console.log('[STATUS MAPPER] currentOrder.status after update:', currentOrderRef.current?.status);
      }

      const isApprovalEcho = isSystem && (
        normalizedMsg.id?.includes("approval-user-") ||
        normalizedMsg.id?.includes("rejection-user-")
      );
      if (isApprovalEcho) return;

      setMessages(prev => {
        // Check if message already exists (by id)
        const existingIndex = prev.findIndex(m => m.id === normalizedMsg.id);

        if (existingIndex !== -1) {
          // Update existing message
          const next = [...prev];
          next[existingIndex] = { ...next[existingIndex], ...formatMessage(normalizedMsg), isUploading: false };
          return next;
        }

        // Check if this is a temp message replacement
        if (normalizedMsg.tempId) {
          const tempIndex = prev.findIndex(m => m.tempId === normalizedMsg.tempId || m.id === normalizedMsg.tempId);
          if (tempIndex !== -1) {
            replaceTempId(normalizedMsg.tempId, normalizedMsg.id);
            const next = [...prev];
            next[tempIndex] = { ...formatMessage(normalizedMsg), isUploading: false, tempId: undefined };
            return next;
          }
        }

        // New message - add to end
        return [...prev, formatMessage(normalizedMsg)];
      });

      // Save updated messages to storage (debounced)
      setTimeout(() => {
        if (chatId) {
          chatStorage.getMessages(chatId).then(stored => {
            if (stored) {
              const updated = mergeMessages(stored, [normalizedMsg]);
              const stable = updated.filter(m => !m.isUploading && !m.tempId);
              if (stable.length) {
                chatStorage.saveMessages(chatId, stable);
              }
            }
          });
        }
      }, 100);
    };

    const handleMissedMessages = (msgs) => {
      if (!msgs?.length) return;
      setMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        const toAdd = msgs
          .filter(m => !existingIds.has(m.id) && !seenMessageIdsRef.current.has(m.id))
          .map(msg => { seenMessageIdsRef.current.add(msg.id); return formatMessage(msg); });
        return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
      });
    };

    // ── KEY FIX: on reconnect, reset join guard and rejoin ────────────────────
    const handleReconnect = () => {
      if (paymentInProgressRef.current) {
        console.log('[handleReconnect] payment in progress — skipping rejoin');
        return;
      }
      console.log("[ChatScreen] socket reconnected — rejoining chat:", chatId);
      flushSocketQueue(socket);

      if (userData?._id) {
        socket.emit("userOnline", { userId: userData._id, userType: "user", chatId });
      }

      // Always reset join guard and rejoin — don't wait for sessionRefreshOk
      hasJoinedRef.current = null;
      doJoin();

    };

    const handleTrackingStarted = (data) => {
      setMessages(prev => {
        if (prev.some(m => m.type === "tracking")) return prev;
        return [...prev, {
          id: `tracking-${Date.now()}`,
          type: "tracking", from: "system", messageType: "tracking",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          senderId: "system", senderType: "system", status: "sent",
          trackingData: {
            orderId: data.orderId || currentOrderRef.current?.orderId,
            runnerId: data.runnerId,
            status: "en_route_to_delivery",
            orderStatus: currentOrderRef.current?.status,
          },
        }];
      });
    };

    const handleSessionRefreshOk = ({ chatId: inc }) => {
      if (inc !== chatId) return;
      console.log('[ChatScreen] sessionRefreshOk — rejoining quietly');
      socket.emit('rejoinChat', {
        chatId,
        userId: userData?._id,
        userType: 'user',
      });
    };

    const onDisputeRaised = ({ orderId }) => {
      if (currentOrderRef.current?.orderId === orderId) {
        updateCurrentOrder({ hasDispute: true });
      }
    };

    socket.on("chatHistory", handleChatHistory);
    socket.on("message", handleMessage);
    socket.on("missedMessages", handleMissedMessages);
    socket.on("connect", handleReconnect);
    socket.on("trackingStarted", handleTrackingStarted);
    socket.on('sessionRefreshOk', handleSessionRefreshOk);
    socket.on('disputeRaised', onDisputeRaised);

    // ── Always attempt join on mount/chatId change ────────────────────────────
    if (socket?.connected) {
      doJoin();
    } else {
      // Socket not ready yet — handleReconnect will call doJoin when it connects
      console.log('[ChatScreen] socket not connected on mount — waiting for reconnect');
    }

    return () => {
      socket.off("chatHistory", handleChatHistory);
      socket.off("message", handleMessage);
      socket.off("missedMessages", handleMissedMessages);
      socket.off("connect", handleReconnect);
      socket.off("trackingStarted", handleTrackingStarted);
      socket.off('sessionRefreshOk', handleSessionRefreshOk);
      socket.off('disputeRaised', onDisputeRaised);
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, chatId]);


  useEffect(() => {
    if (!socket) return;

    const onDeliveryConfirmed = ({ orderId }) => {
      setDeliveryConfirmations(prev => ({ ...prev, [orderId]: 'confirmed' }));

      setMessages(prev => prev.map(m =>
        m.type === 'delivery_confirmation_request' && m.orderId === orderId
          ? { ...m, confirmationStatus: 'confirmed' }
          : m
      ));

      setMessages(prev => prev.map(m =>
        m.type === 'tracking'
          ? {
            ...m, trackingData:
            {
              ...m.trackingData,
              currentStage: 4,
              progressPercentage: 100
            }
          }
          : m
      ));
    };

    const onDeliveryDenied = ({ orderId }) => {
      setDeliveryConfirmations(prev => ({ ...prev, [orderId]: 'denied' }));

      setMessages(prev => prev.map(m =>
        m.type === 'delivery_confirmation_request' && m.orderId === orderId
          ? { ...m, confirmationStatus: 'denied' }
          : m
      ));
    };

    const onDeliveryMarkedComplete = () => {
      setMessages(prev => prev.map(m =>
        m.type === 'tracking'
          ? {
            ...m, trackingData:
            {
              ...m.trackingData,
              currentStage: 4,
              progressPercentage: 95
            }
          }
          : m
      ));
    };

    socket.on('deliveryConfirmed', onDeliveryConfirmed);
    socket.on('deliveryDenied', onDeliveryDenied);
    socket.on('deliveryMarkedComplete', onDeliveryMarkedComplete);

    return () => {
      socket.off('deliveryConfirmed', onDeliveryConfirmed);
      socket.off('deliveryDenied', onDeliveryDenied);
      socket.off('deliveryMarkedComplete', onDeliveryMarkedComplete);
    };
  }, [socket, setMessages]);


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
  }, [socket]);

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
      if (!currentOrderRef.current) setCurrentOrder({ orderId: data.orderId });
      setRatingOrderId(data.orderId);
      try {
        const result = await dispatch(checkCanRate(data.orderId)).unwrap();
        // console.log('checkCanRate result:', JSON.stringify(result));
        if (result?.canRate || result.data?.canRate) {
          setRatingOrderId(data.orderId);
          setCanRate(true);
          setTimeout(() => setShowRatingModal(true), 1500);
        }
      } catch (_) { }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onPromptRating, dispatch]);

  useEffect(() => {
    onOrderCreated((data) => {
      const newOrder = data.order;
      if (!newOrder?.orderId) return;

      if (currentOrderRef.current?.orderId !== newOrder.orderId) {
        setCurrentOrder(newOrder);
      }

      currentOrderRef.current = newOrder;
      setAwaitingNewOrder(false);

      if (!onReadyCalledRef.current) {
        onReadyCalledRef.current = true;
        onReady?.();
      }

      if (newOrder?.paymentStatus === 'paid') {
        setPaidChatIds(prev => new Set(prev).add(chatId));
      }

      if (data?.order?.accountType === 'business' || userData?.accountType === 'business') {
        setTimeout(() => setShowTeamNotify(true), 1000);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onOrderCreated, chatId]);

  useEffect(() => {
    if (!chatId) return;

    dispatch(fetchOrderByChatId(chatId))
      .unwrap()
      .then((order) => {
        console.log('[fetchOrder] result:', order);
        console.log('[fetchOrder] about to setCurrentOrder, store before:', useUserOrderStore.getState().currentOrder?.orderId);

        if (order) {
          // Don't restore terminal orders — new session is starting
          if (['completed', 'cancelled', 'task_completed'].includes(order.status)) return;
          setCurrentOrder(order);
          console.log('[fetchOrder] setCurrentOrder called, store after:', useUserOrderStore.getState().currentOrder?.orderId);

          const chatFlowStatus =
            order.status === 'delivered' ? 'item_delivered'
              : order.status === 'completed' ? 'task_completed'
                : order.status;

          if (chatFlowStatus !== order.status) {
            updateCurrentOrder({ status: chatFlowStatus });
          }

          currentOrderRef.current = order; // sync ref immediately
          console.log('Order fetched on mount:', order.orderId);

          // Re-attempt join now that we have the real orderId as guard key
          if (socket) {
            const pendingKey = `pending:${chatId}`;
            const alreadyJoinedWithOrderId = hasJoinedRef.current === order.orderId;
            const joinedWithoutOrderId = hasJoinedRef.current === pendingKey || hasJoinedRef.current === null;

            if (!alreadyJoinedWithOrderId && joinedWithoutOrderId) {
              console.log('[fetchOrderByChatId] upgrading join to orderId:', order.orderId);
              socket.emit('userJoinChat', {
                chatId,
                userId: userData?._id,
                runnerId: runner?._id,
                serviceType: order.serviceType || order.taskType || null,
              });
              hasJoinedRef.current = order.orderId;
            }
          }

          // If order is already completed, restore rating state
          const completedStatuses = ['completed', 'task_completed', 'delivered'];
          if (completedStatuses.includes(order.status)) {
            setRatingOrderId(order.orderId);
            dispatch(checkCanRate(order.orderId)).unwrap()
              .then(result => {
                if (result?.canRate || result.data?.canRate) {
                  setCanRate(true);
                }
              })

            setTaskCompleted(true)
              .catch(() => { });
          }
        }
      })
      .catch((err) => {
        console.log('[fetchOrder] failed:', err);
        // No order yet — fine, onOrderCreated will set it when runner accepts
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, dispatch, runner?._id, userData?._id, socket]);


  useEffect(() => {
    if (!socket || !chatId || !currentOrder?.orderId) return;

    const joinKey = currentOrder.orderId;

    // Only rejoin if we joined without an orderId — upgrade the room membership
    // Do NOT rejoin if we already have this orderId as the join key (prevents double chatHistory)
    const joinedWithoutOrderId =
      hasJoinedRef.current === chatId ||
      hasJoinedRef.current === `pending:${chatId}` ||
      hasJoinedRef.current === false ||
      hasJoinedRef.current === null;

    if (!joinedWithoutOrderId) return;
    if (currentOrder?.status === 'pending_payment') return;

    console.log('[rejoin] upgrading join with orderId:', joinKey);
    hasJoinedRef.current = joinKey;

    socket.emit('rejoinChat', {
      chatId,
      userId: userData?._id,
      userType: 'user',
      serviceType: currentOrder.serviceType || currentOrder.taskType || null,
      isUpgrade: true, // tell server: don't re-send chatHistory
    });
  }, [currentOrder?.orderId, socket, chatId, userData?._id, currentOrder?.serviceType]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    onPaymentConfirmed((data) => {
      if (data.order) updateCurrentOrder(data.order);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onPaymentConfirmed, chatId]);

  useEffect(() => {
    onDisputeResolved((data) => {
      setMessages(prev => prev.map(m =>
        m.type === 'dispute_raised' && m.disputeId === data.disputeId
          ? { ...m, status: 'resolved' } : m
      ));
    });
  }, [onDisputeResolved]);

  // ─── Payment 

  const handlePayment = async (paymentData, paymentMethod) => {
    // ── PIN gate for wallet payments ────────────────────────────────────────
    if (paymentMethod === 'wallet') {
      const hasPinSet = isPinSet || userData?.pin !== undefined;
      if (!hasPinSet) {
        alert('A transaction PIN is required for wallet payments. Set your PIN in Settings → Profile → Security.');
        return false;
      }
      // store paymentData
      setPendingWalletPayment({
        ...paymentData,
        orderId: paymentData?.orderId || currentOrderRef.current?.orderId || currentOrder?.orderId,
      });
      return 'pending';
    }

    // no pin for card payment
    return await executePayment(paymentData, 'card');
  };

  const executePayment = async (paymentData, paymentMethod, pin) => {

    if (paymentMethod === 'wallet' && !pin) {
      console.error('[executePayment] blocked — wallet payment missing PIN');
      return false;
    }

    const latestOrder = currentOrderRef.current;
    const orderId = paymentData?.orderId || latestOrder?.orderId || latestOrder?._id?.toString();

    const resolvedServiceType =
      latestOrder?.serviceType ||
      latestOrder?.taskType ||
      userData?.currentRequest?.serviceType ||
      null;

    console.log('[executePayment] resolved orderId:', orderId);
    console.log('currentOrder at payment:', latestOrder);
    console.log('orderId being sent:', latestOrder?.orderId);
    console.log('paymentData:', paymentData);
    console.log('[frontend] dispatching createPaymentIntent with:', { latestOrder, paymentMethod, pin, });

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
        orderId,
        paymentMethod,
        serviceType: resolvedServiceType,
        pin
      })).unwrap();

      if (!result || result.success === false) {
        throw new Error(result?.message || 'Payment failed');
      }

      setMessages(prev => prev.filter(m => m.id !== pendingMsg.id));

      if (paymentMethod === 'wallet') {
        //  when payment succeeds, remove everything payment-related
        setMessages(prev => prev.filter(m =>
          m.type !== 'payment_request' &&
          m.messageType !== 'payment_request' &&
          m.type !== 'payment_failed' &&
          m.type !== 'payment_pending'
        ));

        setMessages(prev => prev.filter(m => m.type !== 'payment_request' && m.messageType !== 'payment_request'));
        if (socket) socket.emit('paymentSuccess', {
          chatId,
          escrowId: result?.escrowId,
          orderId: latestOrder?.orderId,   // ← add this
        });
        return true;

      } else if (paymentMethod === 'card') {
        setPaystackModal({
          reference: result?.reference,
          amount: result?.amount,
          chatId,
          email: userData?.email,
        });
        paymentInProgressRef.current = true
        return false;
      }

    } catch (error) {
      console.error('Payment failed:', error);
      setMessages(prev => prev.filter(m =>
        m.id !== pendingMsg.id &&
        m.type !== 'payment_request' &&  // remove payment request card
        m.messageType !== 'payment_request'
      ));
      setMessages(prev => prev.filter(m => m.id !== pendingMsg.id));
      setMessages(prev => [...prev, {
        id: `payment-failed-${Date.now()}`,
        from: 'system',
        type: 'payment_failed',
        text: 'Payment failed. Please try again.',
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        paymentData: paymentData,
      }]);

      resetPaymentUIRef.current?.();
      return false;
    }
  };

  const handleRetryPayment = (paymentData) => {
    // Remove failed message, re-add payment_request so buttons show again
    setMessages(prev => prev.filter(m =>
      m.type !== 'payment_failed' &&
      m.type !== 'payment_pending' &&
      m.type !== 'payment_request' &&
      m.messageType !== 'payment_request'
    ));
    // Re-add payment request with fresh state
    setMessages(prev => [...prev, {
      id: `payment-request-retry-${Date.now()}`,
      from: 'system',
      type: 'payment_request',
      messageType: 'payment_request',
      paymentData,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    }]);
  };

  const handlePaystackSuccess = (reference) => {
    paymentInProgressRef.current = false;
    setPaystackModal(null);
    paymentInProgressRef.current = true
    markPaidRef.current?.();
    setPaidChatIds(prev => new Set(prev).add(chatId));

    setMessages(prev => prev.filter(m =>
      m.type !== 'payment_request' && m.messageType !== 'payment_request'
    ))

    if (socket) socket.emit('paymentSuccess', {
      chatId,
      reference: reference.reference,
      orderId: currentOrderRef.current?.orderId,
      escrowId: currentOrderRef.current?.escrowId,
    });
  };

  // ─── Item / delivery

  const handleApproveItems = (submissionId, escrowId) => {
    setMessages(prev => prev.map(m =>
      m.submissionId === submissionId || m.id === submissionId
        ? { ...m, status: 'approved', rejectionReason: null }
        : m
    ));
    const payload = { chatId, submissionId, escrowId, userId: userData?._id };
    if (socket?.connected) {
      socket.emit('approveItems', payload);
    } else {
      enqueueSocketEvent('approveItems', payload);
    }
  };

  const handleRejectItems = (submissionId, reason) => {
    setMessages(prev => prev.map(m =>
      m.submissionId === submissionId || m.id === submissionId
        ? { ...m, status: 'rejected', rejectionReason: reason }
        : m
    ));
    const payload = { chatId, submissionId, reason, userId: userData?._id };
    if (socket?.connected) {
      socket.emit('rejectItems', payload);
    } else {
      enqueueSocketEvent('rejectItems', payload);
    }
  };

  const handleApprovePickupItem = (submissionId) => {
    setMessages(prev => prev.map(m =>
      m.submissionId === submissionId || m.id === submissionId
        ? { ...m, status: 'approved', rejectionReason: null }
        : m
    ));
    const payload = { chatId, submissionId, userId: userData?._id };
    if (socket?.connected) {
      socket.emit('approvePickupItem', payload);
    } else {
      enqueueSocketEvent('approvePickupItem', payload);
    }
  };

  const handleRejectPickupItem = (submissionId, reason) => {
    setMessages(prev => prev.map(m =>
      m.submissionId === submissionId || m.id === submissionId
        ? { ...m, status: 'rejected', rejectionReason: reason }
        : m
    ));
    const payload = { chatId, submissionId, reason, userId: userData?._id };
    if (socket?.connected) {
      socket.emit('rejectPickupItem', payload);
    } else {
      enqueueSocketEvent('rejectPickupItem', payload);
    }
  };

  const handleConfirmDelivery = (orderId) => {
    const payload = { chatId, orderId, userId: userData?._id };
    if (socket?.connected) {
      socket.emit('confirmDelivery', payload);
    } else {
      enqueueSocketEvent('confirmDelivery', payload);
    }
  };

  const handleDenyDelivery = (orderId) => {
    const payload = { chatId, orderId, userId: userData?._id };
    if (socket?.connected) {
      socket.emit('denyDelivery', payload);
    } else {
      enqueueSocketEvent('denyDelivery', payload);
    }
  };

  // ─── Messaging 

  const send = async () => {
    const hasText = text.trim();
    const hasFiles = selectedFiles.length > 0;
    if (!hasText && !hasFiles) return;
    // chatStorage.clearDraft(chatId);

    if (hasText) {
      const messageId = Date.now().toString();
      const newMsg = {
        id: messageId, from: "me", text: text.trim(),
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        createdAt: new Date().toISOString(),
        status: socket?.connected ? "pending" : "queued",
        senderId: userData?._id, senderType: "user",
        ...(replyingTo && {
          replyTo: replyingTo.id,
          replyToMessage: replyingTo.text || replyingTo.fileName || "Media",
          replyToFrom: replyingTo.from,
        })
      };
      seenMessageIdsRef.current.add(messageId);
      setMessages(p => [...p, newMsg]);
      setText("");
      setReplyingTo(null);

      if (socket?.connected) {
        sendMessage(chatId, newMsg);
      } else {
        enqueue(newMsg);
      }
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
        const tempId = `temp-${Date.now()}-${++tempIdCounterRef.current}-${Math.random().toString(36).slice(2, 9)}`;
        console.log('TEMP MESSAGE:', tempId);
        seenMessageIdsRef.current.add(tempId);

        const localMsg = {
          id: tempId, from: "me", type: messageType, fileName: name,
          fileUrl: preview, fileSize, text: "",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          status: "uploading", senderId: userData?._id, senderType: "user",
          fileType: type, isUploading: true, tempId,
          createdAt: new Date().toISOString(),
        };
        setMessages(prev => [...prev, localMsg]);
        setUploadingFiles(prev => new Set(prev).add(tempId));

        try {
          const base64 = await fileToBase64(file);
          uploadFile({
            chatId, file:
              base64,
            fileName: name,
            fileType: type,
            senderId: userData?._id,
            senderType: "user",
            tempId: tempId,
          });
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

  // ─── Message actions

  const handleDeleteMessage = (messageId, deleteForEveryone = false) => {
    setMessages(prev => prev.map(msg => msg.id === messageId
      ? { ...msg, deleted: true, text: "You deleted this message", type: "deleted", fileUrl: null, fileName: null }
      : msg
    ));
    if (deleteForEveryone && chatId) {
      const payload = { chatId, messageId, userId: userData?._id, deleteForEveryone: true };
      if (socket?.connected) {
        socket.emit('deleteMessage', payload);
      } else {
        enqueueSocketEvent('deleteMessage', payload);
      }
    }
  };


  const handleEditMessage = (messageId, newText) => {
    setMessages(prev => prev.map(msg => msg.id === messageId ? { ...msg, text: newText, edited: true } : msg));
  };

  const handleMessageReact = (messageId, emoji) => {
    setMessages(prev => prev.map(msg => msg.id === messageId ? { ...msg, reaction: emoji } : msg));
    const payload = { chatId, messageId, emoji, userId: userData?._id };
    if (socket?.connected) {
      socket.emit('reactToMessage', payload);
    } else {
      enqueueSocketEvent('reactToMessage', payload);
    }
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

  const availableDisputeReasons = useMemo(() => {
    if (!currentOrder) return [];
    return getAvailableReasons(
      currentOrder.serviceType ?? currentOrder.taskType,
      currentOrder.status
    );
    // eslint-disable-next-line 
  }, [currentOrder?.serviceType, currentOrder?.taskType, currentOrder?.status]);

  const canRaiseDispute = useMemo(() => {
    console.log('[canRaiseDispute] currentOrder.status:', currentOrder?.status);
    console.log('[canRaiseDispute] serviceType:', currentOrder?.serviceType ?? currentOrder?.taskType);
    console.log('[canRaiseDispute] availableReasons:', availableDisputeReasons.map(r => r.value));

    if (!currentOrder) return false;
    if (orderCancelled) return false;
    if (currentOrder.status === 'cancelled') return false;
    if (currentOrder.hasDispute) return false;
    if (currentOrder.usedPayoutSystem === false &&
      currentOrder.status === 'task_completed') return false;
    return availableDisputeReasons.length > 0;
  }, [currentOrder, orderCancelled, availableDisputeReasons]);

  return (
    <>
      {/* onSettings */}
      {showSettings && (
        <div className="fixed inset-0 z-[999]">
          <Settings
            darkMode={darkMode}
            onBack={() => setShowSettings(false)}
            onToggleDarkMode={toggleDarkMode}
          />
        </div>
      )}

      {showOrderDetails && (
        <OrderDetailsSheet
          isOpen={showOrderDetails}
          onClose={() => setShowOrderDetails(false)}
          darkMode={darkMode}
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
          onSubmitted={() => setRated(true)}
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
          serviceType={currentOrder?.serviceType || currentOrder?.taskType || null}
          orderStatus={currentOrder?.status || null}
          socket={socket}
          existingDispute={currentOrder?.dispute ?? null}
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
        onSettings={() => { setShowMoreSheet(false); setShowSettings(true); }}
        hasActiveOrder={canRaiseDispute}
        onRaiseDispute={() => { setShowMoreSheet(false); setShowDisputeForm(true); }}
        onOrderDetails={() => { setShowMoreSheet(false); setShowOrderDetails(true); }}
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
        <div className="fixed inset-0 z-[9999]">
          {callType === "video" ? (
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
              darkMode={darkMode}
              onAccept={() => acceptCall()}
              onDecline={declineCall}
              onEnd={endCall}
              onToggleMute={toggleMute}
              onToggleCamera={toggleCamera}
              onSwitchCamera={switchCamera}
              onToggleSpeaker={toggleSpeaker}
              isConnecting={isConnecting}
              callError={callError}
            />
          ) : (
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
              onAccept={() => acceptCall()}
              onDecline={declineCall}
              onEnd={endCall}
              onToggleMute={toggleMute}
              onToggleCamera={toggleCamera}
              isConnecting={isConnecting}
              callError={callError}
            />
          )}
        </div>
      )}

      <div className="h-full flex flex-col">
        <Header
          title={callerName || "Runner"}
          darkMode={darkMode} toggleDarkMode={toggleDarkMode}
          rightActions={
            <div className="flex items-center gap-3">
              <div className={`text-sm font-medium ${partnerOnline ? 'text-green-500' : 'text-red-400'}`}>
                {partnerOnline ? 'Online' : 'Offline'}
              </div>

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
              console.log('[render msg]', m.id, m.type, m.messageType);
              if (m.type === 'profile-card' || m.messageType === 'profile-card') {
                return (
                  <div key={m.id} className="my-4">
                    <ProfileCardMessage runnerInfo={m.runnerInfo} darkMode={darkMode} />
                  </div>
                );
              }

              // Payment request — handled here with full payment logic
              // Message.jsx also has a handler but uses different prop interface

              if (m.type === 'payment_request' || m.messageType === 'payment_request') {

                const hasPaymentConfirmation = messages.some(msg =>
                  msg.type === 'system' &&
                  msg.text?.toLowerCase().includes('made payment for this task')
                );
                const alreadyPaid = paidChatIds.has(chatId) || hasPaymentConfirmation;
                if (alreadyPaid) return null;

                return (
                  <div key={m.id} className="my-4">
                    <PaymentRequestMessage
                      darkMode={darkMode}
                      paymentData={m.paymentData}
                      alreadyPaid={alreadyPaid}
                      onPayment={handlePayment}
                      resetRef={resetPaymentUIRef}
                      markPaidRef={markPaidRef}
                      orderCancelled={orderCancelled}
                    />
                  </div>
                );
              }
              // dispute
              if (m.type === 'dispute_raised' || m.messageType === 'dispute_raised') {
                return (
                  <div key={m.id} className="my-4 flex justify-center">
                    <div className={`max-w-sm w-full rounded-2xl p-4 border border-red-500/20 bg-red-500/10`}>
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <AlertTriangle className="w-4 h-4 text-red-500" />
                        </div>
                        <div>
                          <p className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-black-200'}`}>
                            Dispute raised
                          </p>
                          <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            {m.text}
                          </p>
                          {m.disputeDetails?.reason && (
                            <p className={`text-xs mt-1 font-medium text-red-400`}>
                              Reason: {m.disputeDetails.reason.replace(/_/g, ' ')}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className={`mt-3 pt-3 border-t border-red-500/10 text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                        Escrow is locked until resolved
                      </div>
                    </div>
                  </div>
                );
              }

              if (m.type === 'payment_confirmed' || m.messageType === 'payment_confirmed') {
                const alreadyPaid = paidChatIds.has(chatId);
                return (
                  <div key={m.id} className="my-4">
                    <PaymentRequestMessage
                      darkMode={darkMode}
                      paymentData={m.paymentData}
                      message={m}
                      alreadyPaid={alreadyPaid}
                      onPayment={handlePayment}
                      resetRef={resetPaymentUIRef}
                      markPaidRef={markPaidRef}
                      orderCancelled={orderCancelled}
                    />
                  </div>
                );
              }

              if (m.type === 'item_submission' || m.messageType === 'item_submission') {
                // console.log('ITEM SUBMISSION MSG:', m);
                return (
                  <div key={m.id} className="my-4">
                    <ItemSubmissionMessage
                      message={m}
                      darkMode={darkMode}
                      onApprove={handleApproveItems}
                      onReject={handleRejectItems}
                    />
                  </div>
                );
              }

              if (m.type === 'pickup_item_submission' || m.messageType === 'pickup_item_submission') {
                return (
                  <div key={m.id} className="my-4">
                    <PickupItemSubmissionMessage
                      message={m}
                      darkMode={darkMode}
                      onApprove={handleApprovePickupItem}
                      onReject={handleRejectPickupItem}
                    />
                  </div>
                );
              }

              if (m.type === 'delivery_confirmation_request' || m.messageType === 'delivery_confirmation_request') {

                // Get persisted confirmation status from deliveryConfirmations state
                const persistedStatus = deliveryConfirmations?.[m.orderId];

                // Use persisted status if available, otherwise use message's confirmationStatus
                const confirmationStatus = persistedStatus || m.confirmationStatus;

                return (
                  <div key={m.id} className="my-4">
                    <DeliveryConfirmationMessage
                      message={{ ...m, confirmationStatus }}
                      darkMode={darkMode}
                      onConfirm={handleConfirmDelivery}
                      onDeny={handleDenyDelivery}
                      socket={socket}
                    />
                  </div>
                );
              }

              if (m.type === 'tracking') {
                return (
                  <div key={m.id} className="my-2 flex justify-start">
                    <TrackDeliveryScreen
                      darkMode={darkMode}
                      socket={socket}
                      orderId={currentOrder?.orderId || m.trackingData?.orderId}
                      onClose={() => { }}
                      serviceType={serviceType}
                      trackingData={m.trackingData}
                    // enabled={true}
                    />
                  </div>
                );
              }

              // All other types: system, text, image, audio, video, file,
              // payment_success, payment_failed, payment_pending,
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

                  onRetryPayment={(paymentData, method) => handleRetryPayment(paymentData, method)}
                />
              );
            })}

            {(otherUserTyping || otherUserRecording) && <TypingRecordingIndicator />}
          </div>
        </div>

        <div className="w-full bg-gray-100 dark:bg-black-200 px-4 py-4">
          {taskCompleted ? (
            // ── Task completed — show rating + home buttons ──
            <div className="flex gap-3 px-4 sm:px-8 lg:px-64">
              <button
                onClick={() => {
                  if (rated) return;
                  // Fall back to currentOrder if ratingOrderId isn't set yet
                  const orderId = ratingOrderId || currentOrderRef.current?.orderId || currentOrder?.orderId;
                  if (orderId) {
                    setRatingOrderId(orderId);
                    setShowRatingModal(true);
                  }
                }}
                disabled={rated}
                className={`flex-1 py-4 rounded-xl font-semibold text-white transition-all ${rated ? 'bg-gray-400 cursor-not-allowed opacity-60' : 'bg-primary hover:opacity-90'
                  }`}
              >
                {rated ? '⭐ Rated' : '⭐ Rate Runner'}
              </button>
              <button
                onClick={onOrderComplete}
                className={`flex-1 py-4 rounded-xl font-semibold transition-all ${darkMode
                  ? 'bg-black-200 text-white hover:bg-black-200/70'
                  : 'bg-gray-200 text-black-200 hover:bg-gray-300'
                  }`}
              >
                Back to Home
              </button>
            </div>
          ) : orderCancelled ? (
            // ── Order cancelled by runner ──
            <div className="flex flex-col items-center gap-3 px-4 sm:px-8 lg:px-64">
              <p className={`text-sm font-medium text-center ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                {cancelledByName ? `${cancelledByName} cancelled this order` : 'This order was cancelled'}
              </p>
              <button
                onClick={onOrderComplete}
                className="w-full py-4 rounded-xl bg-primary text-white font-semibold"
              >
                Back to Home
              </button>
            </div>
          ) : (
            // ── Normal chat input ──
            <div className="absolute w-full bottom-8 sm:bottom-[40px] px-4 sm:px-8 lg:px-64 right-0 left-0">
              <CustomInput
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  handleTyping();
                  // chatStorage.saveDraft(chatId, e.target.value);
                }}
                onKeyDown={handleTyping}
                send={send}
                showMic={true}
                showIcons={true}
                placeholder="Type a message"
                onAttachClick={() => fileInputRef.current?.click()}
                selectedFiles={selectedFiles}
                onRemoveFile={handleRemoveFile}
                replyingTo={replyingTo}
                onCancelReply={() => setReplyingTo(null)}
                onRecordingStart={handleRecordingStart}
                onRecordingStop={handleRecordingStop}
                darkMode={darkMode}
                onAudioReady={async (blob, url, mimeType) => {
                  const tempId = `audio-temp-${Date.now()}-${++tempIdCounterRef.current}-${Math.random().toString(36).slice(2, 9)}`;
                  seenMessageIdsRef.current.add(tempId)

                  const localMsg = {
                    id: tempId,
                    from: 'me',
                    type: 'audio',
                    fileName: 'voice-message.webm',
                    fileUrl: url,
                    fileSize: `${(blob.size / 1024).toFixed(1)} KB`,
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    mimeType: mimeType,
                    status: 'uploading',
                    senderId: userData?._id,
                    senderType: 'user',
                    isUploading: true,
                    tempId,
                    createdAt: new Date().toISOString(),
                  };

                  setMessages(prev => [...prev, localMsg]);
                  setUploadingFiles(prev => new Set(prev).add(tempId));

                  try {
                    const base64 = await fileToBase64(blob);
                    uploadFile({
                      chatId,
                      file: base64,
                      fileName: 'voice-message.webm',
                      fileType: mimeType || 'audio/webm',
                      senderId: userData?._id,
                      senderType: 'user',
                      tempId,
                    });
                  } catch (err) {
                    console.error('Audio upload error:', err);
                    setMessages(prev => prev.map(m =>
                      m.id === tempId ? { ...m, status: 'failed', isUploading: false } : m
                    ));
                    setUploadingFiles(prev => { const s = new Set(prev); s.delete(tempId); return s; });
                  }
                }}
              />
              <input
                type="file" ref={fileInputRef} onChange={handleFileSelect}
                className="hidden" accept="image/*,video/*,.pdf,.doc,.docx"
              />
            </div>
          )}
        </div>
      </div>

      {pendingWalletPayment && (
        <PinPad
          dark={darkMode}
          title="Confirm Payment"
          subtitle={`Enter your PIN to pay ₦${Number(pendingWalletPayment.totalAmount || 0).toLocaleString()}`}
          onVerified={(pin) => {
            console.log('[PinPad] pin value received:', pin, typeof pin);
            const payment = pendingWalletPayment;
            setPendingWalletPayment(null);
            executePayment(payment, 'wallet', pin);
          }}
          onCancel={() => {
            paymentInProgressRef.current = false;
            setPendingWalletPayment(null);
            resetPaymentUIRef.current?.(); // ← reset the card UI
          }}
        />
      )}

      {showTeamNotify && (
        <TeamNotifyPrompt
          darkMode={darkMode}
          chatId={chatId}
          orderData={currentOrder}
          onDismiss={() => setShowTeamNotify(false)}
        />
      )}
    </>
  );
}