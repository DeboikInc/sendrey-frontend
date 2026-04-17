import React, { useState, useRef, useEffect, useMemo } from "react";
import { IconButton, Tooltip } from "@material-tailwind/react";
import { Phone, Video, MoreHorizontal } from "lucide-react";
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
import { usePushNotifications } from "../../hooks/usePushNotifications";
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
import { useMessageDedup } from '../../hooks/useMessageDedup';
import chatStorage from '../../utils/chatStorage';

import { createPaymentIntent } from '../../Redux/paymentSlice';
import { fetchOrderByChatId } from '../../Redux/orderSlice';

const HeaderIcon = ({ children, tooltip, onClick }) => (
  <Tooltip content={tooltip} placement="bottom" className="text-xs">
    <IconButton variant="text" size="sm" className="rounded-full" onClick={onClick}>
      {children}
    </IconButton>
  </Tooltip>
);

// testing only
// onBack
export default function ChatScreen({ runner, userData, darkMode, toggleDarkMode, onOrderComplete }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [uploadingFiles, setUploadingFiles] = useState(new Set()); // eslint-disable-line no-unused-vars
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [replyingTo, setReplyingTo] = useState(null);

  const listRef = useRef(null);
  const fileInputRef = useRef(null);

  const { markSeen, isSeen, replaceTempId, reset: resetDedup } = useMessageDedup();

  const dispatch = useDispatch();
  const [paystackModal, setPaystackModal] = useState(null);

  const [showMoreSheet, setShowMoreSheet] = useState(false);
  const [showWallet, setShowWallet] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);

  const [orderCancelled, setOrderCancelled] = useState(false);
  const [cancelledByName, setCancelledByName] = useState(null);

  const [ratingOrderId, setRatingOrderId] = useState(null);
  const [currentOrder, setCurrentOrder] = useState(null);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  const [canRate, setCanRate] = useState(false);
  const [paidChatIds, setPaidChatIds] = useState(new Set());
  const serviceType =
    currentOrder?.serviceType ||
    currentOrder?.taskType ||
    userData?.currentRequest?.serviceType ||
    null;

  const [taskCompleted, setTaskCompleted] = useState(false);
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
    onReceiveTrackRunner,
    onPartnerOnline, onPartnerOffline, setPresenceContext
  } = useSocket();

  const partnerOnlineRef = useRef(true);
  const setPresenceContextRef = useRef(setPresenceContext);
  const onPartnerOnlineRef = useRef(onPartnerOnline);
  const onPartnerOfflineRef = useRef(onPartnerOffline);

  const { permission, requestPermission } = usePushNotifications({
    userId: userData?._id,
    userType: 'user',
    socket,
    onIncomingCall: (data) => {
      // data has: callId, chatId, callType, callerId, callerType, channelName, token
      // Feed it into your existing useCallHook as if incomingCall socket event fired
      acceptCall(data); // or however useCallHook exposes incoming call state
    },
  });

  const chatId = useMemo(() => {
    return userData?._id && runner?._id
      ? `user-${userData._id}-runner-${runner._id}`
      : null;
  }, [userData?._id, runner?._id]);

  const { enqueue } = useMessageQueue({
    socket,
    isConnected: socket?.connected,
    chatId,
    sendMessage
  });

  const { handleTyping, handleRecordingStart, handleRecordingStop,
    otherUserTyping, otherUserRecording } = useTypingAndRecordingIndicator({
      socket, chatId, currentUserId: userData?._id, currentUserType: 'user',
    });

  const {
    callState, callType, isMuted, isCameraOff, formattedDuration,
    remoteUsers, localVideoTrack, initiateCall, acceptCall, isSpeakerOn, networkQuality,
    declineCall, endCall, toggleMute, toggleCamera, switchCamera, toggleSpeaker
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
    if (userData?._id && socket && permission === 'default') requestPermission();
  }, [userData?._id, socket, permission, requestPermission]);

  useEffect(() => {
    if (socket && userData?._id) {
      socket.emit('rejoinUserRoom', { userId: userData._id, userType: 'user' });
    }
  }, [socket, userData?._id]);

  // presence context for server recognition
  useEffect(() => {
    if (chatId && userData?._id) {
      setPresenceContextRef.current(userData._id, 'user', chatId);
    }
  }, [chatId, userData?._id]);

  useEffect(() => {
    onPartnerOnlineRef.current(({ chatId: incomingChatId }) => {
      if (incomingChatId !== chatId) return;
      partnerOnlineRef.current = true;
      setPartnerOnline(true);
    });

    onPartnerOfflineRef.current(({ chatId: incomingChatId }) => {
      if (incomingChatId !== chatId) return;
      partnerOnlineRef.current = false;
      setPartnerOnline(false);
    });
  }, [chatId]);

  // ─── File upload 

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
  }, [onFileUploadSuccess, onFileUploadError, markSeen, replaceTempId]);

  // ─── Main chat join

  // In ChatScreen.jsx - replace the useEffect that handles chat history (around line 200-280)



  // Reset when chatId changes
  useEffect(() => {
    if (!prevChatIdRef.current) {
      prevChatIdRef.current = chatId;
      return;
    }
    if (prevChatIdRef.current !== chatId) {
      hasJoinedRef.current = false;
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
    chatStorage.getMessages(chatId).then(saved => {
      if (saved?.length) {
        setMessages(saved);
        saved.forEach(m => { if (m.id) markSeen(m); });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  useEffect(() => {
    if (!chatId || !messages.length) return;
    // don't snapshot if only uploading messages exist
    const stable = messages.filter(m => !m.isUploading);
    if (!stable.length) return;
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

    socket.on('trackingStarted', (data) => {
      setMessages(prev => {
        const alreadyExists = prev.some(m => m.type === 'tracking');
        if (alreadyExists) return prev;

        return [...prev, {
          id: `tracking-${Date.now()}`,
          type: 'tracking',
          from: 'system',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          trackingData: {
            orderId: data.orderId || currentOrder?.orderId,
            runnerId: data.runnerId,
            status: 'en_route_to_delivery',
          }
        }];
      });
    });

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

    return () => {
      socket.off('trackingStarted');
      socket.off('orderCancelled');
    };
  }, [socket, currentOrder?.orderId]);

  useEffect(() => {
    const stageMap = {
      'Arrived at market': { stage: 1, progress: 20 },
      'Purchase in progress': { stage: 1, progress: 35 },
      'Purchase completed': { stage: 1, progress: 50 },
      'En route to delivery': { stage: 2, progress: 60 },
      'Arrived at delivery location': { stage: 3, progress: 80 },
      'Task completed': { stage: 4, progress: 100 },
      'Arrived at pickup location': { stage: 1, progress: 25 },
      'Item collected': { stage: 1, progress: 50 },
      'Item delivered': { stage: 3, progress: 80 },
    };

    const systemMsgs = messages.filter(m => m.type === 'system');
    console.log('[stageMap] all system messages:', systemMsgs.map(m => ({ id: m.id, text: m.text })));

    const lastSystemMsg = [...messages].reverse().find(m => m.type === 'system');
    console.log('[stageMap] lastSystemMsg:', lastSystemMsg?.text, lastSystemMsg?.id);
    console.log('[stageMap] lastProcessed:', lastProcessedSystemMsgRef.current);

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
          }
        }
        : m
    ));

    console.log('[stageMap] updated tracking message to stage:', match.stage, 'progress:', match.progress);
  }, [messages]);

  // socket calls
  useEffect(() => {
    if (!socket || !chatId) return;

    // ── Stable handlers — defined once, never redefined
    const handleChatHistory = (msgs) => {
      if (!msgs?.length) {
        setMessages([]);
        setTaskCompleted(false);
        setPaidChatIds(prev => { const n = new Set(prev); n.delete(chatId); return n; });
        return;
      }

      const formatted = msgs.map(msg => {
        markSeen(msg);
        return formatMessage(msg);
      });

      setMessages(prev => {
        // Start with server history as the source of truth
        const merged = [...formatted];

        // Preserve any messages that are still uploading — server doesn't know about them yet
        const stillUploading = prev.filter(m => m.isUploading === true);

        // Re-append uploading messages that aren't in the server history yet
        for (const up of stillUploading) {
          const alreadyInHistory = merged.some(m =>
            m.id === up.tempId ||
            m.tempId === up.tempId ||
            (up.fileUrl && m.fileUrl === up.fileUrl)
          );
          if (!alreadyInHistory) {
            merged.push(up);
          }
        }

        // Apply singleton dedup for types that should only appear once
        const singletonTypes = ['profile-card', 'payment_request', 'tracking'];
        const seen = new Set();
        const final = merged.filter(m => {
          if (!singletonTypes.includes(m.type)) return true;
          if (m.type === 'payment_request' && paidChatIdsRef.current.has(chatId)) return false;
          if (seen.has(m.type)) return false;
          seen.add(m.type);
          return true;
        });

        console.log('CHAT HISTORY FINAL MESSAGES:', final.map(m => ({ id: m.id, type: m.type, tempId: m.tempId })));

        const ids = final.map(m => m.id);
        const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
        if (duplicates.length) console.error('DUPLICATE IDS IN CHAT HISTORY:', duplicates);

        return final;

      });


      const hasPaid = msgs.some(m =>
        (m.type === 'system' && m.text?.toLowerCase().includes('made payment for this task')) ||
        m.paymentConfirmed === true
      );
      if (hasPaid) setPaidChatIds(prev => new Set(prev).add(chatId));

      const isCompleted = msgs.some(m =>
        m.type === 'task_completed' || m.messageType === 'task_completed' ||
        (m.type === 'system' && m.text?.toLowerCase().includes('task completed'))
      );
      setTaskCompleted(isCompleted);

      if (isCompleted) {
        chatStorage.clearMessages(chatId);
        chatStorage.clearActiveChat();
        chatStorage.clearRunnerData();
      }

      const cancelMsg = msgs.find(m =>
        m.type === 'system' && m.text?.toLowerCase().includes('cancelled this order')
      );
      if (cancelMsg) {
        setOrderCancelled(true);
        setCancelledByName(cancelMsg.text?.split(' ')[0] || 'Runner');
      }


    };

    const handleMessage = (msg) => {
      console.log('MESSAGE RECEIVED:', { id: msg.id, type: msg.type, tempId: msg.tempId, text: msg.text?.slice(0, 30) });

      const isSystem =
        msg.type === 'system' || msg.messageType === 'system' ||
        msg.senderType === 'system' || msg.senderId === 'system';

      if (!msg?.id && !isSystem) return;
      if (msg.type === 'fileUploadSuccess' || msg.messageType === 'fileUploadSuccess') return;

      const msgId = msg.id || `system-${msg.text}-${Date.now()}`;
      const normalizedMsg = { ...msg, id: msgId };

      // ── Dedup check BEFORE any state update ──────────────────────────────────
      if (isSeen(normalizedMsg)) {
        const isPaymentConfirmation = isSystem &&
          msg.text?.toLowerCase().includes('made payment for this task');
        if (!isPaymentConfirmation) return;
      }

      markSeen(normalizedMsg);

      // ── Side effects (keep as is) ──────────────────────────────────────────
      const isPaymentConfirmation = isSystem &&
        msg.text?.toLowerCase().includes('made payment for this task');
      if (isPaymentConfirmation) {
        setPaidChatIds(prev => new Set(prev).add(chatId));
        setCurrentOrder(prev => prev ? { ...prev, paymentStatus: 'paid', status: 'paid' } : prev);
      }

      if (isSystem && msg.text?.toLowerCase().includes('cancelled this order')) {
        setOrderCancelled(true);

        chatStorage.clearMessages(chatId);
        chatStorage.clearActiveChat();
        chatStorage.clearRunnerData();
        setCancelledByName(msg.text?.split(' ')[0] || 'Runner');
      }

      const isTaskDone = msg.type === 'task_completed' || msg.messageType === 'task_completed' ||
        (isSystem && msg.text?.toLowerCase().includes('task completed'));
      if (isTaskDone) {
        setTaskCompleted(true);

        chatStorage.clearMessages(chatId);
        chatStorage.clearActiveChat();
        chatStorage.clearRunnerData();
        const orderId = msg.orderId || currentOrderRef.current?.orderId;
        if (orderId && orderId !== 'undefined') {
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

      const isApprovalEcho = isSystem && (
        normalizedMsg.id?.includes('approval-user-') ||
        normalizedMsg.id?.includes('rejection-user-')
      );
      if (isApprovalEcho) return;

      setMessages(prev => {
        console.log('CURRENT MESSAGES IDs:', prev.map(m => m.id));
        console.log('TRYING TO ADD:', normalizedMsg.id);

        // Check if message with this ID already exists
        if (prev.some(m => m.id === normalizedMsg.id)) {
          console.warn('⚠️ Duplicate message blocked:', normalizedMsg.id);
          return prev;
        }

        // tempId match — replace optimistic message
        if (normalizedMsg.tempId) {
          const tmpIdx = prev.findIndex(
            m => m.id === normalizedMsg.tempId || m.tempId === normalizedMsg.tempId
          );
          if (tmpIdx !== -1) {
            replaceTempId(normalizedMsg.tempId, normalizedMsg.id);
            const next = [...prev];
            next[tmpIdx] = { ...formatMessage(normalizedMsg), isUploading: false, tempId: undefined };
            return next;
          }
        }

        // Already in list — update in place
        const existingIdx = prev.findIndex(m => m.id === normalizedMsg.id);
        if (existingIdx !== -1) {
          const next = [...prev];
          next[existingIdx] = { ...next[existingIdx], ...formatMessage(normalizedMsg), isUploading: false };
          return next;
        }

        return [...prev, formatMessage(normalizedMsg)];
      });
    };

    const handleMissedMessages = (msgs) => {
      if (!msgs?.length) return;
      setMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        const toAdd = msgs
          .filter(m => !existingIds.has(m.id) && !isSeen(m.id))
          .map(msg => {
            markSeen(msg);
            return formatMessage(msg);
          });
        return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
      });
    };

    const handleProceedToChat = (data) => {
      if (data.chatId === chatId && data.chatReady && !paidChatIds.has(chatId)) {
        doJoin();
      }
    };

    const handleReconnect = () => {
      // Preserve processed IDs across reconnect — DO NOT reset dedup
      setMessages(prev => {
        prev.forEach(m => { if (m.id) markSeen(m); });
        const hasPaidConfirm = prev.some(m =>
          m.type === 'system' && m.text?.toLowerCase().includes('made payment for this task')
        );
        if (hasPaidConfirm) setPaidChatIds(p => new Set(p).add(chatId));
        return prev;
      });
      // Allow rejoin but chatHistory will now MERGE not replace
      hasJoinedRef.current = false;
      socket.emit('rejoinUserRoom', { userId: userData?._id, userType: 'user' });
      socket.emit('rejoinChat', { chatId, userId: userData?._id, userType: 'user' });
    };

    // ── Single join function — emits to server, does NOT re-register listeners
    const doJoin = () => {
      if (hasJoinedRef.current) return;

      if (userData?._id) {
        socket.emit('userOffline', {
          userId: userData._id,
          userType: 'user',
          chatId,
        });
      }
      hasJoinedRef.current = true;

      const serviceType = currentOrderRef.current?.serviceType ||
        userData?.currentRequest?.serviceType || null;

      socket.emit('userJoinChat', {
        chatId,
        userId: userData?._id,
        runnerId: runner?._id,
        serviceType,
      });
    };

    // ── Register listeners exactly once
    socket.on('chatHistory', handleChatHistory);
    socket.on('message', handleMessage);
    socket.on('missedMessages', handleMissedMessages);
    socket.on('proceedToChat', handleProceedToChat);
    socket.on('connect', handleReconnect);

    // ── Initial join
    doJoin();

    if (userData?._id) {
      socket.emit('userOnline', {
        userId: userData._id,
        userType: 'user',
        chatId,
      });
    }

    // ── Cleanup — removes exactly the handlers we added
    return () => {
      socket.off('chatHistory', handleChatHistory);
      socket.off('message', handleMessage);
      socket.off('missedMessages', handleMissedMessages);
      socket.off('proceedToChat', handleProceedToChat);
      socket.off('connect', handleReconnect);
      hasJoinedRef.current = false;
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, chatId]);

  useEffect(() => {
    if (!socket) return;

    const onDeliveryConfirmed = ({ orderId }) => {
      setMessages(prev => prev.map(m =>
        m.type === 'delivery_confirmation_request' && m.orderId === orderId
          ? { ...m, confirmationStatus: 'confirmed' }
          : m
      ));
    };

    const onDeliveryDenied = ({ orderId }) => {
      setMessages(prev => prev.map(m =>
        m.type === 'delivery_confirmation_request' && m.orderId === orderId
          ? { ...m, confirmationStatus: 'denied' }
          : m
      ));
    };

    socket.on('deliveryConfirmed', onDeliveryConfirmed);
    socket.on('deliveryDenied', onDeliveryDenied);

    return () => {
      socket.off('deliveryConfirmed', onDeliveryConfirmed);
      socket.off('deliveryDenied', onDeliveryDenied);
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
      setCurrentOrder(prev => prev || { orderId: data.orderId });
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
  }, [onPromptRating, dispatch]);

  useEffect(() => {
    onOrderCreated((data) => {
      const newOrder = data.order;
      if (!newOrder?.orderId) return;

      setCurrentOrder(prev => {
        // Same order — no-op
        if (prev?.orderId === newOrder.orderId) return prev;
        return newOrder;
      });

      currentOrderRef.current = newOrder;

      if (newOrder?.paymentStatus === 'paid') {
        setPaidChatIds(prev => new Set(prev).add(chatId));
      }

      if (data?.order?.accountType === 'business' || userData?.accountType === 'business') {
        setTimeout(() => setShowTeamNotify(true), 1000);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onOrderCreated, chatId]);

  // useEffect(() => {
  //   if (!chatId) return;
  //   chatStorage.getDraft(chatId).then(draft => {
  //     if (draft) setText(draft);
  //   });
  // }, [chatId]);

  useEffect(() => {
    if (!chatId) return;

    dispatch(fetchOrderByChatId(chatId))
      .unwrap()
      .then((order) => {
        if (order) {
          setCurrentOrder(order);
          currentOrderRef.current = order; // sync ref immediately
          console.log('Order fetched on mount:', order.orderId);

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
              .catch(() => { });
          }
        }
      })
      .catch(() => {
        // No order yet — fine, onOrderCreated will set it when runner accepts
      });
  }, [chatId, dispatch]);

  useEffect(() => {
    onPaymentConfirmed((data) => {
      if (data.order) setCurrentOrder(prev => ({ ...prev, ...data.order }));
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

  const handleApprovePickupItem = (submissionId) => {
    if (!socket) return;
    setMessages(prev => prev.map(m =>
      m.submissionId === submissionId || m.id === submissionId
        ? { ...m, status: 'approved', rejectionReason: null }
        : m
    ));
    socket.emit('approvePickupItem', { chatId, submissionId, userId: userData?._id });
  };

  const handleRejectPickupItem = (submissionId, reason) => {
    if (!socket) return;
    setMessages(prev => prev.map(m =>
      m.submissionId === submissionId || m.id === submissionId
        ? { ...m, status: 'rejected', rejectionReason: reason }
        : m
    ));
    socket.emit('rejectPickupItem', { chatId, submissionId, reason, userId: userData?._id });
  };


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
    setPaystackModal(null);
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
    if (!socket) return;

    // Optimistic: immediately update the submission card so user sees it's approved
    setMessages(prev => prev.map(m =>
      m.submissionId === submissionId || m.id === submissionId
        ? { ...m, status: 'approved', rejectionReason: null }
        : m
    ));

    // Then tell backend (runner gets their message from server)
    socket.emit('approveItems', { chatId, submissionId, escrowId, userId: userData?._id });
  };

  const handleRejectItems = (submissionId, reason) => {
    if (!socket) return;

    // Optimistic update
    setMessages(prev => prev.map(m =>
      m.submissionId === submissionId || m.id === submissionId
        ? { ...m, status: 'rejected', rejectionReason: reason }
        : m
    ));

    socket.emit('rejectItems', { chatId, submissionId, reason, userId: userData?._id });
  };

  const handleConfirmDelivery = (orderId) => {
    if (socket) socket.emit('confirmDelivery', { chatId, orderId, userId: userData?._id });
  };

  const handleDenyDelivery = (orderId) => {
    if (socket) socket.emit('denyDelivery', { chatId, orderId, userId: userData?._id });
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
        status: socket?.connected ? "sent" : "queued",
        senderId: userData?._id, senderType: "user",
        ...(replyingTo && {
          replyTo: replyingTo.id,
          replyToMessage: replyingTo.text || replyingTo.fileName || "Media",
          replyToFrom: replyingTo.from,
        })
      };
      markSeen({ id: messageId });
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
        markSeen({ id: tempId, tempId });

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
        onSettings={() => { setShowMoreSheet(false); setShowSettings(true); }}
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

      {callState !== "idle" && callType === "voice" && (
        <CallScreen
          callState={callState} callType={callType} callerName={callerName}
          callerAvatar={callerAvatar} isMuted={isMuted} isCameraOff={isCameraOff}
          formattedDuration={formattedDuration} remoteUsers={remoteUsers}
          localVideoTrack={localVideoTrack} onAccept={acceptCall} onDecline={declineCall}
          onEnd={endCall} onToggleMute={toggleMute} onToggleCamera={toggleCamera}
        />
      )}

      {callState !== "idle" && callType === "video" && (
        <VideoCallScreen
          callState={callState}
          callType={callType} callerName={callerName} callerAvatar={callerAvatar}
          isMuted={isMuted} isCameraOff={isCameraOff} isSpeakerOn={isSpeakerOn}
          formattedDuration={formattedDuration} remoteUsers={remoteUsers}
          localVideoTrack={localVideoTrack} networkQuality={networkQuality}
          darkMode={darkMode} onAccept={acceptCall}
          onDecline={declineCall} onEnd={endCall} onToggleMute={toggleMute}
          onToggleCamera={toggleCamera} onSwitchCamera={switchCamera} onToggleSpeaker={toggleSpeaker}
        />
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
                // Check if payment confirmation system message has been received
                const hasPaymentConfirmation = messages.some(msg =>
                  msg.type === 'system' &&
                  msg.text?.toLowerCase().includes('made payment for this task')
                );

                const alreadyPaid = paidChatIds.has(chatId) || hasPaymentConfirmation;

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
                return (
                  <div key={m.id} className="my-4">
                    <DeliveryConfirmationMessage
                      message={m}
                      darkMode={darkMode}
                      onConfirm={handleConfirmDelivery}
                      onDeny={handleDenyDelivery}
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
                  markSeen({ id: tempId, tempId });

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