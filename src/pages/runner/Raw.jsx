/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { IconButton, Drawer } from "@material-tailwind/react";
import { Menu, MoreHorizontal, X, Sun, Moon } from "lucide-react";
import useDarkMode from "../../hooks/useDarkMode";
import { Modal } from "../../components/common/Modal";
import { useDispatch, useSelector, shallowEqual } from "react-redux";
import { fetchNearbyUserRequests, clearNearbyUsers } from "../../Redux/userSlice";
import { updateProfile } from "../../Redux/runnerSlice";
import { useSocket } from "../../hooks/useSocket";
import RunnerChatScreen from "../../components/runnerScreens/RunnerChatScreen";
import OnboardingScreen from "../../components/runnerScreens/OnboardingScreen";
import Sidebar from "../../components/runnerScreens/Sidebar";

// import PhoneVerificationPrompt from "../../components/common/PhoneVerificationPrompt";
import { Profile } from './Profile';
import { Wallet } from './Wallet';
import { Orders } from './Orders';
import { Payout } from './Payout';
import { Disputes } from './Disputes';

import { usePushNotifications } from "../../hooks/usePushNotifications";
import { useCredentialFlow } from "../../hooks/useCredentialFlow";
import { useKycHook } from '../../hooks/useKycHook';
import { useCameraHook } from "../../hooks/useCameraHook";
import { useCallHook } from "../../hooks/useCallHook";
import TermsAcceptanceModal from '../../components/common/TermsAcceptanceModal';
import { RUNNER_TERMS } from '../../constants/terms';
import api from '../../utils/api';
import { fetchOrderByChatId } from '../../Redux/orderSlice';
import BannedModal from '../../components/runnerScreens/BannedModal';
import useOrderStore from '../../store/orderStore';

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
        newOrderComplete: false,
        newOrderStep: null,
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
function WhatsAppLikeChat() {
  const { runner } = useSelector((s) => s.auth);
  const nearbyUsers = useSelector((state) => state.users.nearbyUsers, shallowEqual);

  const saved = runner?._id
    ? JSON.parse(localStorage.getItem('runner_ui') || '{}')
    : {};
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

  const dispatch = useDispatch();

  // ── UI state ────────────────────────────────────────────────────────────────
  const [chatHistory, setChatHistory] = useState(() => {
    const savedChats = saved.chatHistory || [];
    return [BOT_CHAT_ENTRY, ...savedChats];
  });

  const [active, setActive] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [activeModal, setActiveModal] = useState(null);
  const [currentView, setCurrentView] = useState('chat');
  const [showOrderFlow, setShowOrderFlow] = useState(false);
  const [isAttachFlowOpen, setIsAttachFlowOpen] = useState(false);
  const [isLoadingArchive, setIsLoadingArchive] = useState(false);
  const [silentRefreshKey, setSilentRefreshKey] = useState(0);
  const [, setCompletedStatusesVersion] = useState(0);
  const [orderPending, setOrderPending] = useState(false);

  // ── Runner identity ─────────────────────────────────────────────────────────
  const [runnerId, setRunnerId] = useState(() => runner?._id || null);
  const runnerIdRef = useRef(null);
  const [runnerLocation, setRunnerLocation] = useState(null);

  // ── Chat routing state ──────────────────────────────────────────────────────
  // activeChatId drives which screen is shown and which manager slot is active.
  // 'sendrey-bot' = onboarding screen. Any other value = RunnerChatScreen.
  const [activeChatId, setActiveChatId] = useState(saved.activeChatId || BOT_CHAT_ID);
  const [selectedUser, setSelectedUser] = useState(saved.selectedUser || null);

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
  const [botRefreshTrigger, setBotRefreshTrigger] = useState(0);
  const [canResendOtp, setCanResendOtp] = useState(false);

  // ── Refs ────────────────────────────────────────────────────────────────────
  const manager = useRef(new ChatStateManager()).current;
  const serviceTypeRef = useRef(saved.serviceType || runner?.serviceType || null);
  const fleetTypeRef = useRef(runner?.fleetType || null);
  const currentOrderRef = useRef(null);
  const selectedUserRef = useRef(saved.selectedUser || null);
  const activeChatIdRef = useRef(BOT_CHAT_ID);
  const activeScreenIdRef = useRef(saved.activeChatId || BOT_CHAT_ID);
  const kycStartedRef = useRef(false);
  const searchIntervalRef = useRef(null);
  // Each child screen registers its setMessages here so raw.jsx can push
  // messages into the currently visible screen from socket handlers.
  const activeSetMessagesRef = useRef(null);
  const isFreshRegistrationRef = useRef(false);
  const orderStoreRef = useRef(useOrderStore.getState());



  if (typeof window !== 'undefined') {
    window.__chatManager = manager;
  }

  // ── Hooks ───────────────────────────────────────────────────────────────────
  const {
    socket, joinRunnerRoom, sendMessage, isConnected,
    uploadFileWithProgress, onSpecialInstructions, onOrderCreated,
    onPaymentSuccess, onDeliveryConfirmed, onMessageDeleted, reconnect,
  } = useSocket();


  const {
    isCollectingCredentials, credentialStep, credentialQuestions,
    startCredentialFlow, needsOtpVerification, handleCredentialAnswer,
    registrationComplete, handleOtpVerification, runnerData, handleResendOtp: resendOtpFromHook,
    isReturningUser, returningUserData, handleReturningUserChoice, isSubmitting,
  } = useCredentialFlow(serviceTypeRef, (rd) => {
    setRunnerId(rd._id || rd.id);
    isFreshRegistrationRef.current = true;
  });

  const {
    kycStep, kycStatus, startKycFlow, onIdVerified,
    handleSelfieResponse, handleIDTypeSelection, onSelfieVerified,
    checkVerificationStatus, resumeKycFlow
  } = useKycHook(runnerId, runnerData?.fleetType);

  const handleSelfieResponseRef = useRef(handleSelfieResponse);
  useEffect(() => { handleSelfieResponseRef.current = handleSelfieResponse; }, [handleSelfieResponse]);

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

  const { permission, requestPermission } = usePushNotifications({
    userId: runnerId,
    userType: 'runner',
    socket,
    onIncomingCall: useCallback((data) => {
      // data = { callId, chatId, callType, callerId, callerType, channelName, token }
      // acceptCall from useCallHook handles joining the Agora channel
      acceptCall(data);
    }, [acceptCall]),
  });


  useEffect(() => {
    if (!serviceType) return;
    serviceTypeRef.current = serviceType;
  }, [serviceType]);

  // ── Keep activeChatIdRef in sync ────────────────────────────────────────────
  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);

  useEffect(() => {
    if (runner?._id && !runnerId) {
      setRunnerId(runner._id);
    }
  }, [runner?._id]);

  useEffect(() => { runnerIdRef.current = runnerId; }, [runnerId]);

  useEffect(() => {
    const save = () => localStorage.setItem('runner_ui', JSON.stringify({
      activeChatId, selectedUser, active, currentView, serviceType,
      chatHistory: chatHistory.filter(c => c.id !== BOT_CHAT_ID),
    }));
    window.addEventListener('beforeunload', save);
    return () => window.removeEventListener('beforeunload', save);
  }, [activeChatId, selectedUser, active, currentView, serviceType, chatHistory]);


  useEffect(() => {
    if (runnerId && socket && permission === 'default') requestPermission();

  }, [runnerId, socket, permission, requestPermission]);

  useEffect(() => {
    const unsub = useOrderStore.subscribe(s => { orderStoreRef.current = s; });
    return unsub;
  }, []);

  useEffect(() => {
    if (!saved.selectedUser || !saved.activeChatId || saved.activeChatId === BOT_CHAT_ID) return;
    // Restore the selected user so RunnerChatScreen renders
    selectedUserRef.current = saved.selectedUser;
    const savedEntry = (saved.chatHistory || []).find(c => c.userId === saved.selectedUser._id);
    if (savedEntry) setActive(savedEntry);
  }, []);

  useEffect(() => {
    if (!runner?._id) return;
    const { _chats } = useOrderStore.getState();
    for (const [chatId, chatData] of Object.entries(_chats)) {
      const msgs = chatData.messages ?? [];
      if (msgs.length > 0) {
        manager.set(chatId, { messages: msgs });
      }
    }
    const botMsgs = _chats[BOT_CHAT_ID]?.messages ?? [];
    if (botMsgs.length > 0 && activeSetMessagesRef.current) {
      activeSetMessagesRef.current(botMsgs);
    }
  }, [runner?._id]);


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
    // Only push to active screen if the bot screen is actually mounted and registered
    if (activeChatIdRef.current === BOT_CHAT_ID &&
      activeScreenIdRef.current === BOT_CHAT_ID &&
      activeSetMessagesRef.current) {
      activeSetMessagesRef.current(next);
    }

    if (runner?._id) {
      useOrderStore.getState().setMessages(BOT_CHAT_ID, next);
    }
  }, [runner?._id]);

  const chatMessagesUpdater = useCallback((updater) => {
    const chatId = activeChatIdRef.current;
    const next = manager.updateMessages(chatId, updater);
    if (activeSetMessagesRef.current) {
      activeSetMessagesRef.current(next);
    }

    if (registrationComplete || runner?._id) {
      useOrderStore.getState().setMessages(chatId, next);
    }

  }, []);

  const registerSetMessages = useCallback((fn, screenId) => {
    activeSetMessagesRef.current = fn;
    activeScreenIdRef.current = screenId;
  }, []);

  // ── KYC nudge timer ref ──────────────────────────────────────────────────────
  const kycNudgeTimerRef = useRef(null);
  const KYC_NUDGE_INTERVAL = 2 * 24 * 60 * 60 * 1000;

  // ── Terms acceptance ────────────────────────────────────────────────────────
  const handleAcceptTerms = async () => {
    try {
      await api.post('/terms/accept', { version: RUNNER_TERMS.version, userType: 'runner' });
      localStorage.setItem(`terms_accepted_${runnerId}`, 'true');
      localStorage.setItem(`kyc_flow_started_${runnerId}`, 'true');
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

    const savedState = manager.get(chatId);

    // If messages are cleared (after start new order), fetch from archive
    if (savedState.messages.length === 0 && socket && isConnected) {
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
        manager.set(chatId, { ...savedState, messages: formatted });
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
    } else if (savedState.messages.length > 0) {
      // Use existing messages
      setTimeout(() => {
        if (activeSetMessagesRef.current) {
          activeSetMessagesRef.current(savedState.messages);
        }
      }, 50);
    }
  }, [runnerId, socket, isConnected, manager, handleBotClick]);

  // 
  useEffect(() => {
    console.log('[RAW] silentRefreshKey changed', silentRefreshKey);
  }, [silentRefreshKey]);

  // ── KYC started effect ───────────────────────────────────────────────────────

  // REPLACE the existing KYC started effect with:

  useEffect(() => {
    console.log('[RAW] KYC effect evaluated', {
      registrationComplete,
      runnerId,
      needsOtpVerification,
      isCollectingCredentials,
      isReturningUser,
      kycOverallVerified: kycStatus.overallVerified,
      kycStep,
      returningUserKycStatus: returningUserData?.kycStatus ?? null,
      kycStartedRef: kycStartedRef.current,
      kycFlowStartedLS: localStorage.getItem(`kyc_flow_started_${runnerId}`),
    });

    // // Gate 1: credentials must be done
    // if (!registrationComplete || !runnerId) return;
    // // Gate 2: OTP must be done
    // if (needsOtpVerification) return;
    // // Gate 3: credential collection must be done
    // if (isCollectingCredentials) return;
    // // Gate 4: don't double-start
    // if (kycStartedRef.current) return;
    // // Gate 5: already fully verified
    // if (kycStatus.overallVerified || kycStep === 6) return;
    // // Gate 6: returning user flow — wait until handleReturningUserChoice has resolved
    // if (isReturningUser) return;
    if (!registrationComplete || !runnerId) { console.log('[RAW] KYC effect BLOCKED — no registrationComplete/runnerId'); return; }
    if (needsOtpVerification) { console.log('[RAW] KYC effect BLOCKED — needsOtpVerification'); return; }
    if (isCollectingCredentials) { console.log('[RAW] KYC effect BLOCKED — isCollectingCredentials'); return; }
    if (kycStartedRef.current) { console.log('[RAW] KYC effect BLOCKED — kycStartedRef already true'); return; }
    if (kycStatus.overallVerified || kycStep === 6) { console.log('[RAW] KYC effect BLOCKED — already verified'); return; }
    if (isReturningUser) { console.log('[RAW] KYC effect BLOCKED — isReturningUser still true (waiting for choice)'); return; }

    if ((runner?.isVerified || runner?.runnerStatus === 'active') && !isFreshRegistrationRef.current) {
      console.log('[RAW] KYC effect BLOCKED — runner already verified server-side (preexisting session)');
      kycStartedRef.current = true;
      localStorage.setItem(`kyc_flow_started_${runnerId}`, 'true');
      return;
    }

    const kycFlowStarted = localStorage.getItem(`kyc_flow_started_${runnerId}`);
    if (kycFlowStarted) { console.log('[RAW] KYC effect BLOCKED — kyc_flow_started in localStorage'); return; }

    const timer = setTimeout(() => {
      console.log('[RAW] KYC timer fired', { kycStartedRef: kycStartedRef.current, isReturningUser, returningUserKycStatus: returningUserData?.kycStatus });
      // Re-check gates inside timeout (state may have changed)
      if (kycStartedRef.current) return;
      if (kycStatus.overallVerified || kycStep === 6) return;
      if (isReturningUser) return;

      kycStartedRef.current = true;

      const alreadyAccepted = localStorage.getItem(`terms_accepted_${runnerId}`);

      if (returningUserData?.kycStatus) {
        // Returning user: check if selfie already submitted — skip KYC entirely
        const { selfieVerified, selfieStatus, overallVerified } = returningUserData.kycStatus;
        if (selfieVerified || selfieStatus === 'pending_review' || overallVerified) {
          localStorage.setItem(`kyc_flow_started_${runnerId}`, 'true');
          return;
        }
        // Returning user with incomplete KYC — resume
        localStorage.setItem(`kyc_flow_started_${runnerId}`, 'true');
        setTimeout(() => resumeKycFlow(returningUserData.kycStatus, botMessagesUpdater), 1500);
      } else if (!alreadyAccepted) {
        // New user — show terms first
        setShowTerms(true);
      } else {
        // New user, terms already accepted
        localStorage.setItem(`kyc_flow_started_${runnerId}`, 'true');
        startKycFlow(botMessagesUpdater);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [
    registrationComplete, runnerId, needsOtpVerification, isCollectingCredentials,
    isReturningUser, kycStatus.overallVerified, kycStep, returningUserData,
    resumeKycFlow, startKycFlow, botMessagesUpdater,
  ]);

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

  // Ban listener
  useEffect(() => {
    if (!socket || !runnerId) return;

    const handleAlert = (msg) => {
      pushToActiveScreen(prev => [...prev, msg]);
      const chatId = activeChatIdRef.current;
      manager.updateMessages(chatId, prev => [...prev, msg]);
    };

    socket.on('runnerSystemAlert', handleAlert);
    return () => socket.off('runnerSystemAlert', handleAlert);
  }, [socket, runnerId, pushToActiveScreen, manager]);

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

    const {
      setCurrentOrder,
      mergeCurrentOrder,
      setTaskCompleted,
      setOrderCancelled,
      // addCompletedStatus,
      getChat,
    } = useOrderStore.getState();

    // ── Helper: resolve chatId from event data or active refs ────────────────
    const resolveChatId = (data) => {
      if (data?.chatId) return data.chatId;
      if (selectedUserRef.current?._id && runnerIdRef.current) {
        return `user-${selectedUserRef.current._id}-runner-${runnerIdRef.current}`;
      }
      const active = activeChatIdRef.current;
      return active !== BOT_CHAT_ID ? active : null;
    };

    // ── paymentSuccess ────────────────────────────────────────────────────────
    const onPayment = (data) => {
      const chatId = resolveChatId(data);
      if (!chatId) return;

      mergeCurrentOrder(chatId, {
        escrowId: data.escrowId,
        orderId: data.orderId ?? getChat(chatId).currentOrder?.orderId,
        paymentStatus: 'paid',
        status: 'active',
      });

      // Keep manager ref in sync for non-reactive legacy reads
      currentOrderRef.current = useOrderStore.getState().getChat(chatId).currentOrder;
      manager.set(chatId, { currentOrder: currentOrderRef.current });

      // Push a no-op so the child screen re-reads currentOrder from store
      pushToActiveScreen(prev => [...prev]);
    };

    // ── orderCreated ──────────────────────────────────────────────────────────
    const onOrderCreated = (data) => {
      const order = data.order ?? data;
      if (!order?.orderId) return;

      const chatId = order.chatId ?? resolveChatId(data);
      if (!chatId) {
        console.warn('[orderCreated] could not resolve chatId, discarding:', order.orderId);
        return;
      }

      const prevOrder = getChat(chatId).currentOrder;
      const isNewOrder = !prevOrder || prevOrder.orderId !== order.orderId;
      const merged = isNewOrder ? order : { ...prevOrder, ...order };

      setCurrentOrder(chatId, merged);
      currentOrderRef.current = merged;
      manager.set(chatId, { currentOrder: merged });

      if (isNewOrder) {
        // Reset all terminal flags in Zustand for the fresh order
        useOrderStore.getState()._patch(chatId, {
          taskCompleted: false,
          orderCancelled: false,
          cancellationReason: null,
          completedStatuses: [],
          deliveryMarked: false,
          userConfirmedDelivery: false,
        });
        manager.set(chatId, {
          completedOrderStatuses: [],
          deliveryMarked: false,
          userConfirmedDelivery: false,
          taskCompleted: false,
          orderCancelled: false,
          cancellationReason: null,
        });
        setOrderPending(false);
      }
    };

    // ── task_completed ────────────────────────────────────────────────────────
    const onTaskCompleted = (data) => {
      // Prefer chatId from payload; fall back to active chat
      const chatId = resolveChatId(data ?? {});
      if (!chatId) return;

      // 1. Write to Zustand → ContactInfo, sidebar, RunnerChatScreen all rerender
      setTaskCompleted(chatId, true);

      const storeOrder = getChat(chatId).currentOrder;
      if (storeOrder) {
        mergeCurrentOrder(chatId, { status: 'completed', paymentStatus: 'paid' });
      }

      // 2. Keep legacy manager in sync
      manager.set(chatId, {
        taskCompleted: true,
        currentOrder: storeOrder
          ? { ...storeOrder, status: 'completed', paymentStatus: 'paid' }
          : null,
      });

      // 3. Clean persisted order
      try { localStorage.removeItem(`currentOrder_${runnerIdRef.current}`); } catch (_) { }

      // 4. Inject system message into the active chat screen directly
      const systemMsg = {
        id: `task-completed-${Date.now()}`,
        from: 'system',
        type: 'system',
        messageType: 'system',
        text: 'Task completed! Great job.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        senderId: 'system',
        senderType: 'system',
      };
      // Inject into active screen
      pushToActiveScreen(prev => {
        const alreadyHas = prev.some(
          m => m.type === 'system' && m.text?.toLowerCase().includes('task completed')
        );
        return alreadyHas ? prev : [...prev, systemMsg];
      });
      // Persist to manager so it survives screen switches
      const chatId2 = chatId; // closure capture
      manager.updateMessages(chatId2, prev => {
        const alreadyHas = prev.some(
          m => m.type === 'system' && m.text?.toLowerCase().includes('task completed')
        );
        return alreadyHas ? prev : [...prev, systemMsg];
      });
    };

    // ── orderCancelled ────────────────────────────────────────────────────────
    const onOrderCancelled = (data) => {
      const chatId = resolveChatId(data ?? {});
      if (!chatId) return;

      const cancelledBy = data?.cancelledBy ?? data?.reason ?? 'Unknown';

      // 1. Zustand → instant reactivity everywhere
      setOrderCancelled(chatId, cancelledBy);
      mergeCurrentOrder(chatId, { status: 'cancelled' });

      // 2. Legacy manager sync
      const storeOrder = getChat(chatId).currentOrder;
      currentOrderRef.current = storeOrder ? { ...storeOrder, status: 'cancelled' } : null;
      manager.set(chatId, {
        orderCancelled: true,
        cancellationReason: cancelledBy,
        currentOrder: currentOrderRef.current,
      });

      // 3. Inject cancellation system message immediately
      const cancelMsg = {
        id: `cancel-${Date.now()}`,
        from: 'system',
        type: 'system',
        messageType: 'system',
        text: cancelledBy === 'runner'
          ? 'You cancelled this order.'
          : 'The user cancelled this order.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        senderId: 'system',
        senderType: 'system',
      };
      pushToActiveScreen(prev => {
        const alreadyHas = prev.some(m => m.text?.toLowerCase().includes('cancelled this order'));
        return alreadyHas ? prev : [...prev, cancelMsg];
      });
      manager.updateMessages(chatId, prev => {
        const alreadyHas = prev.some(m => m.text?.toLowerCase().includes('cancelled this order'));
        return alreadyHas ? prev : [...prev, cancelMsg];
      });
    };

    socket.on('paymentSuccess', onPayment);
    socket.on('orderCreated', onOrderCreated);
    socket.on('task_completed', onTaskCompleted);
    socket.on('orderCancelled', onOrderCancelled);

    return () => {
      socket.off('paymentSuccess', onPayment);
      socket.off('orderCreated', onOrderCreated);
      socket.off('task_completed', onTaskCompleted);
      socket.off('orderCancelled', onOrderCancelled);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, runnerId, manager, pushToActiveScreen]);

  // ── Socket: chatHistory from server ──────────────────────────────────────────
  useEffect(() => {
    if (!selectedUser || !socket || !isConnected || selectedUser.isBot) return;

    const chatId = `user-${selectedUser._id}-runner-${runnerId}`;

    // Don't emit if we're already in this chat and have messages
    const currentState = manager.get(chatId);
    if (activeChatId === chatId && currentState.messages.length > 0) {
      console.log('Already in this chat, skipping re-join');
      return;
    }

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
          // Only filter out join/payment messages if they predate the terminal order
          // Messages after the terminal order completed are from a new session — keep them
          const orderCompletedAt = latestOrder?.completedAt || latestOrder?.updatedAt;
          const msgIsOld = orderCompletedAt
            ? new Date(msg.createdAt) < new Date(orderCompletedAt)
            : true;

          if (msgIsOld) {
            if (msg.type === 'system' && msg.text?.includes('joined the chat')) return false;
            if (msg.type === 'payment_request' || msg.messageType === 'payment_request') return false;
          }
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

  useEffect(() => {
    if (!activeChatId || activeChatId === BOT_CHAT_ID) return;
    const { getChat } = useOrderStore.getState(); // eslint-disable-line no-unused-vars
    // Subscribe to store changes and keep the ref in sync
    const unsub = useOrderStore.subscribe(
      (state) => state.getChat(activeChatId).currentOrder,
      (order) => { currentOrderRef.current = order; }
    );
    return unsub;
  }, [activeChatId]);

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

    // actually dispatch the resend to backend
    resendOtpFromHook(botMessagesUpdater);

    const msg1 = {
      id: Date.now(), from: "them",
      text: "We have sent you a new OTP",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "delivered",
    };
    botMessagesUpdater(prev => [...prev, msg1]);

    setTimeout(() => {
      const msg2 = {
        id: Date.now() + 1, from: "them",
        // text: `Enter the OTP we sent to ${runnerData?.phone}, \n \nDidn't receive OTP? Resend`,
        text: `Enter the OTP we sent to ${runnerData?.email}, \n \nDidn't receive OTP? Resend`,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "delivered", hasResendLink: true,
      };
      botMessagesUpdater(prev => [...prev, msg2]);
    }, 1200);

    setCanResendOtp(false);
    setTimeout(() => setCanResendOtp(true), 40000);
  }, [canResendOtp, botMessagesUpdater, runnerData?.email, resendOtpFromHook
    // runnerData?.phone,
  ]);

  const handleMessageClick = useCallback((message, choice) => {
    if (message.hasResendLink && canResendOtp) { handleResendOtp(); return; }
    if (message.selfieChoice) {
      handleSelfieResponseRef.current(message.selfieChoice, botMessagesUpdater);
      if (message.selfieChoice === 'okay') openCamera();
    }

  }, [canResendOtp, handleResendOtp, openCamera.apply,]);

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


  const send = useCallback((replyingTo = null) => { // eslint-disable-line no-unused-vars
    const currentText = manager.get(activeChatIdRef.current).draft || ''; // eslint-disable-line no-unused-vars
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
    console.log("connecting to errand service")
    console.log("guard check", { runnerLocation, serviceType: serviceTypeRef.current })
    if (!runnerLocation || !serviceTypeRef.current) return;
    dispatch(clearNearbyUsers());
    setHasSearched(false);

    const searchParams = {
      latitude: runnerLocation.latitude,
      longitude: runnerLocation.longitude,
      serviceType: serviceTypeRef.current,
      fleetType: fleetTypeRef.current || runnerData?.fleetType,
    };

    console.log("searching", searchParams)

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
    const currentSelectedUser = selectedUserRef.current;
    const currentRunnerId = runnerIdRef.current;

    if (!isBotMode && currentSelectedUser?._id) {
      const prevChatId = `user-${currentSelectedUser._id}-runner-${currentRunnerId}`;

      // Archive current session before clearing
      if (socket && currentOrderRef.current?.orderId) {
        socket.emit('archiveChatSession', {
          chatId: prevChatId,
          orderId: currentOrderRef.current.orderId,
          status: currentOrderRef.current.status === 'task_completed' ? 'completed' : 'cancelled'
        });
      }

      // Clear messages for this chat (they're archived now)
      manager.set(prevChatId, {
        messages: [],
        completedOrderStatuses: [],
        taskCompleted: false,
        orderCancelled: false,
        cancellationReason: null,
        currentOrder: null,
        deliveryMarked: false,
        userConfirmedDelivery: false,
        specialInstructions: null,
      });

      useOrderStore.getState().clearChatOrder(prevChatId);

      const prevOrderId = currentOrderRef.current?.orderId;

      currentOrderRef.current = null;
      setOrderPending(true);          // lock immediately
      setCompletedStatusesVersion(v => v + 1);

      try { localStorage.removeItem(`currentOrder_${currentRunnerId}`); } catch { }

      if (socket && prevOrderId) {
        socket.emit('runnerStartedNewOrder', { runnerId: currentRunnerId, previousOrderId: prevOrderId });
      }
    }

    // Reset bot state for new order flow
    manager.set(BOT_CHAT_ID, {
      newOrderComplete: false,
      newOrderStep: null,
      showConnectButton: false,
      serviceType: null,
      fleetType: null
    });

    setVerificationState(null);
    currentOrderRef.current = null;

    // Switch to bot screen for new order selection
    setTimeout(() => {
      handleBotClick();
      setNewOrderTrigger(t => t + 1);
    }, 0);
  }, [isBotMode, socket, manager, handleBotClick, currentOrderRef]);

  // ── Back to home (from completed/cancelled chat) ──────────────────────────────
  const handleBackToHome = useCallback(() => {
    const chatId = activeChatIdRef.current;
    const chatState = manager.get(chatId);

    if (chatState.currentOrder) {
      const terminalStatus = chatState.taskCompleted ? 'completed' : 'cancelled';
      manager.set(chatId, {
        currentOrder: { ...chatState.currentOrder, status: terminalStatus },
      });
      currentOrderRef.current = null;
    }

    // clear the Zustand order so isConnectLocked unlocks
    useOrderStore.getState()._patch(chatId, {
      currentOrder: null,
      deliveryMarked: false,
      userConfirmedDelivery: false,
      completedStatuses: [],
      // taskCompleted and orderCancelled intentionally preserved
    });

    if (chatState.taskCompleted || chatState.orderCancelled) {
      setSilentRefreshKey(k => k + 1);
    }


    manager.set(BOT_CHAT_ID, {
      newOrderComplete: false,
      newOrderStep: null,
    });

    setOrderPending(false);

    setBotRefreshTrigger(t => t + 1);
    handleBotClick();

    manager.set(BOT_CHAT_ID, {
      newOrderComplete: false,
      newOrderStep: null,
      showConnectButton: false,
      serviceType: null,
      fleetType: null,
    });
  }, [handleBotClick, manager]);

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

  const handleNewOrderFleetAndServiceSelected = useCallback(async (newServiceType, newFleetType) => {
    console.log('fleet+service selected:', newServiceType, newFleetType);

    const currentRunnerId = runnerIdRef.current;
    manager.set(BOT_CHAT_ID, { newOrderComplete: true });
    serviceTypeRef.current = newServiceType;
    fleetTypeRef.current = newFleetType;
    setServiceType(newServiceType);

    // Get current location
    let latitude = null;
    let longitude = null;
    if (navigator.geolocation) {
      try {
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          });
        });
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
      } catch (error) {
        console.error('Location error:', error);
      }
    }

    if (runnerId && socket) joinRunnerRoom(currentRunnerId, newServiceType);

    dispatch(updateProfile({
      fleetType: newFleetType,
      serviceType: newServiceType,
      ...(latitude !== null && longitude !== null && { latitude, longitude }),
    }));

  }, [socket, joinRunnerRoom, dispatch, runnerId]);

  // ── Pick service from notifications ──────────────────────────────────────────

  const handlePickService = useCallback(async (user, specialInstructions = null) => {
    const currentRunnerId = runnerIdRef.current;
    console.log('HANDLE PICK SERVICE - START', {
      userId: user._id,
      runnerId: currentRunnerId,
      chatId: `user-${user._id}-runner-${currentRunnerId}`,
    });


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

    useOrderStore.getState().clearChatOrder(chatId);

    console.log('HANDLE PICK SERVICE - AFTER RESET', {
      chatId,
      storeAfterReset: useOrderStore.getState().getChat(chatId),
    });

    currentOrderRef.current = null;
    setOrderPending(true);
    setCompletedStatusesVersion(v => v + 1); // force ContactInfo to re-read manager

    if (socket && isConnected) {
      socket.emit('runnerJoinChat', {
        runnerId: currentRunnerId,
        userId: user._id, chatId,
        serviceType: user.currentRequest?.serviceType || serviceTypeRef.current,
      });
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

  const isConnectLockedFromStore = useOrderStore(s => {
    if (orderPending) return true;
    const chats = s._chats;
    for (const chatId in chats) {
      const chat = chats[chatId];
      if (!chat.currentOrder) continue;
      if (chat.taskCompleted || chat.orderCancelled) continue;
      const status = chat.currentOrder.status;
      if (!['completed', 'cancelled', 'task_completed'].includes(status)) return true;
    }
    return false;
  });

  const isConnectLocked = isConnectLockedFromStore;

  // ── Render ────────────────────────────────────────────────────────────────────
  const renderMainScreen = () => {
    // if (runner && token && !runner.isPhoneVerified) {
    //   return <PhoneVerificationPrompt user={runner} darkMode={dark} toggleDarkMode={() => setDark(!dark)} />;
    // }

    // console.log('renderMainScreen - activeChatId:', activeChatId);
    // console.log('renderMainScreen - isBotMode:', isBotMode);

    if (isBotMode) {
      const botState = manager.get(BOT_CHAT_ID);
      // console.log('botState on render:', {
      //   newOrderComplete: botState.newOrderComplete,
      //   newOrderStep: botState.newOrderStep,
      // });
      return (
        <OnboardingScreen
          key={`sendrey-bot-${silentRefreshKey}`}
          // ── Message persistence: pass from manager, child owns its own useState
          // initialized from this, and calls onMessagesChange to sync back ──
          initialMessages={botState.messages}
          botRefreshTrigger={botRefreshTrigger}
          onMessagesChange={botMessagesUpdater}
          onRegisterSetMessages={registerSetMessages}

          onNewOrderFleetAndServiceSelected={handleNewOrderFleetAndServiceSelected}
          onStartNewOrder={handleStartNewOrder}
          newOrderTrigger={newOrderTrigger}

          onReturningUserChoice={(choice) =>
            handleReturningUserChoice(choice, botMessagesUpdater)
          }

          isSubmitting={isSubmitting}
          newOrderComplete={botState.newOrderComplete}
          onSetNewOrderComplete={(val) => {
            manager.set(BOT_CHAT_ID, { newOrderComplete: val });
          }}

          isVerified={kycStatus.overallVerified}
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
          onBannedDetected={() => {
            setShowBannedModal(true);
            setVerificationState({ isBanned: true, reason: 'Your account has been suspended. Please contact support.' });
          }}
          checkVerificationStatus={
            (setMessages) => checkVerificationStatus(
              setMessages,
              () => {
                setShowBannedModal(true);
                setVerificationState({ isBanned: true, reason: 'Your account has been suspended.' });
              }
            )
          }
          onConnectToService={handleConnectToService}
          onFindMore={handleFindMore}
          nearbyUsers={nearbyUsers}
          onPickService={handlePickService}
          socket={socket}
          isConnected={isConnected}
          reconnect={reconnect}
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

          // returning users
          isReturningUser={isReturningUser}
          returningUserData={returningUserData}
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

    console.log('RAW.JSX - Rendering RunnerChatScreen:', {
      chatId,
      taskCompletedFromStore: useOrderStore.getState().getChat(chatId).taskCompleted,
      taskCompletedFromManager: chatState.taskCompleted,
      completedStatusesFromStore: useOrderStore.getState().getChat(chatId).completedStatuses,
      orderStatus: chatState.currentOrder?.status,
      serviceType: selectedUser?.serviceType,
    });

    return (
      <RunnerChatScreen
        key={`chat-${selectedUser?._id}-${chatState.currentOrder?.orderId}`}
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
        completedOrderStatuses={useOrderStore.getState().getChat(chatId).completedStatuses}
        setCompletedOrderStatuses={(s) => {
          const next = Array.isArray(s) ? s
            : typeof s === 'function' ? s(useOrderStore.getState().getChat(chatId).completedStatuses)
              : [];
          manager.set(chatId, { completedOrderStatuses: next });
          useOrderStore.getState().setCompletedStatuses(chatId, next);
          setCompletedStatusesVersion(v => v + 1);
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
        runnerFleetType={runnerData?.fleetType}

        taskCompleted={useOrderStore.getState().getChat(chatId).taskCompleted}

        setTaskCompleted={(val) => {
          manager.set(chatId, { taskCompleted: val });
          useOrderStore.getState().setTaskCompleted(chatId, val);
        }}

        orderCancelled={chatState.orderCancelled}
        cancellationReason={chatState.cancellationReason}
        onSpecialInstructions={onSpecialInstructions}
        onOrderCreated={onOrderCreated}
        onPaymentSuccess={onPaymentSuccess}
        onDeliveryConfirmed={onDeliveryConfirmed}
        onMessageDeleted={onMessageDeleted}
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
        chatId={activeChatId}
        registrationComplete={registrationComplete}
        kycStep={kycStep}
        isVerified={kycStatus.overallVerified}
        isChatActive={!isBotMode}
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
      case 'disputes':
        return (
          <Disputes
            darkMode={dark}
            onBack={handleBack}
            runnerId={runnerId}
            currentOrder={chatState.currentOrder}
            chatId={activeChatId}
          />
        );
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
          onConfirm={(reason) => {
            if (activeModal === 'cancelOrder' && socket && selectedUser?._id) {
              const chatId = `user-${selectedUser._id}-runner-${runnerId}`;
              const orderId = currentOrderRef.current?.orderId;
              console.log("order id to emit cancel", orderId)
              socket.emit('cancelOrder', {
                chatId,
                orderId,
                runnerId,
                userId: selectedUser._id,
                reason,
              });
            }
            setActiveModal(null);
          }}
          isConnectLocked={isConnectLocked} selectedUser={selectedUser}
          currentOrder={currentChatState.currentOrder}
          registrationComplete={registrationComplete} darkMode={dark} />
      )}

      <TermsAcceptanceModal isOpen={showTerms} onClose={() => { }}
        onAccept={handleAcceptTerms} terms={RUNNER_TERMS} darkMode={dark} userType="runner" />

      {/* user gets banned */}
      <BannedModal
        isOpen={showBannedModal}
        reason={verificationState?.reason || verificationState?.message || null}
        darkMode={dark}
      />
    </div>
  );
}


// ─── ContactInfo ─────────────────────────────────────────────────────────────
function ContactInfo({
  contact, onClose, setActiveModal, onNavigate, onBack, chatId,
  serviceType, kycStep, isChatActive,
  messages = [], isBotMode, onStartNewOrder, registrationComplete, isConnectLocked, isVerified
}) {
  // Reads live from store — re-renders the instant store updates
  const currentOrder = useOrderStore(s => s.getChat(chatId).currentOrder);

  const taskCompleted = useOrderStore(s => s.getChat(chatId).taskCompleted);
  const orderCancelled = useOrderStore(s => s.getChat(chatId).orderCancelled);

  const handleModalClick = (modalType) => { onClose?.(); setActiveModal?.(modalType); };
  const handleNavigation = (view) => { onClose?.(); onNavigate?.(view); };

  const isRunErrand =
    serviceType === "run-errand" || serviceType === "run_errand" ||
    currentOrder?.serviceType === "run-errand" || currentOrder?.serviceType === "run_errand" ||
    currentOrder?.taskType === "run_errand" || currentOrder?.taskType === "run-errand";

  const isTerminalOrder =
    currentOrder != null &&
    (['cancelled', 'completed', 'task_completed'].includes(currentOrder.status) ||
      taskCompleted || orderCancelled);

  // const isPaid = currentOrder?.paymentStatus === 'paid' ||
  //   messages.some(m => m.type === 'system' && m.text?.toLowerCase().includes('made payment for this task'));


  const canCancel = isChatActive && currentOrder != null && !isTerminalOrder;
  const showPayout = isRunErrand && isChatActive && currentOrder != null;
  const showStartNewOrder = isBotMode === true && contact?.isBot === true;
  const startNewOrderDisabled = kycStep < 6 || !isVerified || isConnectLocked;
  const canRaiseDispute = isChatActive

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
        <div
          className={orderCancelled ? 'opacity-40 pointer-events-none' : 'cursor-pointer hover:bg-gray-200 dark:hover:bg-black-200 transition-colors'}
          onClick={!orderCancelled ? () => handleNavigation('payout') : undefined}
        >
          <h3 className="px-4 py-5 font-bold text-md text-black-200 dark:text-gray-300">Payout</h3>
        </div>
      )}

      {showStartNewOrder && (
        <div
          onClick={() => {
            if (!startNewOrderDisabled)
              onClose?.();
            onStartNewOrder?.();
          }}
          className={startNewOrderDisabled ? 'opacity-40 pointer-events-none' : 'cursor-pointer hover:bg-gray-200 dark:hover:bg-black-200 transition-colors'}
        >
          <h3 className="px-4 py-5 font-bold text-md text-black-200 dark:text-gray-300">
            {isConnectLocked
              ? 'Ongoing Order — cancel or complete current order to start new'
              : !isVerified
                ? 'Complete verification to start orders'
                : 'Start new order'}
          </h3>
        </div>
      )}

      {canRaiseDispute && (
        <div
          className="cursor-pointer hover:bg-gray-200 dark:hover:bg-black-200 transition-colors"
          onClick={() => handleNavigation('disputes')}
        >
          <p className="px-4 py-5 text-md font-medium text-red-400">Raise dispute</p>
        </div>
      )}

      {canCancel && (
        <div
          className={orderCancelled ? 'opacity-40 pointer-events-none' : 'cursor-pointer hover:bg-gray-200 dark:hover:bg-black-200 transition-colors'}
          onClick={!orderCancelled ? () => handleModalClick('cancelOrder') : undefined}
        >
          <p className="px-4 py-5 text-md font-medium text-red-400">Cancel order</p>
        </div>
      )}
    </div>
  );
}

export default function WhatsAppLikeChatRoot() {
  const { runner } = useSelector((s) => s.auth);
  const key = runner?._id ?? 'no-runner';
  return <WhatsAppLikeChat key={key} />;
}