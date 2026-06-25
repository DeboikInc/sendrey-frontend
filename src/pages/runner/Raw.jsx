/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { IconButton, Drawer } from "@material-tailwind/react";
import { Menu, MoreHorizontal, X, Sun, Moon } from "lucide-react";
import { Modal } from "../../components/common/Modal";
import { useDispatch, useSelector, shallowEqual } from "react-redux";
import { shallow } from 'zustand/shallow';
import RunnerChatScreen from "../../components/runnerScreens/RunnerChatScreen";
import OnboardingScreen from "../../components/runnerScreens/OnboardingScreen";
import Sidebar from "../../components/runnerScreens/Sidebar";
import { updateRunner } from '../../Redux/authSlice';

import { useSocket } from "../../hooks/useSocket";
import useDarkMode from "../../hooks/useDarkMode";
import { useRunnerChatHandlers } from '../../hooks/useRunnerChatHandlers';
import { useRunnerSocketHandlers } from '../../hooks/useRunnerSocketHandlers';

import chatManager from '../../utils/chatStateManager';
import { enqueueSocketEvent } from '../../utils/socketQueue';
import { authStorage } from '../../utils/authStorage';

import { getPersistedReturningKycStatus } from '../../utils/returningUserKycUtils';
import api from '../../utils/api';

// import PhoneVerificationPrompt from "../../components/common/PhoneVerificationPrompt";
import { Profile } from './Profile';
import { Wallet } from './Wallet';
import { Orders } from './Orders';
import { Payout } from './Payout';
import { Disputes } from './Disputes';

import { usePushNotifications, RUNNER_ORDER_TYPES } from "../../hooks/usePushNotifications";
import { useCredentialFlow } from "../../hooks/useCredentialFlow";
import { useKycHook } from '../../hooks/useKycHook';
import { useCameraHook } from "../../hooks/useCameraHook";
import { useCallHook } from "../../hooks/useCallHook";
import { useMessageQueue } from '../../hooks/useMessageQueue';

import TermsAcceptanceModal from '../../components/common/TermsAcceptanceModal';
import { RUNNER_TERMS } from '../../constants/terms';
import { fetchOrderByChatId } from '../../Redux/orderSlice';
import BannedModal from '../../components/runnerScreens/BannedModal';
import useOrderStore from '../../store/orderStore';

// ─── Initial bot messages ────────────────────────────────────────────────────
const INITIAL_BOT_MESSAGES = [
  { id: 1, from: "them", text: "Welcome!", time: "12:24 PM", status: "read" },
  { id: 2, from: "them", text: "Hi! I'm Sendrey Assistant 👋 ", time: "12:25 PM", status: "delivered" },
  // { id: 3, from: "them", text: "Would you like like to run a pickup or run an errand?", time: "12:25 PM", status: "delivered" },
];

const BOT_CHAT_ID = 'sendrey-bot';

const EMPTY_STATUSES = [];

const selectBotMessages = (s) => s._chats[BOT_CHAT_ID]?.messages ?? EMPTY_STATUSES;
const makeTaskCompleted = (id) => (s) => id ? (s._chats[id]?.taskCompleted ?? false) : false;
const makeCompletedStat = (id) => (s) => id ? (s._chats[id]?.completedStatuses ?? EMPTY_STATUSES) : EMPTY_STATUSES;
const makeCurrentOrder = (id) => (s) => id ? (s._chats[id]?.currentOrder ?? null) : null;
const makeOrderCancelled = (id) => (s) => id ? (s._chats[id]?.orderCancelled ?? false) : false;
const makeCompletedStats = (id) => (s) => id ? (s._chats[id]?.completedStatuses ?? EMPTY_STATUSES) : EMPTY_STATUSES;

const selectIsConnectLocked = (s) => {
  const chats = s._chats;
  for (const chatId in chats) {
    const chat = chats[chatId];
    if (!chat.currentOrder) continue;
    if (chat.taskCompleted || chat.orderCancelled) continue;
    const status = chat.currentOrder.status;
    if (!['completed', 'cancelled', 'task_completed'].includes(status)) return true;
  }
  return false;
};


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

  const saved = JSON.parse(localStorage.getItem('runner_ui') || '{}');

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
    const isReturning = !!runner?._id; // runner exists in store = authenticated returning user
    const savedChats = isReturning ? (saved.chatHistory || []) : [];
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
  const [awaitingChatReady, setAwaitingChatReady] = useState(false);
  const [chatSessionKey, setChatSessionKey] = useState(0);

  // ── Runner identity ─────────────────────────────────────────────────────────
  const [runnerId, setRunnerId] = useState(() => runner?._id || null);
  const runnerIdRef = useRef(null);
  const [runnerLocation, setRunnerLocation] = useState(null);

  const [selectedUser, setSelectedUser] = useState(saved.selectedUser || null);

  // ── Global state that the current chat screen reads from the chatManager ─────────
  // Each child screen manages its own copy from the chatmanager.
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
  const [showNotifications, setShowNotifications] = useState(false);

  // ── Refs ────────────────────────────────────────────────────────────────────
  const pendingChatSwitchRef = useRef(null);
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
    isVerifyingOtp
  } = useCredentialFlow(serviceTypeRef, (rd, serverKycStatus) => {
    setRunnerId(rd._id || rd.id);
    isFreshRegistrationRef.current = true;
    sessionStorage.setItem(`fresh_reg_${runnerId}`, 'true');

    if (serverKycStatus?.overallVerified || serverKycStatus?.selfieVerified) {
      isFreshRegistrationRef.current = false; // not a fresh reg
      setTimeout(() => {
        resumeKycFlow(serverKycStatus, botMessagesUpdater);
      }, 100);
    }

  });

  const effectiveReturningKycStatus = useMemo(() => {
    // Live value from this session's credential flow
    if (returningUserData?.kycStatus) return returningUserData.kycStatus;
    // Fallback: persisted from a previous session — survives refresh
    if (runner?.email) return getPersistedReturningKycStatus(runner.email);
    return null;
  }, [returningUserData?.kycStatus, runner?.email]);

  // ── Chat routing state ──────────────────────────────────────────────────────
  // activeChatId drives which screen is shown and which chatManager slot is active.
  // 'sendrey-bot' = onboarding screen. Any other value = RunnerChatScreen.
  const [activeChatId, setActiveChatId] = useState(
    (runner?._id || registrationComplete)
      ? (saved.activeChatId || BOT_CHAT_ID)
      : BOT_CHAT_ID
  );

  const orderStoreRef = useRef(useOrderStore.getState());
  const chatIdForStore = activeChatId !== BOT_CHAT_ID ? activeChatId : null;

  const taskSel = useMemo(() => makeTaskCompleted(chatIdForStore), [chatIdForStore]);
  const statusSel = useMemo(() => makeCompletedStat(chatIdForStore), [chatIdForStore]);

  const taskCompletedFromStore = useOrderStore(taskSel);
  const completedStatusesFromStore = useOrderStore(statusSel, shallow);
  const botStoreMessages = useOrderStore(selectBotMessages);

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
    toggleSpeaker, switchCamera: switchCallCamera, isConnecting, callError,
  } = useCallHook({
    socket,
    chatId: selectedUser?._id ? `user-${selectedUser._id}-runner-${runnerId}` : null,
    currentUserId: runnerId,
    currentUserType: "runner",
  });

  const botMessagesUpdater = useCallback((updater) => {
    const next = chatManager.updateMessages(BOT_CHAT_ID, updater);
    // ← only push if bot screen is actually registered
    if (activeChatIdRef.current === BOT_CHAT_ID &&
      activeScreenIdRef.current === BOT_CHAT_ID &&
      activeSetMessagesRef.current) {
      activeSetMessagesRef.current(next);
    }
    useOrderStore.getState().setMessages(BOT_CHAT_ID, next);

    if (runnerId) {
      try {
        localStorage.setItem(`bot_messages_${runnerId}`, JSON.stringify(next.slice(-60)));
      } catch (_) { }
    }
  }, []);

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const isBotMode = activeChatId === BOT_CHAT_ID;

  // FIRE-AND-FORGET: Instant UI + async store sync
  const pushToActiveScreen = useCallback((updater) => {
    // 
    if (activeSetMessagesRef.current) {
      try {
        activeSetMessagesRef.current(updater);
      } catch (e) {
        console.warn('[pushToActiveScreen] UI failed:', e);
      }
    }

    //  ASYNC STORE SYNC (non-blocking)
    queueMicrotask(() => {
      const chatId = activeChatIdRef.current;
      if (chatId && chatId !== BOT_CHAT_ID) {
        chatManager.updateMessages(chatId, updater);
        useOrderStore.getState().setMessages(chatId, chatManager.get(chatId).messages);
      }
    });
  }, []);

  const {
    handleBotClick, handleUserClick, handlePickService,
    handleStartNewOrder, handleBackToHome, handleOrderStatusClick,
    handleSetCompletedStatuses, handleConnectToService,
    handleFindMore, handleNewOrderFleetSelected,
  } = useRunnerChatHandlers({
    runnerId, runnerIdRef, selectedUserRef, activeChatIdRef,
    activeScreenIdRef, activeSetMessagesRef, currentOrderRef,
    fleetTypeRef, searchIntervalRef, pendingChatSwitchRef,
    setActiveChatId, setSelectedUser, setActive, setChatHistory,
    setOrderPending, setCompletedStatusesVersion, setHasSearched,
    setIsLoadingArchive, setAwaitingChatReady, setChatSessionKey,
    setVerificationState, setNewOrderTrigger, setBotRefreshTrigger,
    setSilentRefreshKey, setRunnerLocation,
    socket, isConnected, joinRunnerRoom,
    botMessagesUpdater, runnerData, runnerLocation,
  });

  useRunnerSocketHandlers({
    socket, runnerId, runnerIdRef, selectedUserRef,
    activeChatIdRef, currentOrderRef, pushToActiveScreen,
    setOrderPending, setCompletedStatusesVersion, setAwaitingChatReady,
  });

  // push notification handling
  const { permission, requestPermission } = usePushNotifications({
    userId: runnerId,
    userType: 'runner',
    socket,
    onIncomingCall: useCallback((data) => {
      // data = { callId, chatId, callType, callerId, callerType, channelName, token }
      // acceptCall from useCallHook handles joining the Agora channel
      acceptCall(data);
    }, [acceptCall]),

    onNotificationTap: useCallback((data) => {
      if (data?.type === 'new_request_nearby') {
        setActiveChatId(BOT_CHAT_ID);
        setSelectedUser(null);
        setShowNotifications(true);
        return;
      }

      if (data?.type === 'kyc_document_approved' ||
        data?.type === 'kyc_document_rejected' ||
        data?.type === 'kyc_selfie_approved' ||
        data?.type === 'kyc_nin_submitted' ||
        data?.type === 'kyc_license_submitted' ||
        data?.type === 'kyc_selfie_submitted') {
        setActiveChatId(BOT_CHAT_ID);
        setSelectedUser(null);
        setCurrentView('chat');
        return;
      }

      // ── Order flow ────────────────────────────────────────────────────────
      if (RUNNER_ORDER_TYPES.includes(data?.type)) {
        // Notification arrived late — runner not in active chat, do nothing
        if (isBotMode) return;

        // Already on chat screen, socket state is live — just ensure views are correct
        setCurrentView('chat');
        return;
      }

      if (data?.type === 'dispute_raised' || data?.type === 'dispute_resolved') {
        setCurrentView('disputes');
        return;
      }

      if (data?.type === 'withdrawal_requested' || data?.type === 'withdrawal_released') {
        setCurrentView('wallet');
        return;
      }
    }, [isBotMode]),
  });

  const chatMessagesUpdater = useCallback((updater) => {
    const chatId = activeChatIdRef.current;
    if (chatId === BOT_CHAT_ID) return; // ← never write chat messages to bot slot
    const next = chatManager.updateMessages(chatId, updater);
    // ← only push if the correct chat screen is registered
    if (activeScreenIdRef.current === chatId && activeSetMessagesRef.current) {
      activeSetMessagesRef.current(next);
    }
    useOrderStore.getState().setMessages(chatId, next);
  }, []);

  const handleMessageStatusUpdate = useCallback((idOrTempId, status, realId) => {
    chatMessagesUpdater(prev => prev.map(m => {
      if (m.id !== idOrTempId && m.tempId !== idOrTempId) return m;
      return {
        ...m,
        status,
        ...(realId && m.id === idOrTempId ? { id: realId, tempId: undefined } : {}),
      };
    }));
  }, [chatMessagesUpdater]);

  const { enqueue } = useMessageQueue({
    socket,
    isConnected,
    chatId: activeChatIdRef.current,
    sendMessage,
    enabled: true,
    onStatusUpdate: handleMessageStatusUpdate,
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

  useEffect(() => {
    runnerIdRef.current = runnerId;
    if (!runnerId) {
      kycStartedRef.current = false;
    }
  }, [runnerId]);

  useEffect(() => {
    if (!chatHistory.length) return;
    localStorage.setItem('runner_ui', JSON.stringify({
      activeChatId,
      selectedUser,
      active,
      currentView,
      serviceType,
      chatHistory: chatHistory.filter(c => c.id !== BOT_CHAT_ID),
    }));
  }, [activeChatId, selectedUser, active, currentView, serviceType, chatHistory]);


  useEffect(() => {
    if (runnerId && socket && permission !== 'denied') requestPermission();
  }, [runnerId, socket, permission, requestPermission]);

  useEffect(() => {
    const unsub = useOrderStore.subscribe(s => { orderStoreRef.current = s; });
    return unsub;
  }, []);

  useEffect(() => {
    if (!saved.selectedUser || !saved.activeChatId || saved.activeChatId === BOT_CHAT_ID) return;
    if (!runner?._id && !registrationComplete) return;

    selectedUserRef.current = saved.selectedUser;
    const savedEntry = (saved.chatHistory || []).find(c => c.userId === saved.selectedUser._id);
    if (savedEntry) setActive(savedEntry);

    setActiveChatId(saved.activeChatId);
    setSelectedUser(saved.selectedUser);

    const storedMsgs = useOrderStore.getState().getChat(saved.activeChatId).messages ?? [];
    if (storedMsgs.length > 0) {
      chatManager.set(saved.activeChatId, { messages: storedMsgs });
    }

    // only switch away from bot if we actually have order state
    //  let the socket rejoin flow handle it
    const storedOrder = useOrderStore.getState().getChat(saved.activeChatId).currentOrder;
    if (storedOrder && !['completed', 'cancelled', 'task_completed'].includes(storedOrder.status)) {
      setActiveChatId(saved.activeChatId);
      console.log('[AWAIT CLEAR] session restore effect');
      setAwaitingChatReady(true); // show loading overlay while socket reconnects
    }

    // If no order state, stay on bot — socket will proceedToChat when ready
  }, [runner?._id, registrationComplete]);


  useEffect(() => {
    // Run as soon as we have any runner identity, not just after auth
    const { _chats } = useOrderStore.getState();
    for (const [chatId, chatData] of Object.entries(_chats)) {
      const msgs = chatData.messages ?? [];
      if (msgs.length > 0) {
        chatManager.set(chatId, { messages: msgs });
      }
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


  // 
  useEffect(() => {
    console.log('[RAW] silentRefreshKey changed', silentRefreshKey);
  }, [silentRefreshKey]);

  // ── KYC started effect ───────────────────────────────────────────────────────



  // REPLACE the existing KYC started effect with:

  useEffect(() => {
    console.log('[KYC TRIGGER] deps fired:', {
      registrationComplete,
      runnerId,
      needsOtpVerification,
      isCollectingCredentials,
      isReturningUser,
      kycOverallVerified: kycStatus.overallVerified,
      kycStep,
      isFreshReg: isFreshRegistrationRef.current,
      runnerIsVerified: runner?.isVerified,
      kycStatus: runner?.kycStatus,
      kycFlowStartedLS: localStorage.getItem(`kyc_flow_started_${runnerId}`),
      returningUserData: returningUserData?.kycStatus ?? null,
    });

    if (!runnerId) return;
    const isFreshReg = isFreshRegistrationRef.current || sessionStorage.getItem(`fresh_reg_${runnerId}`) === 'true';
    if (!registrationComplete && !isFreshReg) { console.log('[RAW] KYC BLOCKED — not registered and not fresh reg'); return; }
    if (needsOtpVerification) { console.log('[RAW] KYC effect BLOCKED — needsOtpVerification'); return; }
    if (isCollectingCredentials) { console.log('[RAW] KYC effect BLOCKED — isCollectingCredentials'); return; }
    if (kycStartedRef.current) { console.log('[RAW] KYC effect BLOCKED — kycStartedRef already true'); return; }
    if (kycStatus.overallVerified || kycStep === 6) { console.log('[RAW] KYC effect BLOCKED — already verified'); return; }
    if (isReturningUser) { console.log('[RAW] KYC effect BLOCKED — isReturningUser still true (waiting for choice)'); return; }

    if (runner?.isVerifiedKyc && !isFreshRegistrationRef.current) {
      console.log('[RAW] KYC effect BLOCKED — runner already verified server-side (preexisting session)');
      kycStartedRef.current = true;
      localStorage.setItem(`kyc_flow_started_${runnerId}`, 'true');
      localStorage.setItem(`kyc_verified_shown_${runnerId}`, '1');
      chatManager.set(BOT_CHAT_ID, { kycStep: 1 });
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
      sessionStorage.removeItem(`fresh_reg_${runnerId}`);

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

  const loadPersistedBotMessages = (runnerId) => {
    if (!runnerId) return [];
    try {
      const stored = localStorage.getItem(`bot_messages_${runnerId}`);
      return stored ? JSON.parse(stored) : [];
    } catch (_) { return []; }
  };

  useEffect(() => {
    // Check store first 
    const storedMsgs = useOrderStore.getState().getChat(BOT_CHAT_ID).messages;
    if (storedMsgs.length > 0) {
      chatManager.set(BOT_CHAT_ID, { messages: storedMsgs });
      return;
    }

    if (runnerId) {
      const persisted = loadPersistedBotMessages(runnerId);
      if (persisted.length > 0) {
        // If congrats message already exists in history, mark it shown
        if (persisted.some(m => m.text?.includes('Congratulations'))) {
          localStorage.setItem(`kyc_verified_shown_${runnerId}`, '1');
        }
        chatManager.set(BOT_CHAT_ID, { messages: persisted });
        useOrderStore.getState().setMessages(BOT_CHAT_ID, persisted);
        setInitialMessagesComplete(true);
        return;
      }
    }

    const botState = chatManager.get(BOT_CHAT_ID);
    if (botState.messages.length > 0) return; // already has messages, don't re-run

    const t1 = setTimeout(() => {
      if (activeChatIdRef.current !== BOT_CHAT_ID) return;
      const s = chatManager.get(BOT_CHAT_ID);
      if (s.messages.length === 0) {
        botMessagesUpdater([INITIAL_BOT_MESSAGES[0]]);
      }
    }, 0);

    const t2 = setTimeout(() => {
      if (activeChatIdRef.current !== BOT_CHAT_ID) return;
      const s = chatManager.get(BOT_CHAT_ID);
      if (s.messages.length === 1) {
        botMessagesUpdater([...s.messages, INITIAL_BOT_MESSAGES[1]]);
      }
      setTimeout(() => {
        setInitialMessagesComplete(true);
      }, 300);

    }, 700);

    return () => { clearTimeout(t1); clearTimeout(t2); /* clearTimeout(t3); */ };
  }, [runnerId]); // run once only

  // Ban listener
  useEffect(() => {
    if (!socket || !runnerId) return;

    const handleAlert = (msg) => {
      pushToActiveScreen(prev => [...prev, msg]);
      const chatId = activeChatIdRef.current;
      chatManager.updateMessages(chatId, prev => [...prev, msg]);
    };

    socket.on('runnerSystemAlert', handleAlert);
    return () => socket.off('runnerSystemAlert', handleAlert);
  }, [socket, runnerId, pushToActiveScreen]);

  // watch for runner becoming null
  useEffect(() => {
    if (!runner?._id && !runnerId) return; // not authenticated, nothing to clear
    if (runner?._id) return; // still authenticated, do nothing

    // runner just became null — auth was wiped
    chatManager.set(BOT_CHAT_ID, { messages: [] });
    useOrderStore.getState().setMessages(BOT_CHAT_ID, []);
    setInitialMessagesComplete(false);
    // Clear any stale runnerId-keyed localStorage
    if (runnerId) {
      localStorage.removeItem(`bot_messages_${runnerId}`);
      localStorage.removeItem(`kyc_flow_started_${runnerId}`);
      localStorage.removeItem(`kyc_step_${runnerId}`);
      localStorage.removeItem(`kyc_doc_type_${runnerId}`);
      localStorage.removeItem(`terms_accepted_${runnerId}`);
      localStorage.removeItem(`kyc_status_${runnerId}`);
    }

    useOrderStore.getState()._reset();
    localStorage.removeItem('sendrey-order-store');
    setRunnerId(null);
  }, [runner?._id]);

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
      const timer = setTimeout(() => setCanResendOtp(true), 30000); // 30s
      return () => clearTimeout(timer);
    }
  }, [needsOtpVerification]);


  useEffect(() => {
    if (!registrationComplete) return;
    setChatHistory(prev => {
      const savedChats = saved.chatHistory || [];
      const existingIds = new Set(prev.map(c => c.id));
      const toAdd = savedChats.filter(c => !existingIds.has(c.id));
      return toAdd.length ? [...prev, ...toAdd] : prev;
    });
  }, [registrationComplete]);

  // ── Socket: runner joins chat after proceedToChat ─────────────────────────
  useEffect(() => {
    console.log('[raw JOIN EFFECT] selectedUser:', selectedUser?._id,
      'isReconnect:', chatManager.get(`user-${selectedUser?._id}-runner-${runnerId}`)?.messages?.length > 0,
      'socket.connected:', socket?.connected,
    );
    console.log('[raw JOIN EFFECT] activeChatId state:', activeChatId,
      'activeChatIdRef:', activeChatIdRef.current
    );

    if (!selectedUser || !socket || selectedUser.isBot) return;

    const chatId = `user-${selectedUser._id}-runner-${runnerId}`;
    let joined = false;
    let fallbackTimer;

    const handleChatHistory = async (msgs) => {
      if (activeChatIdRef.current !== chatId) return;

      let latestOrder = null;

      console.log('[CHAT HISTORY] fetchOrderByChatId result:', latestOrder?.orderId, 'store after merge:', useOrderStore.getState()._chats[chatId]?.currentOrder?.orderId);

      if (activeChatIdRef.current === chatId) {
        console.log('[AWAIT CLEAR] handleChatHistory');
        setAwaitingChatReady(false);
      }

      try {
        const result = await dispatch(fetchOrderByChatId(chatId)).unwrap();
        if (result) {
          latestOrder = result?.data ?? result;
          const isTerminal = ['cancelled', 'completed', 'task_completed'].includes(latestOrder?.status);
          if (!isTerminal) {
            currentOrderRef.current = latestOrder;
            chatManager.set(chatId, { currentOrder: latestOrder });
            useOrderStore.getState().mergeCurrentOrder(chatId, latestOrder);

            console.log('[raw handleChatHistory] after mergeCurrentOrder, store slot:',
              useOrderStore.getState()._chats[chatId]?.currentOrder?.orderId,
              'activeChatId in store:', useOrderStore.getState().activeChatId
            );
          }
        }
      } catch (_) { }

      if (!latestOrder) {
        console.warn('[handleChatHistory] no order on first fetch — retrying in 2s');
        await new Promise(r => setTimeout(r, 2000));
        try {
          const retry = await dispatch(fetchOrderByChatId(chatId)).unwrap();
          if (retry) latestOrder = retry?.data ?? retry;
          console.log('[handleChatHistory] retry result:', latestOrder?.orderId);
        } catch (_) { }
      }

      console.log('[CHAT HISTORY] fetchOrderByChatId result:', latestOrder?.orderId);

      if (!msgs?.length) return;

      const isTerminalOrder = ['completed', 'cancelled', 'task_completed'].includes(latestOrder?.status);
      const seenPayment = new Set();

      const filtered = msgs.filter(msg => {
        if (isTerminalOrder) {
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
        const isSys = msg.from === 'system' || msg.type === 'system'
          || msg.messageType === 'system' || msg.senderType === 'system'
          || msg.senderId === 'system';
        return {
          ...msg,
          from: isSys ? 'system' : (msg.senderId === runnerId ? 'me' : 'them'),
          type: msg.type || msg.messageType || 'text',
        };
      });

      chatManager.set(chatId, { messages: formatted });


      if (activeChatIdRef.current === chatId) {
        if (activeSetMessagesRef.current) {
          activeSetMessagesRef.current(formatted);
        } else {
          let attempts = 0;
          const tryPush = () => {
            attempts++;
            if (activeSetMessagesRef.current && activeChatIdRef.current === chatId) {
              activeSetMessagesRef.current(formatted);
            } else if (attempts < 10) {
              setTimeout(tryPush, 100);
            }
          };
          setTimeout(tryPush, 100);
        }
      }

      const lastRealMsg = [...formatted].reverse().find(
        m => m.from !== 'system' && m.type !== 'system' && m.messageType !== 'system'
      );
      if (lastRealMsg) {
        setChatHistory(prev => prev.map(c =>
          c.userId === selectedUser._id
            ? { ...c, lastMessage: lastRealMsg.text?.substring(0, 30) || '', time: lastRealMsg.time || '' }
            : c
        ));
      }

      const isCompleted = formatted.some(m =>
        m.type === 'task_completed' || m.messageType === 'task_completed'
        || (m.type === 'system' && m.text?.toLowerCase().includes('task completed'))
      );
      if (isCompleted) {
        chatManager.set(chatId, { taskCompleted: true });
        useOrderStore.getState().setTaskCompleted(chatId, true);
      }

      const cancelMsg = formatted.find(m =>
        m.type === 'system' && m.text?.toLowerCase().includes('cancelled this order')
      );
      if (cancelMsg) {
        const by = cancelMsg.text?.split(' ')[0] || 'Runner';
        chatManager.set(chatId, { orderCancelled: true, cancellationReason: by });
        useOrderStore.getState().setOrderCancelled(chatId, by);
      }

    };

    const doJoin = () => {
      if (joined) {
        console.log('[RAW doJoin] BLOCKED — already joined');
        return;
      }

      joined = true;
      console.log('[RAW doJoin] emitting runnerJoinChat', { chatId, runnerId, socketId: socket?.id });

      clearTimeout(fallbackTimer);
      socket.off('proceedToChat', handleProceedToChat);
      socket.emit('runnerJoinChat', {
        runnerId,
        userId: selectedUser._id,
        chatId,
        serviceType: selectedUser.serviceType ?? selectedUser.currentRequest?.serviceType ?? null,
      });
    };

    const handleProceedToChat = (data) => {
      if (data.chatId !== chatId || !data.chatReady) return;
      console.log('[raw.jsx] proceedToChat received, isRefresh:', data.isRefresh);

      if (data.isRefresh) {
        // Stale order — wipe before rejoining
        chatManager.set(chatId, {
          messages: [],
          currentOrder: null,
          taskCompleted: false,
          orderCancelled: false,
          cancellationReason: null,
          completedOrderStatuses: [],
          deliveryMarked: false,
          userConfirmedDelivery: false,
        });
        useOrderStore.getState()._patch(chatId, {
          currentOrder: null,
          taskCompleted: false,
          orderCancelled: false,
          cancellationReason: null,
          completedStatuses: [],
          deliveryMarked: false,
          userConfirmedDelivery: false,
        });
        currentOrderRef.current = null;
      }

      joined = false; // allow re-join
      doJoin();
    };

    const handleSessionRefreshOk = ({ chatId: inc, orderChanged }) => {
      if (inc !== chatId) return;
      console.log('[raw.jsx] sessionRefreshOk — rejoining');

      if (orderChanged) {
        // Order changed while offline — full rejoin
        joined = false;
        doJoin();
      } else {
        // Same order — just rejoin rooms without re-fetching history
        socket.emit('runnerJoinChat', {
          chatId,
          runnerId,
          userId: selectedUser._id,
          serviceType: selectedUser.serviceType ?? selectedUser.currentRequest?.serviceType ?? null,
        });
      }
    };

    const handleReconnect = () => {
      console.log('[RAW handleReconnect] fired', { chatId, socketId: socket?.id });

      // Always rejoin runner room — lost on reconnect
      socket.emit('joinRunnerRoom', {
        runnerId,
        serviceType: selectedUser?.serviceType ?? null,
      });

      const orderId = currentOrderRef.current?.orderId;
      if (orderId) {
        socket.emit('requestSessionRefresh', {
          chatId,
          orderId,
          userId: runnerId,
          userType: 'runner',
        });
      } else {
        joined = false;
        doJoin();
      }
    };

    const isReconnect = chatManager.get(chatId).messages.length > 0;

    if (isReconnect) {
      doJoin();
    } else {
      socket.on('proceedToChat', handleProceedToChat);
      fallbackTimer = setTimeout(() => {
        console.warn('[raw.jsx] proceedToChat timeout — joining directly');
        doJoin();
      }, 5000);
    }

    socket.on('chatHistory', handleChatHistory);
    socket.on('sessionRefreshOk', handleSessionRefreshOk);
    socket.on('connect', handleReconnect);

    return () => {
      clearTimeout(fallbackTimer);
      socket.off('proceedToChat', handleProceedToChat);
      socket.off('chatHistory', handleChatHistory);
      socket.off('sessionRefreshOk', handleSessionRefreshOk);
      socket.off('connect', handleReconnect);
    };
  }, [selectedUser?._id, socket, runnerId, dispatch, chatSessionKey]);


  // ── Runner room join ─────────────────────────────────────────────────────────
  useEffect(() => {
    console.log("raw CALLING JOIN RUNNER ROOM....")
    if (!registrationComplete || !runnerId || !socket) return;
    if (!socket.connected) return;
    joinRunnerRoom(runnerId, null);

    console.log("raw JOIN RUNNER ROOM called", socket.connected ? true : false,)
  }, [registrationComplete, runnerId, socket, joinRunnerRoom]);

  useEffect(() => {
    if (socket && runnerId && registrationComplete) {
      if (socket.connected) {
        socket.emit('rejoinUserRoom', { userId: runnerId, userType: 'runner' });
      }
    }
  }, [socket, runnerId, registrationComplete]);

  // ── Verification status ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !runnerId) return;
    const handler = (data) => {
      console.log("🔵 [SOCKET RECEIVED] verificationStatus event:", data);
      console.log("Verification Data", data)

      setVerificationState(data);
      if (data.isBanned) setShowBannedModal(true);

      // sync Redux so isVerified prop updates instantly
      if (data.isVerifiedKyc === true) {
        dispatch(updateRunner({
          isVerifiedKyc: true,
          kycStatus: data.kycStatus
        }));

        if (isBotMode) {
          checkVerificationStatus(botMessagesUpdater, () => { }, false);
        } else {
          checkVerificationStatus(chatMessagesUpdater, () => { }, false);
        }
      } else if (data.isVerifiedKyc === false) {
        dispatch(updateRunner({
          isVerifiedKyc: false,
          kycStatus: data.kycStatus
        }));
      }

      console.log("VERIFICATION result", data.isVerifiedKyc, data.kycStatus)
    };
    socket.on('verificationStatus', handler);
    return () => socket.off('verificationStatus', handler);
  }, [socket, runnerId]);

  useEffect(() => {
    if (!activeChatId || activeChatId === BOT_CHAT_ID) return;
    const { getChat } = useOrderStore.getState(); // eslint-disable-line no-unused-vars
    // Subscribe to store changes and keep the ref in sync
    const unsub = useOrderStore.subscribe(
      (state) => state._chats[activeChatId]?.currentOrder ?? null,
      (order) => { currentOrderRef.current = order; }
    );
    return unsub;
  }, [activeChatId]);

  // sync  whenever activeChatId changes
  useEffect(() => {
    if (activeChatId && activeChatId !== BOT_CHAT_ID) {
      useOrderStore.getState().setActiveChatId(activeChatId);
    } else {
      useOrderStore.getState().setActiveChatId(null);
    }
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

  // grace useEffect for expired token mid order 
  useEffect(() => {
    if (!runner?._id || !runnerId) return;

    const validateRunnerSession = async () => {
      // Only run if we have a selected user (active chat)
      const savedUI = JSON.parse(localStorage.getItem('runner_ui') || '{}');
      const savedChatId = savedUI.activeChatId;
      if (!savedChatId || savedChatId === BOT_CHAT_ID) return;

      const chatState = useOrderStore.getState().getChat(savedChatId);
      if (chatState.taskCompleted || chatState.orderCancelled) return;

      try {
        const response = await api.post('/sessions/validate', { chatId: savedChatId });
        const { isValid, hasActiveOrder, tokenExpired } = response.data.data;

        if (isValid && hasActiveOrder) {
          console.log('[raw.jsx] Session valid, token expired:', tokenExpired);
          if (tokenExpired) {
            try {
              const { refreshToken } = await authStorage.getTokens();
              const refreshRes = await api.post(
                '/sessions/refresh',
                { chatId: savedChatId, refreshToken },
                { _skipInterceptor: true }
              );
              const { accessToken, refreshToken: newRefresh } = refreshRes.data.data;
              if (accessToken) {
                await authStorage.setTokens(accessToken, newRefresh);
              }
              console.log('[raw.jsx] session refreshed after expired token');

            } catch (_) {
              // Grace access still applies
            }
          }
          // Chat will restore via the existing savedUI restore effect
        } else {
          // No active order — clear stale state for this chatId
          useOrderStore.getState()._patch(savedChatId, {
            currentOrder: null,
            taskCompleted: false,
            orderCancelled: false,
            completedStatuses: [],
            deliveryMarked: false,
          });
          chatManager.set(savedChatId, { currentOrder: null });
        }
      } catch (error) {
        if (error.response?.status === 404) {
          // Confirmed no active order
          useOrderStore.getState()._patch(savedChatId, {
            currentOrder: null,
            taskCompleted: false,
            orderCancelled: false,
            completedStatuses: [],
            deliveryMarked: false,
          });
          chatManager.set(savedChatId, { currentOrder: null });
        }
        // On network error or 401, keep existing state — don't clear
        console.warn('[raw.jsx] Session validation failed:', error.message);
      }
    };

    const timer = setTimeout(validateRunnerSession, 500);
    return () => clearTimeout(timer);
  }, [runnerId, runner?._id]);

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
    setTimeout(() => setCanResendOtp(true), 30000);
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
    const currentText = chatManager.get(activeChatIdRef.current).draft || ''; // eslint-disable-line no-unused-vars
  }, []);

  // text is still held in raw.jsx state to avoid threading issues
  const [text, setText] = useState("");

  const sendMessage_fn = useCallback((replyingTo = null) => {

    if (isBotMode && !isCollectingCredentials && !needsOtpVerification && !registrationComplete) {
      botMessagesUpdater(prev => [...prev, {
        id: Date.now(), from: "me", text: "Get Started",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "sent",
      }]);
      setTimeout(() => startCredentialFlow(null, botMessagesUpdater), 500);
      return;
    }

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
        status: socket?.connected ? "pending" : "queued",
        senderId: currentRunnerId, senderType: "runner", // ← ref
        ...(replyingTo && {
          replyTo: replyingTo.id,
          replyToMessage: replyingTo.text || replyingTo.fileName || "Media",
          replyToFrom: replyingTo.from,
        }),
      };
      chatMessagesUpdater(prev => [...prev, newMsg]);
      setText("");
      if (socket?.connected) {
        sendMessage(chatId, newMsg);
        setChatHistory(prev => prev.map(c =>
          c.id === selectedUser._id
            ? { ...c, lastMessage: text.trim().substring(0, 30), time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }
            : c
        ));
      } else {
        enqueue(newMsg);
      }
    }
  }, [text, isBotMode, isCollectingCredentials, needsOtpVerification, isCollectingCredentials,
    credentialStep, isBotMode, socket, selectedUser, handleOtpVerification, registrationComplete,
    handleCredentialAnswer, sendMessage, botMessagesUpdater, chatMessagesUpdater]);

  const setBotReplyingTo = useCallback((r) => {
    chatManager.set(BOT_CHAT_ID, { replyingTo: r });
  }, []);

  const handleLocationClick = () => setShowOrderFlow(true);
  const handleAttachClick = () => setIsAttachFlowOpen(true);

  // ── Derived ───────────────────────────────────────────────────────────────────
  const isConnectLockedFromStore = useOrderStore(selectIsConnectLocked);
  const isConnectLocked = orderPending || isConnectLockedFromStore;

  // ── Render ────────────────────────────────────────────────────────────────────
  const renderMainScreen = () => {
    console.log('[RENDER] isBotMode:', isBotMode, 'awaitingChatReady:', awaitingChatReady, 'activeChatId:', activeChatId);
    // if (runner && token && !runner.isPhoneVerified) {
    //   return <PhoneVerificationPrompt user={runner} darkMode={dark} toggleDarkMode={() => setDark(!dark)} />;
    // }

    if (isBotMode || awaitingChatReady) {
      const botState = chatManager.get(BOT_CHAT_ID);
      const botMessages = botState.messages.length > 0 ? botState.messages : botStoreMessages;

      return (
        <div className="relative h-full">
          <OnboardingScreen
            key="sendrey-bot"
            // ── Message persistence: pass from chatManager, child owns its own useState
            // initialized from this, and calls onMessagesChange to sync back ──
            initialMessages={botMessages}
            botRefreshTrigger={botRefreshTrigger}
            onMessagesChange={botMessagesUpdater}
            onRegisterSetMessages={registerSetMessages}

            onNewOrderFleetAndServiceSelected={handleNewOrderFleetSelected}
            onStartNewOrder={handleStartNewOrder}
            newOrderTrigger={newOrderTrigger}

            isVerifyingOtp={isVerifyingOtp}

            onReturningUserChoice={(choice) =>
              handleReturningUserChoice(choice, botMessagesUpdater)
            }

            isSubmitting={isSubmitting}
            newOrderComplete={botState.newOrderComplete}
            onSetNewOrderComplete={(val) => {
              chatManager.set(BOT_CHAT_ID, { newOrderComplete: val });
            }}

            isVerified={runner?.isVerifiedKyc ?? false}
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
                },
                isReturningUser
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
            effectiveReturningKycStatus={effectiveReturningKycStatus}
            forceShowNotifications={showNotifications}
            onNotificationsShown={() => setShowNotifications(false)}
          />

          {awaitingChatReady && (
            <div
              className="absolute inset-0 z-[9999] flex flex-col items-center justify-center gap-4"
              style={{ background: 'rgba(0,0,0,0.85)', pointerEvents: 'all' }}
            >
              <div className="relative w-10 h-10">
                {Array.from({ length: 12 }).map((_, i) => (
                  <span key={i} className="absolute w-2 h-2 bg-primary rounded-full animate-fade-dot"
                    style={{ left: "50%", top: "50%", transform: `rotate(${i * 30}deg) translate(0, -16px)`, animationDelay: `${i * 0.1}s` }}
                  />
                ))}
              </div>
              <p className="text-sm font-medium text-gray-300">Preparing chat…</p>
            </div>
          )}
        </div>
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
    const activeChatIdForScreen = activeChatId !== BOT_CHAT_ID ? activeChatId : null;
    const chatState = chatManager.get(chatId);

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
        key={`chat-${selectedUser?._id}`}
        sessionKey={chatSessionKey}
        chatId={activeChatIdForScreen}

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
        setCompletedOrderStatuses={handleSetCompletedStatuses}
        uploadFileWithProgress={uploadFileWithProgress}
        replyingTo={chatState.replyingTo}
        setReplyingTo={(r) => chatManager.set(chatId, { replyingTo: r })}
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
        isConnecting={isConnecting}
        callError={callError}


        toggleMute={toggleMute}
        toggleCamera={toggleCamera}
        isSpeakerOn={isSpeakerOn}
        networkQuality={networkQuality}
        toggleSpeaker={toggleSpeaker}
        runnerFleetType={runnerData?.fleetType}

        completedOrderStatuses={completedStatusesFromStore}
        taskCompleted={taskCompletedFromStore}

        setTaskCompleted={(val) => {
          chatManager.set(chatId, { taskCompleted: val });
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
    const chatState = chatManager.get(activeChatId);
    const disputeActive = chatState.currentOrder?.hasDispute === true;

    return (
      <ContactInfo
        contact={active}
        onClose={withClose ? () => setInfoOpen(false) : undefined}
        setActiveModal={setActiveModal}
        onNavigate={setCurrentView}
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
        disputeActive={disputeActive}
      />
    );
  };

  const renderView = () => {
    const handleBack = () => setCurrentView('chat');
    const chatState = chatManager.get(activeChatId);

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
      case 'disputes': {
        const disputeChatState = chatManager.get(activeChatId);
        // Fall back to store if chatManager already cleared it
        const disputeOrder = disputeChatState.currentOrder
          ?? useOrderStore.getState().getChat(activeChatId)?.currentOrder
          ?? null;
        return (
          <Disputes
            darkMode={dark}
            onBack={handleBack}
            runnerId={runnerId}
            currentOrder={disputeOrder}
            chatId={activeChatId}
          />
        );
      }
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

              // Optimistic — update UI immediately
              const chatId2 = chatId;
              useOrderStore.getState().setOrderCancelled(chatId2, 'runner');
              useOrderStore.getState().mergeCurrentOrder(chatId2, { status: 'cancelled' });
              chatManager.set(chatId2, { orderCancelled: true, cancellationReason: 'runner' });
              pushToActiveScreen(prev => {
                if (prev.some(m => m.text?.toLowerCase().includes('cancelled this order'))) return prev;
                return [...prev, {
                  id: `cancel-optimistic-${Date.now()}`,
                  from: 'system', type: 'system', messageType: 'system',
                  text: 'You cancelled this order.',
                  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  senderId: 'system', senderType: 'system',
                }];
              });

              const cancelPayload = { chatId, orderId, runnerId, userId: selectedUser._id, reason };

              if (socket.connected) {
                socket.emit('cancelOrder', cancelPayload);
              } else {
                // ← Queue it for when connection restores
                enqueueSocketEvent('cancelOrder', cancelPayload);
                console.log('[socketQueue] cancelOrder queued — socket offline');
              }
            }
            setActiveModal(null);
          }}
          chatId={activeChatId}
          isConnectLocked={isConnectLocked} selectedUser={selectedUser}
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
  kycStep, isChatActive,
  messages = [], isBotMode, onStartNewOrder, registrationComplete, isConnectLocked, isVerified,
  disputeActive
}) {
  // Reads live from store — re-renders the instant store updates
  const currentOrderSel = useMemo(() => makeCurrentOrder(chatId), [chatId]);
  const orderCancelledSel = useMemo(() => makeOrderCancelled(chatId), [chatId]);
  const completedStatsSel = useMemo(() => makeCompletedStats(chatId), [chatId])

  const currentOrder = useOrderStore(currentOrderSel);
  const orderCancelled = useOrderStore(orderCancelledSel);

  const handleModalClick = (modalType) => { onClose?.(); setActiveModal?.(modalType); };
  const handleNavigation = (view) => { onClose?.(); onNavigate?.(view); };

  const isRunErrand =
    currentOrder?.serviceType === "run-errand" || currentOrder?.serviceType === "run_errand" ||
    currentOrder?.taskType === "run_errand" || currentOrder?.taskType === "run-errand";

  const canCancel = isChatActive
    && currentOrder != null
    && !['completed', 'cancelled', 'task_completed'].includes(currentOrder.status)
    && !orderCancelled;

  const completedStatuses = useOrderStore(completedStatsSel);


  const itemApproved =
    currentOrder?.approvalStatus === 'approved' ||
    currentOrder?.status === 'items_approved' ||
    completedStatuses?.includes('items_approved') ||
    completedStatuses?.includes('purchase_completed') ||
    completedStatuses?.includes('arrived_at_delivery_location');

  const showPayout = isRunErrand &&
    isChatActive &&
    currentOrder != null &&
    !['completed', 'cancelled', 'task_completed'].includes(currentOrder.status);


  return (
    <div className="h-screen flex flex-col overflow-y-auto gap-6 marketSelection pb-28">
      <div className="py-3 px-2">
        {onClose && (
          <IconButton variant="text" size="sm" className="rounded-full lg:hidden flex" onClick={onClose}>
            <X className="h-7 w-7" />
          </IconButton>
        )}
      </div>

      <div className="cursor-pointer hover:bg-gray-200 dark:hover:bg-black-100/80 transition-colors" onClick={() => handleNavigation('profile')}>
        <h3 className="px-4 py-5 font-bold text-md text-black-200 dark:text-gray-300">Profile</h3>
      </div>
      <div className="cursor-pointer hover:bg-gray-200 dark:hover:bg-black-100/80 transition-colors" onClick={() => handleNavigation('wallet')}>
        <h3 className="px-4 py-5 font-bold text-md text-black-200 dark:text-gray-300">Wallet</h3>
      </div>
      <div className="cursor-pointer hover:bg-gray-200 dark:hover:bg-black-100/80 transition-colors" onClick={() => handleNavigation('orders')}>
        <h3 className="px-4 py-5 font-bold text-md text-black-200 dark:text-gray-300">Orders</h3>
      </div>

      {showPayout && (
        disputeActive ? (
          // Dispute in review — locked
          <div className="opacity-50 pointer-events-none">
            <h3 className="px-4 py-5 font-bold text-md text-red-400">
              Payout locked — dispute in review
            </h3>
          </div>
        ) : !itemApproved ? (

          <div className="opacity-40 pointer-events-none">
            <h3 className="px-4 py-5 font-bold text-md text-black-100/80 dark:text-gray-300">
              Payout
              {currentOrder?.status === 'purchase_completed'
                ? null
                : currentOrder && [
                  'en_route_to_delivery',
                  'arrived_at_delivery_location',
                  'item_delivered',
                ].includes(currentOrder.status)
                  ? (
                    <span className="ml-2 text-[10px] font-normal text-gray-400 normal-case tracking-normal">
                      (already completed)
                    </span>
                  ) : (
                    <span className="ml-2 text-[10px] font-normal text-gray-400 normal-case tracking-normal">
                    </span>
                  )
              }
            </h3>
          </div>
        ) : (
          // purchase_completed — active window, go transfer
          <div
            className={
              orderCancelled
                ? ''
                : 'cursor-pointer hover:bg-gray-200 dark:hover:bg-black-200 transition-colors'
            }
            onClick={!orderCancelled ? () => handleNavigation('payout') : undefined}
          >
            <h3 className="px-4 py-5 font-bold text-md text-black-200 dark:text-gray-300">Payout</h3>
          </div>
        )
      )}

      <div
        className="cursor-pointer hover:bg-gray-200 dark:hover:bg-black-100/80 transition-colors"
        onClick={() => handleNavigation('disputes')}
      >
        <h3 className="px-4 py-5 font-bold text-md text-black-200 dark:text-gray-300">
          {isChatActive && currentOrder && !['completed', 'cancelled', 'task_completed'].includes(currentOrder?.status)
            ? 'Raise dispute'
            : 'Disputes'}
        </h3>
      </div>

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
  const key = 'runner-app';
  const hydrated = useOrderStore(s => s._hasHydrated);

  useEffect(() => {
    console.log('[ROOT] MOUNTED');
    return () => console.log('[ROOT] UNMOUNTED');
  }, []);

  if (!hydrated) return null;
  return <MemoChat key={key} />;
}

const MemoChat = React.memo(WhatsAppLikeChat);