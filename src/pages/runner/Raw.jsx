/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { IconButton, Drawer } from "@material-tailwind/react";
import { Menu, MoreHorizontal, X, Sun, Moon } from "lucide-react";
import useDarkMode from "../../hooks/useDarkMode";
import { Modal } from "../../components/common/Modal";
import { useDispatch, useSelector } from "react-redux";
import { fetchNearbyUserRequests, clearNearbyUsers } from "../../Redux/userSlice";
import { updateProfile } from "../../Redux/runnerSlice";
import { useSocket } from "../../hooks/useSocket";
import RunnerChatScreen from "../../components/runnerScreens/RunnerChatScreen";
import OnboardingScreen from "../../components/runnerScreens/OnboardingScreen";
import Sidebar from "../../components/runnerScreens/Sidebar";
import PhoneVerificationPrompt from "../../components/common/PhoneVerificationPrompt";
import { Profile } from './Profile';
import { Wallet } from './Wallet';
import { Orders } from './Orders';
import { Payout } from './Payout';
import { usePushNotifications } from "../../hooks/usePushNotifications";
import { useCredentialFlow } from "../../hooks/useCredentialFlow";
import { useKycHook } from '../../hooks/useKycHook';
import { useCameraHook } from "../../hooks/useCameraHook";
import { useCallHook } from "../../hooks/useCallHook";
import TermsAcceptanceModal from '../../components/common/TermsAcceptanceModal';
import { RUNNER_TERMS } from '../../constants/terms';
import api from '../../utils/api';
import { fetchOrderByChatId } from '../../Redux/orderSlice';

// ─── Initial bot messages ────────────────────────────────────────────────────
const INITIAL_BOT_MESSAGES = [
  { id: 1, from: "them", text: "Welcome!", time: "12:24 PM", status: "read" },
  { id: 2, from: "them", text: "Hi! I'm Sendrey Assistant 👋 ", time: "12:25 PM", status: "delivered" },
  { id: 3, from: "them", text: "Would you like like to run a pickup or run an errand?", time: "12:25 PM", status: "delivered" },
];

const BOT_CHAT_ID = 'sendrey-bot';

// ─── ChatStateManager ────────────────────────────────────────────────────────
// Plain class — fast, zero re-render overhead for storage.
// React state in each screen component handles rendering.
// This is purely persistence / source of truth between switches.
class ChatStateManager {
  constructor() {
    this._states = new Map();
  }

  get(chatId) {
    if (!this._states.has(chatId)) {
      this._states.set(chatId, {
        messages: [],
        draft: '',
        replyingTo: null,
        completedOrderStatuses: [],
        taskCompleted: false,
        orderCancelled: false,
        cancellationReason: null,
        currentOrder: null,
        specialInstructions: null,
        deliveryMarked: false,
        userConfirmedDelivery: false,
      });
    }
    const state = this._states.get(chatId);
    // Guard: ensure completedOrderStatuses is always an array
    if (!Array.isArray(state.completedOrderStatuses)) {
      state.completedOrderStatuses = [];
    }

    return state;
  }

  set(chatId, updates) {
    const current = this.get(chatId);
    this._states.set(chatId, { ...current, ...updates });
  }

  // Functional updater support — mirrors React setState
  update(chatId, updaterOrObject) {
    if (typeof updaterOrObject === 'function') {
      const current = this.get(chatId);
      const next = updaterOrObject(current);
      this._states.set(chatId, { ...current, ...next });
    } else {
      this.set(chatId, updaterOrObject);
    }
  }

  // Functional message updater — mirrors setState(prev => ...)
  updateMessages(chatId, updater) {
    const current = this.get(chatId);
    const nextMessages = typeof updater === 'function'
      ? updater(current.messages)
      : updater;
    this._states.set(chatId, { ...current, messages: nextMessages });
    return nextMessages;
  }

  delete(chatId) {
    this._states.delete(chatId);
  }
}

// ─── HeaderIcon ──────────────────────────────────────────────────────────────
const HeaderIcon = ({ children, onClick }) => (
  <IconButton variant="text" size="sm" className="rounded-full" onClick={onClick}>
    {children}
  </IconButton>
);

// ─── Main component ──────────────────────────────────────────────────────────
export default function WhatsAppLikeChat() {
  const [dark, setDark] = useDarkMode();

  const BOT_CHAT_ENTRY = {
    id: BOT_CHAT_ID,
    name: 'Sendrey Assistant',
    lastMessage: 'Welcome! Pick a service to get started.',
    time: '',
    online: true,
    avatar: null,
    isBot: true,
    unread: 0,
  };

  // ── UI state ────────────────────────────────────────────────────────────────
  const [chatHistory, setChatHistory] = useState([BOT_CHAT_ENTRY]);
  const [active, setActive] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [activeModal, setActiveModal] = useState(null);
  const [currentView, setCurrentView] = useState('chat');
  const [showOrderFlow, setShowOrderFlow] = useState(false);
  const [isAttachFlowOpen, setIsAttachFlowOpen] = useState(false);
  const [isLoadingArchive, setIsLoadingArchive] = useState(false);

  const [, setCompletedStatusesVersion] = useState(0);

  // ── Runner identity ─────────────────────────────────────────────────────────
  const [runnerId, setRunnerId] = useState(null);
  const runnerIdRef = useRef(null);
  const [runnerLocation, setRunnerLocation] = useState(null);

  // ── Chat routing state ──────────────────────────────────────────────────────
  // activeChatId drives which screen is shown and which manager slot is active.
  // 'sendrey-bot' = onboarding screen. Any other value = RunnerChatScreen.
  const [activeChatId, setActiveChatId] = useState(BOT_CHAT_ID);
  const [selectedUser, setSelectedUser] = useState(null);

  // ── Global state that the current chat screen reads from the manager ─────────
  // Each child screen manages its own copy from the manager.
  const [serviceType, setServiceType] = useState(null);

  // ── Misc state ──────────────────────────────────────────────────────────────
  const [initialMessagesComplete, setInitialMessagesComplete] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [canShowNotifications, setCanShowNotifications] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [verificationState, setVerificationState] = useState(null);
  const [showBannedModal, setShowBannedModal] = useState(false);
  const [newOrderTrigger, setNewOrderTrigger] = useState(0);
  const [canResendOtp, setCanResendOtp] = useState(false);

  // ── Refs ────────────────────────────────────────────────────────────────────
  const manager = useRef(new ChatStateManager()).current;
  const serviceTypeRef = useRef(null);
  const fleetTypeRef = useRef(null);
  const currentOrderRef = useRef(null);
  const selectedUserRef = useRef(null);
  const activeChatIdRef = useRef(BOT_CHAT_ID);
  const kycStartedRef = useRef(false);
  const searchIntervalRef = useRef(null);
  // Each child screen registers its setMessages here so raw.jsx can push
  // messages into the currently visible screen from socket handlers.
  const activeSetMessagesRef = useRef(null);


  const dispatch = useDispatch();
  const { nearbyUsers } = useSelector((state) => state.users);
  const { runner, token } = useSelector((s) => s.auth);

  // ── Keep activeChatIdRef in sync ────────────────────────────────────────────
  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);

  useEffect(() => { runnerIdRef.current = runnerId; }, [runnerId]);


  // ── Hooks ───────────────────────────────────────────────────────────────────
  const {
    socket, joinRunnerRoom, sendMessage, isConnected,
    uploadFileWithProgress, onSpecialInstructions, onOrderCreated,
    onPaymentSuccess, onDeliveryConfirmed, onMessageDeleted,
  } = useSocket();

  const {
    isCollectingCredentials, credentialStep, credentialQuestions,
    startCredentialFlow, needsOtpVerification, handleCredentialAnswer,
    registrationComplete, handleOtpVerification, runnerData,
  } = useCredentialFlow(serviceTypeRef, (rd) => {
    setRunnerId(rd._id || rd.id);
  });

  const {
    kycStep, kycStatus, startKycFlow, onIdVerified,
    handleSelfieResponse, handleIDTypeSelection, onSelfieVerified,
    checkVerificationStatus,
  } = useKycHook(runnerId, runnerData?.fleetType);

  const handleSelfieResponseRef = useRef(handleSelfieResponse);
  useEffect(() => { handleSelfieResponseRef.current = handleSelfieResponse; }, [handleSelfieResponse]);

  const { permission } = usePushNotifications({ userId: runnerId, userType: 'runner', socket });

  const {
    cameraOpen, capturedImage, videoRef, openCamera, closeCamera,
    capturePhoto, retakePhoto, setIsPreviewOpen, isPreviewOpen,
    closePreview, openPreview, switchCamera, facingMode,
  } = useCameraHook();

  const {
    callState, callType, isMuted, isCameraOff, formattedDuration,
    remoteUsers, localVideoTrack, initiateCall, acceptCall, declineCall,
    endCall, toggleMute, toggleCamera, isSpeakerOn, networkQuality,
    toggleSpeaker, switchCamera: switchCallCamera,
  } = useCallHook({
    socket,
    chatId: selectedUser?._id ? `user-${selectedUser._id}-runner-${runnerId}` : null,
    currentUserId: runnerId,
    currentUserType: "runner",
  });

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const isBotMode = activeChatId === BOT_CHAT_ID;

  // Push messages into the currently visible child screen.
  // Supports both full arrays and functional updaters.
  const pushToActiveScreen = useCallback((updater) => {
    if (!activeSetMessagesRef.current) return;
    activeSetMessagesRef.current(updater);
  }, []);

  const botMessagesUpdater = useCallback((updater) => {
    const next = manager.updateMessages(BOT_CHAT_ID, updater);
    if (activeChatIdRef.current === BOT_CHAT_ID && activeSetMessagesRef.current) {
      activeSetMessagesRef.current(next);
    }
  }, []);

  const chatMessagesUpdater = useCallback((updater) => {
    const chatId = activeChatIdRef.current;
    const next = manager.updateMessages(chatId, updater);
    if (activeSetMessagesRef.current) {
      activeSetMessagesRef.current(next);
    }
  }, []);

  const registerSetMessages = useCallback((fn) => {
    activeSetMessagesRef.current = fn;
  }, []);

  // ── KYC nudge timer ref ──────────────────────────────────────────────────────
  const kycNudgeTimerRef = useRef(null);
  const KYC_NUDGE_INTERVAL = 2 * 24 * 60 * 60 * 1000;

  // ── Terms acceptance ────────────────────────────────────────────────────────
  const handleAcceptTerms = async () => {
    try {
      await api.post('/terms/accept', { version: RUNNER_TERMS.version, userType: 'runner' });
      localStorage.setItem(`terms_accepted_${runnerId}`, 'true');
      setShowTerms(false);
      startKycFlow(botMessagesUpdater);
    } catch (error) {
      console.error('Failed to save terms acceptance:', error);
    }
  };

  // ── Switch to bot screen ─────────────────────────────────────────────────────
  const handleBotClick = useCallback(() => {
    setActiveChatId(BOT_CHAT_ID);
    setSelectedUser(null);
    setActive({ id: BOT_CHAT_ID, isBot: true });
    selectedUserRef.current = null;

    // Ensure bot has at least initial messages
    const botState = manager.get(BOT_CHAT_ID);
    if (botState.messages.length === 0) {
      manager.set(BOT_CHAT_ID, { messages: [...INITIAL_BOT_MESSAGES] });
    }
  }, [manager]);

  // ── Switch to a user chat ────────────────────────────────────────────────────
  const handleUserClick = useCallback(async (chatEntry) => {
    if (chatEntry.isBot) {
      handleBotClick();
      return;
    }

    const chatId = `user-${chatEntry.userId}-runner-${runnerId}`;
    const fullUser = {
      ...chatEntry,
      firstName: chatEntry.firstName || chatEntry.name?.split(' ')[0] || chatEntry.name,
      lastName: chatEntry.lastName || chatEntry.name?.split(' ').slice(1).join(' ') || '',
      _id: chatEntry.userId,
    };

    selectedUserRef.current = fullUser;
    setSelectedUser(fullUser);
    setActive(chatEntry);
    setActiveChatId(chatId);

    // Mark unread as 0
    setChatHistory(prev => prev.map(c => c.id === chatEntry.userId ? { ...c, unread: 0 } : c));

    // If completed order with no cached messages, request archive from server
    const savedState = manager.get(chatId);
    const isTerminalOrder = ['task_completed', 'completed', 'cancelled']
      .includes(savedState.currentOrder?.status);

    if (isTerminalOrder && savedState.messages.length === 0 && socket && isConnected) {
      setIsLoadingArchive(true);
      socket.emit('getArchivedMessages', { chatId, userId: chatEntry.userId, runnerId });

      const handleArchive = (data) => {
        if (data.chatId !== chatId) return;
        socket.off('archivedMessages', handleArchive);
        const formatted = (data.messages || []).map(msg => ({
          ...msg,
          from: msg.senderId === runnerId ? 'me'
            : (msg.from === 'system' || msg.type === 'system' || msg.senderType === 'system') ? 'system'
              : 'them',
          type: msg.type || msg.messageType || 'text',
        }));
        manager.set(chatId, { messages: formatted });
        // Push to screen if still on this chat
        if (activeChatIdRef.current === chatId && activeSetMessagesRef.current) {
          activeSetMessagesRef.current(formatted);
        }
        setIsLoadingArchive(false);
      };

      socket.on('archivedMessages', handleArchive);
      setTimeout(() => {
        socket.off('archivedMessages', handleArchive);
        setIsLoadingArchive(false);
      }, 8000);
    }
  }, [runnerId, socket, isConnected, manager, handleBotClick]);

  // ── KYC started effect ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!registrationComplete || !runnerId) return;
    if (kycStartedRef.current) return;

    const timer = setTimeout(() => {
      kycStartedRef.current = true;
      const alreadyAccepted = localStorage.getItem(`terms_accepted_${runnerId}`);
      if (!alreadyAccepted) {
        setShowTerms(true);
      } else {
        startKycFlow(botMessagesUpdater);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [registrationComplete, runnerId, startKycFlow, botMessagesUpdater]);

  // ── KYC nudge ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!registrationComplete || !runnerId) return;
    if (kycStatus.selfieVerified) return;
    if (kycStep === 3 || kycStep === 5) return;

    const lastNudge = localStorage.getItem(`kyc_nudge_${runnerId}`);
    const now = Date.now();
    const timeUntilNext = lastNudge
      ? Math.max(0, parseInt(lastNudge) + KYC_NUDGE_INTERVAL - now)
      : KYC_NUDGE_INTERVAL;

    kycNudgeTimerRef.current = setTimeout(() => {
      if (kycStatus.selfieVerified) return;
      const nudgeMessage = {
        id: `kyc-nudge-${Date.now()}`,
        from: 'them',
        text: `Hi${runnerData?.firstName ? ` ${runnerData.firstName}` : ''}, complete your KYC now and gain access to endless tasks. Take your selfie now to verify your identity, this would only take a minute 📸`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'delivered',
        isKyc: true,
      };
      botMessagesUpdater(prev => [...prev, nudgeMessage]);

      if (permission === 'granted') {
        new Notification('Complete your KYC 📸', {
          body: `Hi${runnerData?.firstName ? ` ${runnerData.firstName}` : ''}! Take your selfie to unlock unlimited tasks.`,
          icon: '/favicon.ico',
        });
      }
      localStorage.setItem(`kyc_nudge_${runnerId}`, Date.now().toString());
    }, timeUntilNext);

    return () => { if (kycNudgeTimerRef.current) clearTimeout(kycNudgeTimerRef.current); };
  }, [registrationComplete, runnerId, kycStatus.selfieVerified, kycStep, permission, runnerData?.firstName, botMessagesUpdater]);

  // ── Fleet type sync ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (runnerData?.fleetType) fleetTypeRef.current = runnerData.fleetType;
  }, [runnerData?.fleetType]);

  // ── Initial bot messages (typed in one by one on first load) ─────────────────
  useEffect(() => {
    const botState = manager.get(BOT_CHAT_ID);
    if (botState.messages.length > 0) return; // already has messages, don't re-run

    const t1 = setTimeout(() => {
      if (activeChatIdRef.current !== BOT_CHAT_ID) return;
      const s = manager.get(BOT_CHAT_ID);
      if (s.messages.length === 0) {
        botMessagesUpdater([INITIAL_BOT_MESSAGES[0]]);
      }
    }, 0);

    const t2 = setTimeout(() => {
      if (activeChatIdRef.current !== BOT_CHAT_ID) return;
      const s = manager.get(BOT_CHAT_ID);
      if (s.messages.length === 1) {
        botMessagesUpdater([...s.messages, INITIAL_BOT_MESSAGES[1]]);
      }
    }, 700);

    const t3 = setTimeout(() => {
      if (activeChatIdRef.current !== BOT_CHAT_ID) return;
      const s = manager.get(BOT_CHAT_ID);
      if (s.messages.length === 2) {
        botMessagesUpdater([...s.messages, INITIAL_BOT_MESSAGES[2]]);
      }
      setTimeout(() => setInitialMessagesComplete(true), 600);
    }, 990);

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []); // run once only

  // ── canShowNotifications ─────────────────────────────────────────────────────
  useEffect(() => {
    if (kycStep === 6 && registrationComplete && isBotMode) {
      setCanShowNotifications(true);
    } else if (!isBotMode) {
      setCanShowNotifications(false);
    }
  }, [kycStep, registrationComplete, isBotMode]);

  // ── OTP resend cooldown ──────────────────────────────────────────────────────
  useEffect(() => {
    if (needsOtpVerification) {
      setCanResendOtp(false);
      const timer = setTimeout(() => setCanResendOtp(true), 15000);
      return () => clearTimeout(timer);
    }
  }, [needsOtpVerification]);

  // ── Socket: payment / order / task events ────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const onPayment = (data) => {
      const chatId = activeChatIdRef.current;
      const updated = {
        ...(currentOrderRef.current || {}),
        escrowId: data.escrowId,
        orderId: data.orderId || currentOrderRef.current?.orderId,
        paymentStatus: 'paid',
        status: 'active',
      };
      currentOrderRef.current = updated;
      manager.set(chatId, { currentOrder: updated });
      if (selectedUserRef.current?._id) {
        try { localStorage.setItem(`currentOrder_${runnerId}`, JSON.stringify(updated)); } catch (e) { }
      }
      // Signal currently visible screen to re-read its order
      pushToActiveScreen(prev => prev); // no-op to trigger re-render via setMessages
    };

    const onOrder = (data) => {
      const order = data.order || data;
      if (!order?.orderId) return;
      const chatId = activeChatIdRef.current;
      const prev = manager.get(chatId).currentOrder;
      const merged = (!prev || prev.orderId !== order.orderId) ? order : { ...prev, ...order };
      currentOrderRef.current = merged;
      manager.set(chatId, { currentOrder: merged });
    };

    const onTaskCompleted = () => {
      const chatId = activeChatIdRef.current;
      manager.set(chatId, { taskCompleted: true });
      localStorage.removeItem(`currentOrder_${runnerId}`);
    };

    const onOrderCancelled = (data) => {
      const chatId = activeChatIdRef.current;
      const prev = currentOrderRef.current;
      const updated = prev ? { ...prev, status: 'cancelled' } : null;
      currentOrderRef.current = updated;
      manager.set(chatId, {
        orderCancelled: true,
        cancellationReason: data.cancelledBy,
        currentOrder: updated,
      });
    };

    socket.on('paymentSuccess', onPayment);
    socket.on('orderCreated', onOrder);
    socket.on('task_completed', onTaskCompleted);
    socket.on('orderCancelled', onOrderCancelled);

    return () => {
      socket.off('paymentSuccess', onPayment);
      socket.off('orderCreated', onOrder);
      socket.off('task_completed', onTaskCompleted);
      socket.off('orderCancelled', onOrderCancelled);
    };
  }, [socket, runnerId, manager, pushToActiveScreen]);

  // ── Socket: chatHistory from server ──────────────────────────────────────────
  useEffect(() => {
    if (!selectedUser || !socket || !isConnected || selectedUser.isBot) return;

    const chatId = `user-${selectedUser._id}-runner-${runnerId}`;

    const handleChatHistory = async (msgs) => {
      let latestOrder = null;
      try {
        const result = await dispatch(fetchOrderByChatId(chatId)).unwrap();
        if (result) {
          latestOrder = result?.data ?? result;
          currentOrderRef.current = latestOrder;
          manager.set(chatId, { currentOrder: latestOrder });
        }
      } catch (_) { }

      if (!msgs?.length) return;

      const isTerminalOrder = ['completed', 'cancelled', 'task_completed'].includes(latestOrder?.status)
        || msgs.some(m => m.type === 'system' && m.text?.toLowerCase().includes('task completed'));

      const seenPayment = new Set();
      const filtered = msgs.filter(msg => {
        if (isTerminalOrder) {
          if (msg.type === 'system' && msg.text?.includes('joined the chat')) return false;
          if (msg.type === 'payment_request' || msg.messageType === 'payment_request') return false;
        }
        const isPay = (msg.type === 'system' && msg.text?.toLowerCase().includes('made payment for this task'))
          || msg.paymentConfirmed === true || msg.type === 'payment_confirmed';
        if (isPay) {
          const key = msg.text || 'payment';
          if (seenPayment.has(key)) return false;
          seenPayment.add(key);
        }
        return true;
      });

      const formatted = filtered.map(msg => {
        const isSystem = msg.from === 'system' || msg.type === 'system'
          || msg.messageType === 'system' || msg.senderType === 'system' || msg.senderId === 'system';
        return {
          ...msg,
          from: isSystem ? 'system' : (msg.senderId === runnerId ? 'me' : 'them'),
          type: msg.type || msg.messageType || 'text',
        };
      });

      // Only overwrite if we're still on this chat (don't blast another chat's screen)
      if (activeChatIdRef.current === chatId) {
        manager.set(chatId, { messages: formatted });
        if (activeSetMessagesRef.current) activeSetMessagesRef.current(formatted);
      } else {
        // Store silently for when runner switches back
        manager.set(chatId, { messages: formatted });
      }

      // Restore derived state
      const isCompleted = formatted.some(m =>
        m.type === 'task_completed' || m.messageType === 'task_completed'
        || (m.type === 'system' && m.text?.toLowerCase().includes('task completed'))
      );
      if (isCompleted) manager.set(chatId, { taskCompleted: true });

      const cancelMsg = formatted.find(m =>
        m.type === 'system' && m.text?.toLowerCase().includes('cancelled this order')
      );
      if (cancelMsg) {
        manager.set(chatId, {
          orderCancelled: true,
          cancellationReason: cancelMsg.text?.split(' ')[0] || 'Runner',
        });
      }

      if (formatted.some(m =>
        (m.type === 'system' && m.text?.toLowerCase().includes('made payment for this task'))
        || m.paymentConfirmed === true
      ) && latestOrder) {
        const updated = { ...latestOrder, paymentStatus: 'paid' };
        currentOrderRef.current = updated;
        manager.set(chatId, { currentOrder: updated });
      }
    };

    socket.on('chatHistory', handleChatHistory);
    socket.emit('runnerJoinChat', { runnerId, userId: selectedUser._id, chatId });

    return () => { socket.off('chatHistory', handleChatHistory); };
  }, [selectedUser?._id, socket, isConnected, runnerId, dispatch, manager]);

  // ── Runner room join ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!registrationComplete || !runnerId || !serviceTypeRef.current || !socket) return;
    joinRunnerRoom(runnerId, serviceTypeRef.current);
  }, [registrationComplete, runnerId, socket, joinRunnerRoom]);

  useEffect(() => {
    if (socket && runnerId && registrationComplete) {
      socket.emit('rejoinUserRoom', { userId: runnerId, userType: 'runner' });
    }
  }, [socket, runnerId, registrationComplete]);

  // ── Verification status ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !runnerId) return;
    const handler = (data) => {
      setVerificationState(data);
      if (data.isBanned) setShowBannedModal(true);
    };
    socket.on('verificationStatus', handler);
    return () => socket.off('verificationStatus', handler);
  }, [socket, runnerId]);

  // ── Body scroll lock ─────────────────────────────────────────────────────────
  useEffect(() => {
    document.body.style.overflow = (drawerOpen || infoOpen) ? "hidden" : "";
  }, [drawerOpen, infoOpen]);

  // ── Geolocation ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!registrationComplete) return;
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setRunnerLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        () => setRunnerLocation({ latitude: 6.5244, longitude: 3.3792 })
      );
    } else {
      setRunnerLocation({ latitude: 6.5244, longitude: 3.3792 });
    }
  }, [registrationComplete]);

  // ── Message handlers (bot screen) ────────────────────────────────────────────

  const handleResendOtp = useCallback(() => {
    if (!canResendOtp) return;
    const updater = botMessagesUpdater;
    const msg1 = {
      id: Date.now(), from: "them",
      text: "We have sent you a new OTP",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "delivered",
    };
    updater(prev => [...prev, msg1]);

    setTimeout(() => {
      const msg2 = {
        id: Date.now() + 1, from: "them",
        text: `Enter the OTP we sent to ${runnerData?.phone}, \n \nDidn't receive OTP? Resend`,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "delivered", hasResendLink: true,
      };
      updater(prev => [...prev, msg2]);
    }, 1200);

    setCanResendOtp(false);
    setTimeout(() => setCanResendOtp(true), 40000);
  }, [canResendOtp, runnerData?.phone, botMessagesUpdater]);

  const handleMessageClick = useCallback((message) => {
    if (message.hasResendLink && canResendOtp) { handleResendOtp(); return; }
    if (message.selfieChoice) {
      handleSelfieResponseRef.current(message.selfieChoice, botMessagesUpdater);
      if (message.selfieChoice === 'okay') openCamera();
    }
  }, [canResendOtp, handleResendOtp, openCamera]);

  const pickUp = useCallback(() => {
    serviceTypeRef.current = "pick-up";
    setServiceType("pick-up");
    const updater = botMessagesUpdater;
    updater(prev => [...prev, {
      id: Date.now().toString(), from: "me", text: 'Pick Up',
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "sent", isCredential: true,
    }]);
    setTimeout(() => startCredentialFlow('pick-up', updater), 1000);
  }, [startCredentialFlow, botMessagesUpdater]);

  const runErrand = useCallback(() => {
    serviceTypeRef.current = "run-errand";
    setServiceType("run-errand");
    const updater = botMessagesUpdater;
    updater(prev => [...prev, {
      id: Date.now().toString(), from: "me", text: 'Run Errand',
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "sent", isCredential: true,
    }]);
    setTimeout(() => startCredentialFlow('run-errand', updater), 1000);
  }, [startCredentialFlow, botMessagesUpdater]);

  // ── send() — works for both bot (credential flow) and chat screens ───────────
  const send = useCallback((replyingTo = null) => { // eslint-disable-line no-unused-vars
    const currentText = manager.get(activeChatIdRef.current).draft || ''; // eslint-disable-line no-unused-vars
    // text state is owned by each child, passed up via onDraftChange
    // We read from manager draft so this stays in sync
    // Actually: text is still React state here, children call onDraftChange
    // This is handled below — children pass text up via a dedicated prop
    // For now we keep the pattern: children pass text as prop, raw.jsx holds it
  }, [manager]);

  // text is still held in raw.jsx state to avoid threading issues
  const [text, setText] = useState("");

  const sendMessage_fn = useCallback((replyingTo = null) => {
    if (!text.trim()) return;
    const currentRunnerId = runnerIdRef.current; // ← read from ref
    if (needsOtpVerification) {
      botMessagesUpdater(prev => [...prev, {
        id: Date.now(), from: "me", text: text.trim(),
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "sent",
      }]);
      handleOtpVerification(text.trim(), botMessagesUpdater);
      setText("");
    } else if (isCollectingCredentials && credentialStep !== null) {
      handleCredentialAnswer(text.trim(), setText, botMessagesUpdater);
    } else if (!isBotMode && selectedUser) {
      const chatId = `user-${selectedUser._id}-runner-${currentRunnerId}`; // ← ref
      const newMsg = {
        id: Date.now().toString(), from: "me", type: "text",
        text: text.trim(),
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "sent", senderId: currentRunnerId, senderType: "runner", // ← ref
        ...(replyingTo && {
          replyTo: replyingTo.id,
          replyToMessage: replyingTo.text || replyingTo.fileName || "Media",
          replyToFrom: replyingTo.from,
        }),
      };
      chatMessagesUpdater(prev => [...prev, newMsg]);
      setText("");
      if (socket) {
        sendMessage(chatId, newMsg);
        setChatHistory(prev => prev.map(c =>
          c.id === selectedUser._id
            ? { ...c, lastMessage: text.trim().substring(0, 30), time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }
            : c
        ));
      }
    }
  }, [text, needsOtpVerification, isCollectingCredentials, credentialStep,
    isBotMode, socket, selectedUser, handleOtpVerification,
    handleCredentialAnswer, sendMessage, botMessagesUpdater, chatMessagesUpdater]);

  // ── Connect to service ────────────────────────────────────────────────────────
  const handleConnectToService = useCallback(async () => {
    if (!runnerLocation || !serviceTypeRef.current) return;
    dispatch(clearNearbyUsers());
    setHasSearched(false);

    const searchParams = {
      latitude: runnerLocation.latitude,
      longitude: runnerLocation.longitude,
      serviceType: serviceTypeRef.current,
      fleetType: fleetTypeRef.current || runnerData?.fleetType,
    };

    const searching = {
      id: `searching-${Date.now()}`, from: "them", text: "Connecting....",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "delivered",
    };
    botMessagesUpdater(prev => [...prev, searching]);

    try {
      await dispatch(fetchNearbyUserRequests(searchParams)).unwrap();
      setHasSearched(true);
      botMessagesUpdater(prev => prev.filter(m => m.id !== searching.id));
    } catch (error) {
      botMessagesUpdater(prev => prev.filter(m => m.id !== searching.id));

      if (error.canAccept === false) {
        botMessagesUpdater(prev => [...prev, {
          id: `verification-error-${Date.now()}`, from: "them", text: error.reason,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          status: "delivered", isKyc: true, verificationError: true,
          verificationStatus: { status: error.status, dailyCount: error.dailyCount, maxDaily: error.maxDaily, resetIn: error.resetIn },
        }]);
        setVerificationState({ canAccept: false, ...error });
        if (error.isBanned) setShowBannedModal(true);
      } else {
        botMessagesUpdater(prev => [...prev, {
          id: `error-${Date.now()}`, from: "them",
          text: error.message || "Couldn't find any runners nearby. Please try again.",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          status: "delivered",
        }]);
      }
    }
  }, [dispatch, runnerLocation, runnerData?.fleetType, botMessagesUpdater])

  // ── Start new order ───────────────────────────────────────────────────────────
  const handleStartNewOrder = useCallback(() => {
    const currentSelectedUser = selectedUserRef.current
    const currentRunnerId = runnerIdRef.current;

    if (!isBotMode && currentSelectedUser?._id) {
      const prevChatId = `user-${currentSelectedUser._id}-runner-${currentRunnerId}`;
      manager.delete(prevChatId);
      try { localStorage.removeItem(`currentOrder_${currentRunnerId}`); } catch { }
      const currentOrder = manager.get(prevChatId)?.currentOrder;
      if (socket && currentOrder?.orderId) {
        socket.emit('runnerStartedNewOrder', { runnerId: currentRunnerId, previousOrderId: currentOrder.orderId });
      }
    }

    setVerificationState(null);
    currentOrderRef.current = null;

    setTimeout(() => {
      handleBotClick();
      setNewOrderTrigger(t => t + 1);
    }, 0);
  }, [isBotMode, socket, manager, handleBotClick]);

  // ── Back to home (from completed/cancelled chat) ──────────────────────────────
  const handleBackToHome = useCallback(() => {
    handleBotClick();
  }, [handleBotClick]);

  const setBotReplyingTo = useCallback((r) => {
    manager.set(BOT_CHAT_ID, { replyingTo: r });
  }, []);

  const handleFindMore = useCallback(() => {
    dispatch(fetchNearbyUserRequests({
      latitude: runnerLocation?.latitude,
      longitude: runnerLocation?.longitude,
      serviceType: serviceTypeRef.current,
      fleetType: runnerData?.fleetType,
    }));
  }, [dispatch, runnerLocation, runnerData?.fleetType]);

  const handleNewOrderFleetAndServiceSelected = useCallback((newServiceType, newFleetType) => {
    const currentRunnerId = runnerIdRef.current;
    serviceTypeRef.current = newServiceType;
    fleetTypeRef.current = newFleetType;
    setServiceType(newServiceType);
    if (runnerId && socket) joinRunnerRoom(currentRunnerId, newServiceType);
    dispatch(updateProfile({ fleetType: newFleetType }));
  }, [socket, joinRunnerRoom, dispatch, runnerId]);

  // ── Pick service from notifications ──────────────────────────────────────────
  // REPLACE the handlePickService function in WhatsAppLikeChat with this:

  const handlePickService = useCallback(async (user, specialInstructions = null) => {
    const currentRunnerId = runnerIdRef.current;

    // Clear state BEFORE setting new
    dispatch(clearNearbyUsers());
    setHasSearched(false);

    if (searchIntervalRef.current) clearInterval(searchIntervalRef.current);

    const chatId = `user-${user._id}-runner-${currentRunnerId}`;
    const fullUser = {
      ...user,
      specialInstructions: specialInstructions ?? user.currentRequest?.specialInstructions ?? null,
    };

    // Reset this chat's state
    manager.set(chatId, {
      messages: [],
      completedOrderStatuses: [],
      taskCompleted: false,
      orderCancelled: false,
      cancellationReason: null,
      currentOrder: null,
      deliveryMarked: false,
      userConfirmedDelivery: false,
      specialInstructions: specialInstructions ?? user.currentRequest?.specialInstructions ?? null,
    });

    if (socket && isConnected) {
      socket.emit('runnerJoinChat', { currentRunnerId, userId: user._id, chatId });
    }

    // Use setTimeout to batch state updates
    setTimeout(() => {
      selectedUserRef.current = fullUser;
      setSelectedUser(fullUser);
      setActiveChatId(chatId);

      const newChatEntry = {
        id: user._id,
        name: `${user.firstName} ${user.lastName || ''}`.trim(),
        lastMessage: '',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        online: true,
        avatar: user.profilePicture || user.avatar || null,
        userId: user._id,
        serviceType: user.serviceType,
        unread: 0,
      };

      setChatHistory(prev => {
        if (prev.find(c => c.id === user._id)) return prev;
        return [newChatEntry, ...prev];
      });
      setActive(newChatEntry);
    }, 0);
  }, [dispatch, socket, isConnected, manager]);

  // ── Order status click ───────────────────────────────────────────────────────
  const handleOrderStatusClick = useCallback((statusKey) => {
    if (!selectedUser?._id) return;
    const chatId = `user-${selectedUser._id}-runner-${runnerId}`;
    const current = manager.get(chatId);
    const next = Array.isArray(current.completedOrderStatuses) && current.completedOrderStatuses.includes(statusKey)
      ? current.completedOrderStatuses
      : [...(Array.isArray(current.completedOrderStatuses) ? current.completedOrderStatuses : []), statusKey];
    manager.set(chatId, { completedOrderStatuses: next });
    setCompletedStatusesVersion(v => v + 1); // trigger re-render

    if (statusKey === "en_route_to_delivery" && socket && isConnected) {
      socket.emit("startTrackRunner", { chatId, runnerId, userId: selectedUser._id });
    }
  }, [selectedUser, runnerId, socket, isConnected, manager]);

  const handleLocationClick = () => setShowOrderFlow(true);
  const handleAttachClick = () => setIsAttachFlowOpen(true);

  // ── Derived ───────────────────────────────────────────────────────────────────
  const currentChatState = manager.get(activeChatId);
  const isConnectLocked = (() => {
    // Check every chat slot in the manager for any active non-terminal order
    for (const [, state] of manager._states) {
      const o = state.currentOrder;
      if (!o) continue;
      const isTerminal = ['completed', 'cancelled', 'task_completed'].includes(o.status);
      if (!isTerminal) return true;
    }
    return false;
  })();

  // ── Render ────────────────────────────────────────────────────────────────────
  const renderMainScreen = () => {
    if (runner && token && !runner.isPhoneVerified) {
      return <PhoneVerificationPrompt user={runner} darkMode={dark} toggleDarkMode={() => setDark(!dark)} />;
    }

    if (isBotMode) {
      const botState = manager.get(BOT_CHAT_ID);
      return (
        <OnboardingScreen
          key="sendrey-bot"
          // ── Message persistence: pass from manager, child owns its own useState
          // initialized from this, and calls onMessagesChange to sync back ──
          initialMessages={botState.messages}

          onMessagesChange={botMessagesUpdater}
          onRegisterSetMessages={registerSetMessages}

          onNewOrderFleetAndServiceSelected={handleNewOrderFleetAndServiceSelected}
          onStartNewOrder={handleStartNewOrder}
          newOrderTrigger={newOrderTrigger}

          active={active}
          text={text}
          setText={setText}
          dark={dark}
          setDark={setDark}
          isCollectingCredentials={isCollectingCredentials}
          credentialStep={credentialStep}
          credentialQuestions={credentialQuestions}
          needsOtpVerification={needsOtpVerification}
          registrationComplete={registrationComplete}
          canResendOtp={canResendOtp}
          send={sendMessage_fn}
          handleMessageClick={handleMessageClick}
          pickUp={pickUp}
          runErrand={runErrand}
          setDrawerOpen={setDrawerOpen}
          setInfoOpen={setInfoOpen}
          initialMessagesComplete={initialMessagesComplete}
          runnerId={runnerId}
          kycStep={kycStep}
          kycStatus={kycStatus}
          onIdVerified={onIdVerified}
          handleIDTypeSelection={handleIDTypeSelection}
          onSelfieVerified={onSelfieVerified}
          handleSelfieResponse={handleSelfieResponse}
          checkVerificationStatus={checkVerificationStatus}
          onConnectToService={handleConnectToService}
          onFindMore={handleFindMore}
          nearbyUsers={nearbyUsers}
          onPickService={handlePickService}
          socket={socket}
          isConnected={isConnected}
          runnerData={runnerData}
          canShowNotifications={canShowNotifications}
          hasSearched={hasSearched}
          replyingTo={botState.replyingTo}
          setReplyingTo={setBotReplyingTo}
          currentOrder={botState.currentOrder}
          verificationState={verificationState}
          showBannedModal={showBannedModal}
          setShowBannedModal={setShowBannedModal}
          isConnectLocked={isConnectLocked}
          handleCredentialAnswer={handleCredentialAnswer}
          runnerLocation={runnerLocation}
        />
      );
    }

    if (isLoadingArchive) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">Loading messages...</p>
          </div>
        </div>
      );
    }

    const chatId = activeChatId;
    const chatState = manager.get(chatId);

    return (
      <RunnerChatScreen
        key={`chat-${selectedUser?._id}`}
        // ── Message persistence ──
        initialMessages={chatState.messages}

        onMessagesChange={chatMessagesUpdater}
        onRegisterSetMessages={registerSetMessages}

        onStartNewOrder={handleStartNewOrder}
        onBackToHome={handleBackToHome}

        active={active}
        selectedUser={selectedUser}
        isChatActive={true}
        text={text}
        setText={setText}
        dark={dark}
        setDark={setDark}
        send={sendMessage_fn}
        setDrawerOpen={setDrawerOpen}
        setInfoOpen={setInfoOpen}
        runnerId={runnerId}
        socket={socket}
        showOrderFlow={showOrderFlow}
        setShowOrderFlow={setShowOrderFlow}
        handleOrderStatusClick={handleOrderStatusClick}
        isAttachFlowOpen={isAttachFlowOpen}
        setIsAttachFlowOpen={setIsAttachFlowOpen}
        handleLocationClick={handleLocationClick}
        handleAttachClick={handleAttachClick}
        completedOrderStatuses={manager.get(chatId).completedOrderStatuses}
        setCompletedOrderStatuses={(s) => {
          const next = Array.isArray(s) ? s : typeof s === 'function' ? s(manager.get(chatId).completedOrderStatuses) : [];
          manager.set(chatId, { completedOrderStatuses: next });
          setCompletedStatusesVersion(v => v + 1); // force re-render so chatState re-reads from manager
        }}
        uploadFileWithProgress={uploadFileWithProgress}
        replyingTo={chatState.replyingTo}
        setReplyingTo={(r) => manager.set(chatId, { replyingTo: r })}
        cameraOpen={cameraOpen}
        capturedImage={capturedImage}
        isPreviewOpen={isPreviewOpen}
        switchCamera={switchCamera}
        facingMode={facingMode}
        openCamera={openCamera}
        closeCamera={closeCamera}
        capturePhoto={capturePhoto}
        retakePhoto={retakePhoto}
        openPreview={openPreview}
        closePreview={closePreview}
        setIsPreviewOpen={setIsPreviewOpen}
        videoRef={videoRef}
        callState={callState}
        callType={callType}
        isMuted={isMuted}
        isCameraOff={isCameraOff}
        switchCallCamera={switchCallCamera}
        formattedDuration={formattedDuration}
        remoteUsers={remoteUsers}
        localVideoTrack={localVideoTrack}
        initiateCall={initiateCall}
        acceptCall={acceptCall}
        declineCall={declineCall}
        endCall={endCall}
        toggleMute={toggleMute}
        toggleCamera={toggleCamera}
        isSpeakerOn={isSpeakerOn}
        networkQuality={networkQuality}
        toggleSpeaker={toggleSpeaker}
        currentOrder={chatState.currentOrder}
        setCurrentOrder={(order) => {
          currentOrderRef.current = order;
          manager.set(chatId, { currentOrder: order });
        }}
        runnerFleetType={runnerData?.fleetType}
        taskCompleted={chatState.taskCompleted}
        setTaskCompleted={(v) => manager.set(chatId, { taskCompleted: v })}
        orderCancelled={chatState.orderCancelled}
        cancellationReason={chatState.cancellationReason}
        onSpecialInstructions={onSpecialInstructions}
        onOrderCreated={onOrderCreated}
        onPaymentSuccess={onPaymentSuccess}
        onDeliveryConfirmed={onDeliveryConfirmed}
        onMessageDeleted={onMessageDeleted}
        onSaveDeliveryMarked={(v) => manager.set(chatId, { deliveryMarked: v })}
        onSaveUserConfirmedDelivery={(v) => manager.set(chatId, { userConfirmedDelivery: v })}
        onSaveSpecialInstructions={(v) => manager.set(chatId, { specialInstructions: v })}
        initialDeliveryMarked={chatState.deliveryMarked}
        initialUserConfirmedDelivery={chatState.userConfirmedDelivery}
        initialSpecialInstructions={chatState.specialInstructions}
      />
    );
  };

  const renderContactInfo = (withClose = false) => {
    const chatState = manager.get(activeChatId);
    return (
      <ContactInfo
        contact={active}
        onClose={withClose ? () => setInfoOpen(false) : undefined}
        setActiveModal={setActiveModal}
        onNavigate={setCurrentView}
        serviceType={serviceType}
        onBack={() => setCurrentView('chat')}
        onStartNewOrder={handleStartNewOrder}
        currentOrder={chatState.currentOrder}
        registrationComplete={registrationComplete}
        kycStep={kycStep}
        isChatActive={!isBotMode}
        orderCancelled={chatState.orderCancelled}
        messages={chatState.messages}
        isBotMode={isBotMode}
        isConnectLocked={isConnectLocked}
      />
    );
  };

  const renderView = () => {
    const handleBack = () => setCurrentView('chat');
    const chatState = manager.get(activeChatId);

    switch (currentView) {
      case 'profile':
        return <Profile darkMode={dark} onBack={handleBack} runnerId={runnerId} registrationComplete={registrationComplete} runnerData={runnerData} />;
      case 'wallet':
        return <Wallet darkMode={dark} onBack={handleBack} runnerId={runnerId} />;
      case 'orders':
        return <Orders darkMode={dark} onBack={handleBack} runnerId={runnerId} registrationComplete={registrationComplete} />;
      case 'payout':
        return <Payout darkMode={dark} onBack={handleBack} socket={socket} runnerId={runnerId}
          chatId={selectedUser?._id ? `user-${selectedUser._id}-runner-${runnerId}` : null}
          currentOrder={chatState.currentOrder} />;
      case 'chat':
      default:
        return (
          <div className="h-full w-full grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)_360px]">
            <aside className="hidden lg:flex flex-col border-r dark:border-white/10 border-gray-200 h-full overflow-hidden">
              <Sidebar
                active={active}
                setActive={setActive}
                chatHistory={chatHistory}
                onBotClick={handleBotClick}
                onUserClick={handleUserClick}
              />
            </aside>
            <div className="h-full overflow-hidden">{renderMainScreen()}</div>
            <aside className="hidden lg:block border-l dark:border-white/10 border-gray-200 h-full overflow-hidden">
              {renderContactInfo(false)}
            </aside>
          </div>
        );
    }
  };

  return (
    <div className="h-screen flex flex-col w-full bg-white dark:bg-black-100 bg-gradient-to-br from-slate-900 via-slate-950 to-black text-white">
      <div className={`lg:hidden relative z-10 flex flex-shrink-0 items-center justify-between px-3 py-3 border-b dark:border-white/10 border-gray-200 ${currentView !== 'chat' ? 'hidden' : ''}`}>
        <div className="flex items-center gap-2">
          <IconButton variant="text" className="rounded-full" onClick={() => setDrawerOpen(true)}>
            <Menu className="h-5 w-5" />
          </IconButton>
        </div>
        <div className="flex gap-3">
          <span className="bg-gray-1000 dark:bg-black-200 rounded-full w-10 h-10 flex items-center justify-center">
            <HeaderIcon onClick={() => setInfoOpen(true)}>
              <MoreHorizontal className="h-6 w-6" />
            </HeaderIcon>
          </span>
          <div onClick={() => setDark(!dark)} className="cursor-pointer flex items-center gap-2 p-2">
            {dark ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6 text-gray-800" strokeWidth={3.0} />}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">{renderView()}</div>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} placement="left"
        className="p-0 bg-white dark:bg-black-100 backdrop-blur-xl !z-[9999]"
        overlayProps={{ className: "!z-[9998]" }}>
        <Sidebar active={active} setActive={setActive} chatHistory={chatHistory}
          onBotClick={handleBotClick} onUserClick={handleUserClick}
          onClose={() => setDrawerOpen(false)} />
      </Drawer>

      <Drawer open={infoOpen} onClose={() => setInfoOpen(false)} placement="right"
        className="p-0 bg-white dark:bg-black-100 backdrop-blur-xl !z-[9999]"
        overlayProps={{ className: "!z-[9998]" }}>
        {renderContactInfo(true)}
      </Drawer>

      {activeModal && (
        <Modal type={activeModal} onClose={() => setActiveModal(null)}
          isConnectLocked={isConnectLocked} selectedUser={selectedUser}
          currentOrder={currentChatState.currentOrder}
          registrationComplete={registrationComplete} darkMode={dark} />
      )}

      <TermsAcceptanceModal isOpen={showTerms} onClose={() => { }}
        onAccept={handleAcceptTerms} terms={RUNNER_TERMS} darkMode={dark} userType="runner" />
    </div>
  );
}

// ─── ContactInfo ─────────────────────────────────────────────────────────────
function ContactInfo({
  contact, onClose, setActiveModal, onNavigate, onBack,
  currentOrder, serviceType, kycStep, isChatActive,
  orderCancelled, messages = [], isBotMode, onStartNewOrder, registrationComplete, isConnectLocked
}) {
  const handleModalClick = (modalType) => { onClose?.(); setActiveModal?.(modalType); };
  const handleNavigation = (view) => { onClose?.(); onNavigate?.(view); };

  const isRunErrand =
    serviceType === "run-errand" || serviceType === "run_errand" ||
    currentOrder?.serviceType === "run-errand" || currentOrder?.serviceType === "run_errand" ||
    currentOrder?.taskType === "run_errand" || currentOrder?.taskType === "run-errand";

  const isTerminalOrder = currentOrder != null &&
    ['cancelled', 'completed', 'task_completed'].includes(currentOrder.status);

  const isPaid = currentOrder?.paymentStatus === 'paid' ||
    messages.some(m => m.type === 'system' && m.text?.toLowerCase().includes('made payment for this task'));


  const canCancel = isChatActive && !orderCancelled && currentOrder != null && !isTerminalOrder;
  const showPayout = isRunErrand && isPaid && !isTerminalOrder;
  const showStartNewOrder = isBotMode === true && contact?.isBot === true;
  const startNewOrderDisabled = kycStep < 6 || isConnectLocked;

  return (
    <div className="h-screen flex flex-col overflow-y-auto gap-6 marketSelection">
      <div className="py-3 px-2">
        {onClose && (
          <IconButton variant="text" size="sm" className="rounded-full lg:hidden flex" onClick={onClose}>
            <X className="h-7 w-7" />
          </IconButton>
        )}
      </div>

      <div className="cursor-pointer hover:bg-gray-200 dark:hover:bg-black-200 transition-colors" onClick={() => handleNavigation('profile')}>
        <h3 className="px-4 py-5 font-bold text-md text-black-200 dark:text-gray-300">Profile</h3>
      </div>
      <div className="cursor-pointer hover:bg-gray-200 dark:hover:bg-black-200 transition-colors" onClick={() => handleNavigation('wallet')}>
        <h3 className="px-4 py-5 font-bold text-md text-black-200 dark:text-gray-300">Wallet</h3>
      </div>
      <div className="cursor-pointer hover:bg-gray-200 dark:hover:bg-black-200 transition-colors" onClick={() => handleNavigation('orders')}>
        <h3 className="px-4 py-5 font-bold text-md text-black-200 dark:text-gray-300">Orders</h3>
      </div>

      {showPayout && (
        <div className="cursor-pointer hover:bg-gray-200 dark:hover:bg-black-200 transition-colors" onClick={() => handleNavigation('payout')}>
          <h3 className="px-4 py-5 font-bold text-md text-black-200 dark:text-gray-300">Payout</h3>
        </div>
      )}

      {showStartNewOrder && (
        <div
          onClick={() => { if (!startNewOrderDisabled) onStartNewOrder?.(); }}
          className={startNewOrderDisabled ? 'opacity-40 pointer-events-none' : 'cursor-pointer hover:bg-gray-200 dark:hover:bg-black-200 transition-colors'}
        >
          <h3 className="px-4 py-5 font-bold text-md text-black-200 dark:text-gray-300">
            {isConnectLocked ? 'Ongoing Order — cancel or complete current order to start new' : 'Start new order'}
          </h3>
        </div>
      )}

      {canCancel && (
        <div className="cursor-pointer hover:bg-gray-200 dark:hover:bg-black-200 transition-colors" onClick={() => handleModalClick('cancelOrder')}>
          <p className="px-4 py-5 text-md font-medium text-red-400">Cancel order</p>
        </div>
      )}
    </div>
  );
}