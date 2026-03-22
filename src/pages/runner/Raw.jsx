// raw.jsx (main component)
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  IconButton,
  Drawer,
} from "@material-tailwind/react";
import {
  Menu,
  MoreHorizontal,
  X,
  Sun,
  Moon
} from "lucide-react";
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

// hooks
import { useCredentialFlow } from "../../hooks/useCredentialFlow";
import { useKycHook } from '../../hooks/useKycHook';
import { useCameraHook } from "../../hooks/useCameraHook";
import { useCallHook } from "../../hooks/useCallHook";

import TermsAcceptanceModal from '../../components/common/TermsAcceptanceModal';
import { RUNNER_TERMS } from '../../constants/terms';
import api from '../../utils/api';
import chatStorage from '../../utils/chatStorage'
import { fetchOrderByChatId } from '../../Redux/orderSlice';

const initialMessages = [
  { id: 1, from: "them", text: "Welcome!", time: "12:24 PM", status: "read" },
  {
    id: 2,
    from: "them",
    text: "Hi! I'm Sendrey Assistant 👋 ",
    time: "12:25 PM",
    status: "delivered",
  },
  {
    id: 3,
    from: "them",
    text: "Would you like like to run a pickup or run an errand?",
    time: "12:25 PM",
    status: "delivered",
  },
];

const HeaderIcon = ({ children, tooltip, onClick }) => (
  <IconButton variant="text" size="sm" className="rounded-full" onClick={onClick}>
    {children}
  </IconButton>
);

export default function WhatsAppLikeChat() {
  const [dark, setDark] = useDarkMode();

  // Chat state
  const BOT_CHAT_ENTRY = {
    id: 'sendrey-bot',
    name: 'Sendrey Assistant',
    lastMessage: 'Welcome! Pick a service to get started.',
    time: '',
    online: true,
    avatar: null,
    isBot: true,
    unread: 0
  };
  const [chatHistory, setChatHistory] = useState([BOT_CHAT_ENTRY]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesByChat, setMessagesByChat] = useState({
    'sendrey-bot': initialMessages
  });

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [text, setText] = useState("");
  const [activeModal, setActiveModal] = useState(null);

  const serviceTypeRef = useRef(null);
  const [serviceType, setServiceType] = useState(null);

  const [orderCancelled, setOrderCancelled] = useState(false);
  const [cancellationReason, setCancellationReason] = useState(null);

  const [currentView, setCurrentView] = useState('chat');

  const [showOrderFlow, setShowOrderFlow] = useState(false);
  const [isAttachFlowOpen, setIsAttachFlowOpen] = useState(false);

  const [runnerId, setRunnerId] = useState(null);
  const [runnerLocation, setRunnerLocation] = useState(null);

  const [isChatActive, setIsChatActive] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  const [completedOrderStatuses, setCompletedOrderStatuses] = useState([]);

  const dispatch = useDispatch();

  const [canResendOtp, setCanResendOtp] = useState(false);

  const { nearbyUsers, } = useSelector((state) => state.users);
  const { runner, token } = useSelector((s) => s.auth);

  const [initialMessagesComplete, setInitialMessagesComplete] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [canShowNotifications, setCanShowNotifications] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [currentOrder, setCurrentOrder] = useState(null);

  const [isStartingNewOrder, setIsStartingNewOrder] = useState(false);
  const [showTerms, setShowTerms] = useState(false); // eslint-disable-line no-unused-vars
  const [verificationState, setVerificationState] = useState(null);
  const [showBannedModal, setShowBannedModal] = useState(false);

  const searchIntervalRef = useRef(null);
  const currentOrderRef = useRef(null);
  const kycNudgeTimerRef = useRef(null);
  const KYC_NUDGE_INTERVAL = 2 * 24 * 60 * 60 * 1000;
  const messagesRef = useRef(messages);
  const selectedUserRef = useRef(null);
  const [taskCompleted, setTaskCompleted] = useState(false);

  const kycStartedRef = useRef(false);
  const messagesByChatRef = useRef(messagesByChat);

  // Hooks
  const {
    socket,
    joinRunnerRoom,
    sendMessage,
    isConnected,
    uploadFileWithProgress,
    onSpecialInstructions, onOrderCreated,
    onPaymentSuccess, onDeliveryConfirmed, onMessageDeleted
  } = useSocket();

  const {
    isCollectingCredentials,
    credentialStep,
    credentialQuestions,
    startCredentialFlow,
    needsOtpVerification,
    handleCredentialAnswer,
    registrationComplete,
    handleOtpVerification,
    runnerData,
  } = useCredentialFlow(serviceTypeRef, (runnerData) => {
    setRunnerId(runnerData._id || runnerData.id);
  });

  const {
    kycStep,
    kycStatus,
    startKycFlow,
    onIdVerified,
    handleSelfieResponse,
    handleIDTypeSelection,
    onSelfieVerified,
    checkVerificationStatus,
  } = useKycHook(runnerId, runnerData?.fleetType);

  const { permission, } = usePushNotifications({
    userId: runnerId,
    userType: 'runner',
    socket,
  });

  const { cameraOpen, capturedImage, videoRef, openCamera, closeCamera,
    capturePhoto, retakePhoto, setIsPreviewOpen,
    isPreviewOpen, closePreview, openPreview, switchCamera,
    facingMode, } = useCameraHook();

  const {
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
  } = useCallHook({
    socket,
    chatId: selectedUser?._id ? `user-${selectedUser._id}-runner-${runnerId}` : null,
    currentUserId: runnerId,
    currentUserType: "runner",
  });

  // Handlers
  const handleAcceptTerms = async () => {
    try {
      await api.post('/terms/accept', {
        version: RUNNER_TERMS.version,
        userType: 'runner'
      });

      localStorage.setItem(`terms_accepted_${runnerId}`, 'true');
      setShowTerms(false);
      startKycFlow(setMessages);
    } catch (error) {
      console.error('Failed to save terms acceptance:', error);
    }
  };


  const handleBotClick = useCallback(() => {
    setIsChatActive(false);
    setSelectedUser(null);
    setActive({ id: 'sendrey-bot', isBot: true });
    const botMsgs = messagesByChatRef.current['sendrey-bot'];
    setMessages(botMsgs?.length ? botMsgs : initialMessages);
  }, []);

  const handleUserClick = useCallback((chatEntry) => {
    if (chatEntry.isBot) {
      handleBotClick();
      return;
    }

    const fullUser = selectedUserRef.current?._id === chatEntry.userId
      ? selectedUserRef.current : chatEntry;

    // If already on this user and chat is active, do nothing
    if (selectedUser?._id === chatEntry.userId && isChatActive) {
      return;
    }

    const chatId = `user-${chatEntry.userId}-runner-${runnerId}`;
    const existingMessages = messagesByChat[chatId];

    // Batch state updates to prevent multiple renders
    setIsChatActive(true);
    setSelectedUser(fullUser);
    setActive(chatEntry);

    // Only update messages if we have existing ones, otherwise let chatHistory handle it
    if (existingMessages?.length > 0) {
      setMessages(existingMessages);
    }
  }, [selectedUser?._id, isChatActive, runnerId, messagesByChat, handleBotClick]);

  const updateMessagesForCurrentChat = useCallback((newMessages) => {
    setMessages(newMessages);

    if (isChatActive && selectedUser && !selectedUser.isBot) {
      const chatId = `user-${selectedUser._id}-runner-${runnerId}`;
      setMessagesByChat(prev => ({
        ...prev,
        [chatId]: newMessages
      }));
    } else if (!isChatActive) {
      setMessagesByChat(prev => ({
        ...prev,
        'sendrey-bot': newMessages
      }));
    }
  }, [isChatActive, selectedUser, runnerId]);

  useEffect(() => { messagesByChatRef.current = messagesByChat; }, [messagesByChat]);

  useEffect(() => {
    if (!isChatActive || !runnerId) return;
    if (currentOrder?.paymentStatus === 'paid') return; // already good

    try {
      const saved = localStorage.getItem(`currentOrder_${runnerId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.status === 'completed' || parsed.status === 'cancelled') {
          localStorage.removeItem(`currentOrder_${runnerId}`);
          return;
        }
        setCurrentOrder(prev => prev?.paymentStatus === 'paid' ? prev : parsed);
      }
    } catch (e) { }
  }, [isChatActive, runnerId, currentOrder?.paymentStatus]);

  useEffect(() => {
    if (!registrationComplete || !runnerId) return;
    if (kycStartedRef.current) return;

    const timer = setTimeout(() => {
      kycStartedRef.current = true;
      const alreadyAccepted = localStorage.getItem(`terms_accepted_${runnerId}`);
      if (!alreadyAccepted) {
        setShowTerms(true);
      } else {
        startKycFlow(setMessages);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [registrationComplete, runnerId, startKycFlow]);

  useEffect(() => {
    currentOrderRef.current = currentOrder;
  }, [currentOrder]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

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

      setMessages(prev => {
        const newMessages = [...prev, nudgeMessage];
        updateMessagesForCurrentChat(newMessages);
        return newMessages;
      });

      if (permission === 'granted') {
        new Notification('Complete your KYC 📸', {
          body: `Hi${runnerData?.firstName ? ` ${runnerData.firstName}` : ''}! Take your selfie to unlock unlimited tasks.`,
          icon: '/favicon.ico',
        });
      }

      localStorage.setItem(`kyc_nudge_${runnerId}`, Date.now().toString());
    }, timeUntilNext);

    return () => {
      if (kycNudgeTimerRef.current) clearTimeout(kycNudgeTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registrationComplete, runnerId, kycStatus.selfieVerified, kycStep, permission, runnerData?.firstName, updateMessagesForCurrentChat]);

  useEffect(() => {
    if (isChatActive) return;

    const timer1 = setTimeout(() => {
      setMessages(prev => {
        if (prev.length === 0) {
          const newMessages = [initialMessages[0]];
          updateMessagesForCurrentChat(newMessages);
          return newMessages;
        }
        return prev;
      });
    }, 0);

    const timer2 = setTimeout(() => {
      setMessages(prev => {
        if (prev.length === 1) {
          const newMessages = [...prev, initialMessages[1]];
          updateMessagesForCurrentChat(newMessages);
          return newMessages;
        }
        return prev;
      });
    }, 700);

    const timer3 = setTimeout(() => {
      setMessages(prev => {
        if (prev.length === 2) {
          const newMessages = [...prev, initialMessages[2]];
          updateMessagesForCurrentChat(newMessages);
          return newMessages;
        }
        return prev;
      });
      setTimeout(() => {
        setInitialMessagesComplete(true);
      }, 600);
    }, 990);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [isChatActive, updateMessagesForCurrentChat]);

  useEffect(() => {
    if (kycStep === 6 && registrationComplete && !isChatActive) {
      setCanShowNotifications(true);
    } else if (isChatActive) {
      setCanShowNotifications(false);
    }
  }, [kycStep, registrationComplete, isChatActive]);

  useEffect(() => {
    if (needsOtpVerification) {
      setCanResendOtp(false);
      const timer = setTimeout(() => {
        setCanResendOtp(true);
      }, 15000);
      return () => clearTimeout(timer);
    }
  }, [needsOtpVerification]);

  // In raw.jsx - replace the useEffect that handles socket events (around line 300-360)

  useEffect(() => {
    if (!socket) return;
    console.log('[raw] setting up paymentSuccess listener, socket id:', socket.id);

    const onPayment = (data) => {
      console.log('[raw] paymentSuccess received:', data);
      console.log('[raw] socket id when payment received:', socket.id);
      const updated = {
        ...(currentOrderRef.current || {}),
        escrowId: data.escrowId,
        orderId: data.orderId || currentOrderRef.current?.orderId,
        paymentStatus: 'paid',
        status: 'active',
      };
      setCurrentOrder(updated);
      // persist so reconnect can restore
      try {
        localStorage.setItem(`currentOrder_${runnerId}`, JSON.stringify(updated));
      } catch (e) { }
    };

    const onOrder = (data) => {
      const order = data.order || data;
      if (!order?.orderId) return;

      console.log('[raw] orderCreated received:', order);

      setCurrentOrder(prev => {
        // If no previous order or different order ID, set new order
        if (!prev || prev.orderId !== order.orderId) {
          console.log('[raw] Setting new order:', order.orderId);
          return order;
        }
        // Same order — merge only
        return { ...prev, ...order };
      });
      currentOrderRef.current = order;
    };

    const onTaskCompleted = (data) => {
      setTaskCompleted(true);
      localStorage.removeItem(`currentOrder_${runnerId}`);
      // Don't navigate away — runner sees the completed chat with Back to Home button
      // Navigation happens when runner clicks Back to Home → onStartNewOrder
    };

    const onOrderCancelled = (data) => {
      // Don't wipe messages — let the chat stay visible
      // chatHistory on next join will give the clean session
      setOrderCancelled(true);
      setCancellationReason(data.cancelledBy);
      setCurrentOrder(prev => prev ? { ...prev, status: 'cancelled' } : null);
    };


    socket.on('task_completed', onTaskCompleted);
    socket.on('paymentSuccess', onPayment);
    console.log('[raw] paymentSuccess listeners count:', socket.listeners('paymentSuccess').length);
    socket.on('orderCreated', onOrder);
    socket.on('orderCancelled', onOrderCancelled);
    return () => {
      socket.off('paymentSuccess', onPayment);
      socket.off('orderCreated', onOrder);
      socket.off('task_completed', onTaskCompleted);
      socket.off('orderCancelled', onOrderCancelled);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, handleBotClick, runnerId, selectedUser?._id, runnerId]);


  useEffect(() => {
    if (!selectedUser || !socket || !isConnected || selectedUser.isBot) return;

    const chatId = `user-${selectedUser._id}-runner-${runnerId}`;

    const handleChatHistory = async (msgs) => {
      console.log('runner chatHistory received:', msgs.length, 'messages');

      let latestOrder = null;
      try {
        const result = await dispatch(fetchOrderByChatId(chatId)).unwrap();
        if (result) {
          latestOrder = result?.data ?? result;
          setCurrentOrder(latestOrder);
          currentOrderRef.current = latestOrder;
        }
      } catch (_) { }

      if (!msgs?.length) {
        setMessages([]);
        setMessagesByChat(prev => ({ ...prev, [chatId]: [] }));
        return;
      }

      const isTerminalOrder = ['completed', 'cancelled', 'task_completed']
        .includes(latestOrder?.status);

      const seenPaymentMessages = new Set();
      const filteredMsgs = msgs.filter(msg => {
        // If terminal order, strip new-session initial messages that leaked through
        if (isTerminalOrder) {
          if (msg.type === 'system' && msg.text?.includes('joined the chat')) return false;
          if (msg.type === 'payment_request' || msg.messageType === 'payment_request') return false;
        }

        // Deduplicate payment confirmation messages
        const isPaymentMessage =
          (msg.type === 'system' && msg.text?.toLowerCase().includes('made payment for this task')) ||
          msg.paymentConfirmed === true ||
          msg.type === 'payment_confirmed';

        if (isPaymentMessage) {
          const key = msg.text || 'payment';
          if (seenPaymentMessages.has(key)) {
            console.log('[chatHistory] Skipping duplicate payment message:', msg.text);
            return false;
          }
          seenPaymentMessages.add(key);
        }

        return true;
      });

      console.log('[chatHistory] Filtered from', msgs.length, 'to', filteredMsgs.length, 'messages');

      const formattedMsgs = filteredMsgs.map(msg => {
        const isSystem = msg.from === 'system' || msg.type === 'system' ||
          msg.messageType === 'system' || msg.senderType === 'system' || msg.senderId === 'system';
        return {
          ...msg,
          from: isSystem ? 'system' : (msg.senderId === runnerId ? 'me' : 'them'),
          type: msg.type || msg.messageType || 'text',
        };
      });

      setMessages(formattedMsgs);
      setMessagesByChat(prev => ({ ...prev, [chatId]: formattedMsgs }));

      // Restore taskCompleted from history
      const isCompleted = formattedMsgs.some(m =>
        m.type === 'task_completed' ||
        m.messageType === 'task_completed' ||
        (m.type === 'system' && m.text?.toLowerCase().includes('task completed'))
      );
      if (isCompleted) setTaskCompleted(true);

      // Restore cancellation from history
      const cancelMsg = formattedMsgs.find(m =>
        m.type === 'system' && m.text?.toLowerCase().includes('cancelled this order')
      );
      if (cancelMsg) {
        setOrderCancelled(true);
        setCancellationReason(cancelMsg.text?.split(' ')[0] || 'Runner');
      }

      // Restore paid state from history
      const hasPaidConfirm = formattedMsgs.some(m =>
        (m.type === 'system' && m.text?.toLowerCase().includes('made payment for this task')) ||
        m.paymentConfirmed === true
      );
      if (hasPaidConfirm && latestOrder) {
        setCurrentOrder(prev => prev ? { ...prev, paymentStatus: 'paid' } : prev);
      }
    };

    socket.on('chatHistory', handleChatHistory);
    socket.emit('runnerJoinChat', { runnerId, userId: selectedUser._id, chatId });
    console.log('[raw] emitting runnerJoinChat, chatId:', chatId, 'socket id:', socket.id);

    return () => {
      socket.off('chatHistory', handleChatHistory);
    };
  }, [selectedUser, socket, isConnected, runnerId, dispatch]);

  useEffect(() => {
    // console.log("joinRunnerRoom effect:", {
    //   registrationComplete,
    //   runnerId,
    //   serviceType: serviceTypeRef.current,
    //   socketConnected: socket?.connected,
    //   socketId: socket?.id
    // });
    if (!registrationComplete || !runnerId || !serviceTypeRef.current || !socket) return;
    joinRunnerRoom(runnerId, serviceTypeRef.current);
  }, [registrationComplete, runnerId, socket, joinRunnerRoom]);

  useEffect(() => {
    if (socket && runnerId && registrationComplete) {
      // console.log(` Runner ${runnerId} rejoining personal room for calls`);
      socket.emit('rejoinUserRoom', { userId: runnerId, userType: 'runner' });
    }
  }, [socket, runnerId, registrationComplete]);

  // restore draft on chat switch
  useEffect(() => {
    if (!selectedUser?._id || !runnerId) return;
    const chatId = `user-${selectedUser._id}-runner-${runnerId}`;
    chatStorage.getDraft(chatId).then(draft => {
      if (draft) setText(draft);
    });
  }, [selectedUser?._id, runnerId]);

  useEffect(() => {
    if (!socket || !runnerId) return;

    const handleVerificationStatus = (data) => {
      // console.log('Verification status received:', data);
      setVerificationState(data);
      if (data.isBanned) {
        setShowBannedModal(true);
      }
    };

    socket.on('verificationStatus', handleVerificationStatus);
    return () => {
      socket.off('verificationStatus', handleVerificationStatus);
    };
  }, [socket, runnerId]);

  useEffect(() => {
    if (drawerOpen || infoOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
  }, [drawerOpen, infoOpen]);

  useEffect(() => {
    if (registrationComplete) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setRunnerLocation({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            });
          },
          (error) => {
            console.error("Error getting location:", error);
            setRunnerLocation({ latitude: 6.5244, longitude: 3.3792 });
          }
        );
      } else {
        setRunnerLocation({ latitude: 6.5244, longitude: 3.3792 });
      }
    }
  }, [registrationComplete]);

  const updateLastMessage = useCallback((userId, messageText) => {
    setChatHistory(prev =>
      prev.map(chat =>
        chat.id === userId
          ? {
            ...chat,
            lastMessage: messageText.substring(0, 30) + (messageText.length > 30 ? '...' : ''),
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          }
          : chat
      )
    );
  }, []);

  const displayMessages = isChatActive
    ? messages.filter(m => {
      if (m.from === 'system' || m.type === 'system' || m.senderType === 'system') {
        return true;
      }
      return !m.isCredential && !m.isKyc;
    })
    : messages;

  const handleResendOtp = useCallback(() => {
    if (!canResendOtp) return;

    const msg1 = {
      id: Date.now(),
      from: "them",
      text: "We have sent you a new OTP",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "delivered"
    };

    setMessages(prev => {
      const newMessages = [...prev, msg1];
      updateMessagesForCurrentChat(newMessages);
      return newMessages;
    });

    setTimeout(() => {
      const msg2 = {
        id: Date.now() + 1,
        from: "them",
        text: `Enter the OTP we sent to ${runnerData.phone}, \n \nDidn't receive OTP? Resend`,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "delivered",
        hasResendLink: true
      };

      setMessages(prev => {
        const newMessages = [...prev, msg2];
        updateMessagesForCurrentChat(newMessages);
        return newMessages;
      });
    }, 1200);

    setCanResendOtp(false);
    setTimeout(() => setCanResendOtp(true), 40000);
  }, [canResendOtp, runnerData?.phone, updateMessagesForCurrentChat]);

  const handleMessageClick = useCallback((message) => {
    if (message.hasResendLink && canResendOtp) {
      handleResendOtp();
      return;
    }
    if (message.selfieChoice) {
      handleSelfieResponse(message.selfieChoice, setMessages);
      if (message.selfieChoice === 'okay') {
        openCamera();
      }
      return;
    }
  }, [canResendOtp, handleResendOtp, handleSelfieResponse, openCamera]);

  const pickUp = useCallback(() => {
    serviceTypeRef.current = "pick-up";
    setServiceType("pick-up");

    const newMsg = {
      id: Date.now().toString(),
      from: "me",
      text: 'Pick Up',
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "sent",
      isCredential: true
    };

    setMessages(prev => {
      const newMessages = [...prev, newMsg];
      updateMessagesForCurrentChat(newMessages);
      return newMessages;
    });

    setTimeout(() => {
      startCredentialFlow('pick-up', setMessages);
    }, 1000);
  }, [startCredentialFlow, updateMessagesForCurrentChat]);

  const runErrand = useCallback(() => {
    serviceTypeRef.current = "run-errand";
    setServiceType("run-errand");

    const newMsg = {
      id: Date.now().toString(),
      from: "me",
      text: 'Run Errand',
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "sent",
      isCredential: true
    };

    setMessages(prev => {
      const newMessages = [...prev, newMsg];
      updateMessagesForCurrentChat(newMessages);
      return newMessages;
    });

    setTimeout(() => {
      startCredentialFlow('run-errand', setMessages);
    }, 1000);
  }, [startCredentialFlow, updateMessagesForCurrentChat]);

  const send = useCallback((replyingTo = null) => {
    if (!text.trim()) return;

    const activeChatId = selectedUser?._id
      ? `user-${selectedUser._id}-runner-${runnerId}`
      : 'sendrey-bot';

    // clear draft on send
    chatStorage.clearDraft(activeChatId);

    if (needsOtpVerification) {
      const otpMessage = {
        id: Date.now(),
        from: "me",
        text: text.trim(),
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "sent",
      };

      setMessages(prev => {
        const newMessages = [...prev, otpMessage];
        updateMessagesForCurrentChat(newMessages);
        return newMessages;
      });

      handleOtpVerification(text.trim(), setMessages);
      setText("");
    } else if (isCollectingCredentials && credentialStep !== null) {
      handleCredentialAnswer(text.trim(), setText, setMessages);
    } else if (isChatActive) {
      const newMsg = {
        id: Date.now().toString(),
        from: "me",
        type: "text",
        text: text.trim(),
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "sent",
        senderId: runnerId,
        senderType: "runner",
        ...(replyingTo && {
          replyTo: replyingTo.id,
          replyToMessage: replyingTo.text || replyingTo.fileName || "Media",
          replyToFrom: replyingTo.from
        })
      };

      setMessages(prev => {
        const newMessages = [...prev, newMsg];
        updateMessagesForCurrentChat(newMessages);
        return newMessages;
      });

      setText("");
      setReplyingTo(null);

      if (socket) {
        sendMessage(`user-${selectedUser._id}-runner-${runnerId}`, newMsg);
        updateLastMessage(selectedUser._id, text.trim());
      }
    }
  }, [
    text,
    needsOtpVerification,
    isCollectingCredentials,
    credentialStep,
    isChatActive,
    runnerId,
    socket,
    selectedUser,
    handleOtpVerification,
    handleCredentialAnswer,
    sendMessage,
    updateLastMessage,
    updateMessagesForCurrentChat
  ]);

  const handleConnectToService = async () => {
    if (!runnerLocation || !serviceTypeRef.current) {
      console.error("Missing runner location or service type");
      return;
    }

    dispatch(clearNearbyUsers());
    setHasSearched(false);

    const searchParams = {
      latitude: runnerLocation.latitude,
      longitude: runnerLocation.longitude,
      serviceType: serviceTypeRef.current,
      fleetType: runnerData?.fleetType
    };

    // console.log("Searching for nearby requests:", searchParams);

    const searchingMessage = {
      id: `searching-${Date.now()}`,
      from: "them",
      text: "Connecting....",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "delivered",
    };

    setMessages(prev => {
      const newMessages = [...prev, searchingMessage];
      updateMessagesForCurrentChat(newMessages);
      return newMessages;
    });

    try {
      await dispatch(fetchNearbyUserRequests(searchParams)).unwrap();
      setHasSearched(true);
      setMessages(prev => {
        const newMessages = prev.filter(m => m.id !== searchingMessage.id);
        updateMessagesForCurrentChat(newMessages);
        return newMessages;
      });
    } catch (error) {
      console.error('Search error:', error);

      setMessages(prev => {
        const newMessages = prev.filter(m => m.id !== searchingMessage.id);
        updateMessagesForCurrentChat(newMessages);
        return newMessages;
      });

      if (error.canAccept === false) {
        const verificationErrorMessage = {
          id: `verification-error-${Date.now()}`,
          from: "them",
          text: error.reason,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          status: "delivered",
          isKyc: true,
          verificationError: true,
          verificationStatus: {
            status: error.status,
            dailyCount: error.dailyCount,
            maxDaily: error.maxDaily,
            resetIn: error.resetIn
          }
        };

        setMessages(prev => {
          const newMessages = [...prev, verificationErrorMessage];
          updateMessagesForCurrentChat(newMessages);
          return newMessages;
        });

        setVerificationState({ canAccept: false, ...error });

        if (error.isBanned) {
          setShowBannedModal(true);
        }
      } else {
        const errorMessage = {
          id: `error-${Date.now()}`,
          from: "them",
          text: error.message || "Couldn't find any runners nearby. Please try again.",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          status: "delivered",
        };

        setMessages(prev => {
          const newMessages = [...prev, errorMessage];
          updateMessagesForCurrentChat(newMessages);
          return newMessages;
        });
      }
    }
  };

  const handlePickService = useCallback(async (user, specialInstructions = null, order) => {
    dispatch(clearNearbyUsers());
    setHasSearched(false);
    setTaskCompleted(false);
    setOrderCancelled(false);
    setCancellationReason(null);

    // Clear old order state BEFORE starting new one
    setCurrentOrder(null);
    currentOrderRef.current = null;

    if (searchIntervalRef.current) clearInterval(searchIntervalRef.current);

    const chatId = `user-${user._id}-runner-${runnerId}`;

    const fullUser = {
      ...user,
      specialInstructions: specialInstructions ?? user.currentRequest?.specialInstructions ?? null,
    };

    selectedUserRef.current = fullUser;

    // Clear stale messages for this chat
    setMessagesByChat(prev => ({ ...prev, [chatId]: [] }));

    // Batch state updates
    setMessages([]);
    setCompletedOrderStatuses([]);
    setSelectedUser(fullUser);
    setIsChatActive(true);

    const newChatEntry = {
      id: user._id,
      name: `${user.firstName} ${user.lastName || ''}`.trim(),
      lastMessage: '',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      online: true,
      avatar: user.profilePicture || user.avatar || 'https://via.placeholder.com/128',
      userId: user._id,
      serviceType: user.serviceType,
      unread: 0
    };

    setChatHistory(prev => {
      const exists = prev.find(chat => chat.id === user._id);
      if (exists) return prev;
      return [newChatEntry, ...prev];
    });

    setActive(newChatEntry);
  }, [dispatch, runnerId, searchIntervalRef]);

  const handleLocationClick = () => setShowOrderFlow(true);
  const handleAttachClick = () => setIsAttachFlowOpen(true);

  const handleOrderStatusClick = (statusKey) => {
    setCompletedOrderStatuses(prev =>
      prev.includes(statusKey) ? prev : [...prev, statusKey]
    );

    if (statusKey === "en_route_to_delivery") {
      // console.log("RUNNER: Starting tracking");

      if (socket && isConnected) {
        const trackingPayload = {
          chatId: `user-${selectedUser._id}-runner-${runnerId}`,
          runnerId: runnerId,
          userId: selectedUser._id
        };

        // console.log("FRONTEND SENDING startTrackRunner:", trackingPayload);
        socket.emit("startTrackRunner", trackingPayload);
      } else {
        console.error("RUNNER: Socket not connected, cannot start tracking!");
      }
    }
  };

  const isConnectLocked = isChatActive || (
    !!currentOrder &&
    currentOrder.status !== 'completed' &&
    !completedOrderStatuses.includes('task_completed')
  );

  const handleNewOrderConfirm = () => {
    if (kycStep < 6) return;

    chatStorage.clearActiveChat(); // ← only clear when genuinely starting new order
    dispatch(clearNearbyUsers());
    setHasSearched(false);

    const previousOrderId = currentOrder?.orderId;

    // Clear stale order data
    try {
      localStorage.removeItem(`currentOrder_${runnerId}`);
    } catch { }

    if (selectedUser?._id && runnerId) {
      try {
        localStorage.removeItem(`backHome_disabled_user-${selectedUser._id}-runner-${runnerId}`);
      } catch { }
    }

    if (socket && previousOrderId) {
      socket.emit('runnerStartedNewOrder', {
        runnerId,
        previousOrderId: currentOrder.orderId,
      });
    }

    setIsChatActive(false);
    setCurrentOrder(null);
    setCompletedOrderStatuses([]);
    setVerificationState(null);
    setHasSearched(false);
    setIsStartingNewOrder(true);
    handleBotClick();
    setActiveModal(null);
  };

  const handleCancelOrderConfirm = (reason) => {
    if (socket && currentOrder) {
      socket.emit('cancelOrder', {
        chatId: `user-${selectedUser._id}-runner-${runnerId}`,
        orderId: currentOrder.orderId,
        runnerId,
        userId: selectedUser._id,
        reason
      });
    }

    setOrderCancelled(true);
    setCancellationReason('runner');
    setCurrentOrder(null);
    setActiveModal(null);
  };

  const renderMainScreen = () => {
    // runner logged in via email link but phone not verified
    if (runner && token && !runner.isPhoneVerified) {
      return (
        <PhoneVerificationPrompt
          user={runner}
          darkMode={dark}
          toggleDarkMode={() => setDark(!dark)}
        />
      );
    }

    if (!isChatActive) {
      return (
        <OnboardingScreen
          active={active}
          messages={messages}
          setMessages={setMessages}
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
          send={send}
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
          onFindMore={() => dispatch(fetchNearbyUserRequests({
            latitude: runnerLocation?.latitude,
            longitude: runnerLocation?.longitude,
            serviceType: serviceTypeRef.current,
            fleetType: runnerData?.fleetType
          }))}
          nearbyUsers={nearbyUsers}
          onPickService={handlePickService}
          socket={socket}
          isConnected={isConnected}
          runnerData={runnerData}
          canShowNotifications={canShowNotifications}
          hasSearched={hasSearched}
          replyingTo={replyingTo}
          setReplyingTo={setReplyingTo}
          currentOrder={currentOrder}
          verificationState={verificationState}
          showBannedModal={showBannedModal}
          setShowBannedModal={setShowBannedModal}
          isConnectLocked={isConnectLocked}
          handleCredentialAnswer={handleCredentialAnswer}

          isStartingNewOrder={isStartingNewOrder}
          onStartNewOrderComplete={(newServiceType, newFleetType) => {
            serviceTypeRef.current = newServiceType;
            setServiceType(newServiceType);
            setIsStartingNewOrder(false);
            if (runnerId && socket) {
              joinRunnerRoom(runnerId, newServiceType);
            }
          }}
          onUpdateProfile={async (data) => dispatch(updateProfile(data)).unwrap()}

          runnerLocation
        />
      );
    } else {
      return (
        <RunnerChatScreen
          active={active}
          selectedUser={selectedUser}
          isChatActive={isChatActive}
          messages={displayMessages}
          setMessages={setMessages}
          text={text}
          setText={setText}
          dark={dark}
          setDark={setDark}
          send={send}
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
          completedOrderStatuses={completedOrderStatuses}
          setCompletedOrderStatuses={setCompletedOrderStatuses}
          uploadFileWithProgress={uploadFileWithProgress}
          replyingTo={replyingTo}
          setReplyingTo={setReplyingTo}
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
          incomingCall={incomingCall}
          isMuted={isMuted}
          isCameraOff={isCameraOff}
          formattedDuration={formattedDuration}
          remoteUsers={remoteUsers}
          localVideoTrack={localVideoTrack}
          initiateCall={initiateCall}
          acceptCall={acceptCall}
          declineCall={declineCall}
          endCall={endCall}
          toggleMute={toggleMute}
          toggleCamera={toggleCamera}
          currentOrder={currentOrder}
          onSpecialInstructions={onSpecialInstructions}
          onOrderCreated={onOrderCreated}
          onPaymentSuccess={onPaymentSuccess}
          onDeliveryConfirmed={onDeliveryConfirmed}
          onMessageDeleted={onMessageDeleted}
          setCurrentOrder={setCurrentOrder}
          runnerFleetType={runnerData?.fleetType}

          messagesRef={messagesRef}

          taskCompleted={taskCompleted}
          setTaskCompleted={setTaskCompleted}

          orderCancelled={orderCancelled}
          cancellationReason={cancellationReason}
          onStartNewOrder={() => {
            setOrderCancelled(false);
            setCancellationReason(null);
            handleNewOrderConfirm();
          }}
        />
      );
    }
  };

  const renderView = () => {
    const handleBack = () => setCurrentView('chat');

    switch (currentView) {
      case 'profile':
        return <Profile
          darkMode={dark}
          onBack={handleBack}
          runnerId={runnerId}
          registrationComplete={registrationComplete}
          runnerData={runnerData}
        />;
      case 'wallet':
        return <Wallet darkMode={dark} onBack={handleBack} runnerId={runnerId} />;
      case 'orders':
        return <Orders darkMode={dark} onBack={handleBack} runnerId={runnerId} registrationComplete={registrationComplete} />;
      case 'payout':
        return <Payout
          darkMode={dark}
          onBack={handleBack}
          socket={socket}
          runnerId={runnerId}
          chatId={selectedUser?._id ? `user-${selectedUser._id}-runner-${runnerId}` : null}
          currentOrder={currentOrder}
        />;
      case 'chat':
      default:
        return (
          <div className="h-full w-full grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)_360px]">
            <aside className="hidden lg:flex flex-col border-r dark:border-white/10 border-gray-200 bg-white/5/10 backdrop-blur-xl h-full overflow-hidden">
              <Sidebar
                active={active}
                setActive={setActive}
                chatHistory={chatHistory}
                onBotClick={handleBotClick}
                onUserClick={handleUserClick}
              />
            </aside>

            <div className="h-full overflow-hidden">
              {renderMainScreen()}
            </div>

            <aside className="hidden lg:block border-l dark:border-white/10 border-gray-200 h-full overflow-hidden">
              <ContactInfo
                contact={active}
                onClose={() => setInfoOpen(false)}
                setActiveModal={setActiveModal}
                onNavigate={setCurrentView}
                serviceType={serviceType}
                onBack={() => setCurrentView('chat')}

                currentOrder={currentOrder}
                registrationComplete={registrationComplete}
                kycStep={kycStep}
                isChatActive={isChatActive}
                orderCancelled={orderCancelled}
                messages={displayMessages}
              />
            </aside>
          </div>
        );
    }
  };

  return (
    <div className="h-screen flex flex-col w-full bg-white dark:bg-black-100 bg-gradient-to-br from-slate-900 via-slate-950 to-black text-white">
      {/* mobile header */}
      <div className={`lg:hidden relative z-10 flex flex-shrink-0 items-center justify-between px-3 py-3 border-b dark:border-white/10 border-gray-200 ${currentView !== 'chat' ? 'hidden' : ''}`}>
        <div className="flex items-center gap-2">
          <IconButton variant="text" className="rounded-full" onClick={() => setDrawerOpen(true)}>
            <Menu className="h-5 w-5" />
          </IconButton>
        </div>

        <div className="flex gap-3">
          <span className="bg-gray-1000 dark:bg-black-200 rounded-full w-10 h-10 flex items-center justify-center">
            <HeaderIcon tooltip="More" onClick={() => setInfoOpen(true)}>
              <MoreHorizontal className="h-6 w-6" />
            </HeaderIcon>
          </span>
          <div
            onClick={() => setDark(!dark)}
            className="cursor-pointer flex items-center gap-2 p-2"
          >
            {dark ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6 text-gray-800" strokeWidth={3.0} />}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {renderView()}
      </div>


      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        placement="left"
        className="p-0 bg-white dark:bg-black-100 backdrop-blur-xl !z-[9999]"
        overlayProps={{ className: "!z-[9998]" }}
      >
        <Sidebar
          active={active}
          setActive={setActive}
          chatHistory={chatHistory}
          onBotClick={handleBotClick}
          onUserClick={handleUserClick}
          onClose={() => setDrawerOpen(false)}
        />
      </Drawer>

      <Drawer
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        placement="right"
        className="p-0 bg-white dark:bg-black-100 backdrop-blur-xl !z-[9999]"
        overlayProps={{ className: "!z-[9998]" }}
      >
        <ContactInfo
          contact={active}
          onClose={() => setInfoOpen(false)}
          setActiveModal={setActiveModal}
          onNavigate={setCurrentView}

          currentOrder={currentOrder}
          registrationComplete={registrationComplete}

          serviceType={serviceType}
          onBack={() => setCurrentView('chat')}
          kycStep={kycStep}
          isChatActive={isChatActive}
          orderCancelled={orderCancelled}
          messages={displayMessages}
        />
      </Drawer>

      {activeModal && (
        <Modal
          type={activeModal}
          onClose={() => setActiveModal(null)}
          isConnectLocked={isConnectLocked}
          selectedUser={selectedUser}
          currentOrder={currentOrder}
          onConfirm={activeModal === 'cancelOrder' ? handleCancelOrderConfirm : handleNewOrderConfirm}
          registrationComplete={registrationComplete}
          darkMode={dark}
        />
      )}

      <TermsAcceptanceModal
        isOpen={showTerms}
        onClose={() => { }}
        onAccept={handleAcceptTerms}
        terms={RUNNER_TERMS}
        darkMode={dark}
        userType="runner"
      />
    </div>

  );
}

function ContactInfo({ contact,
  onClose,
  setActiveModal,
  onNavigate,
  onBack,
  currentOrder,
  serviceType, kycStep,
  isChatActive,
  orderCancelled,
  messages = []
}) {
  const handleModalClick = (modalType) => {
    onClose?.();
    if (setActiveModal) {
      setActiveModal(modalType);
    }
  };

  const handleNavigation = (view) => {
    onClose?.();
    if (onNavigate) {
      onNavigate(view);
    }
  };

  const isRunErrand =
    serviceType === "run-errand" ||
    currentOrder?.serviceType === "run-errand" ||
    currentOrder?.serviceType === "run_errand" ||
    currentOrder?.taskType === "run_errand" ||
    currentOrder?.taskType === "run-errand";

  const isPaidFromMessages = messages.some(m =>
    m.type === 'system' &&
    m.text?.toLowerCase().includes('made payment for this task')
  );

  const isTerminalOrder = currentOrder &&
    ['cancelled', 'completed', 'task_completed'].includes(currentOrder.status);

  const isPaid = currentOrder?.paymentStatus === 'paid' || isPaidFromMessages;

  const isActiveOrder = currentOrder &&
    isPaid &&
    !isTerminalOrder;

  // Can cancel if chat is active, not yet cancelled, order exists and not terminal
  const canCancel = isChatActive &&
    !orderCancelled &&
    currentOrder &&  // Ensure order exists
    !isTerminalOrder;

  // Show "Start new order" only when not in an active chat
  const showStartNewOrder = !isChatActive && !isActiveOrder && !isTerminalOrder;

  console.log('[ContactInfo] state:', {
    isChatActive,
    orderCancelled,
    currentOrderId: currentOrder?.orderId,
    currentOrderStatus: currentOrder?.status,
    isPaid,
    isActiveOrder,
    isTerminalOrder,
    canCancel,
    showStartNewOrder
  });


  return (
    <div className="h-screen flex flex-col overflow-y-auto gap-6 marketSelection">
      <div className="py-3 px-2">
        {onClose ? (
          <IconButton variant="text" size="sm" className="rounded-full lg:hidden flex" onClick={onClose}>
            <X className="h-7 w-7" />
          </IconButton>
        ) : null}
      </div>

      <>
        <div className="cursor-pointer hover:bg-gray-200 dark:hover:bg-black-200 transition-colors"
          onClick={() => handleNavigation('profile')}>
          <h3 className="px-4 py-5 font-bold text-md text-black-200 dark:text-gray-300">Profile</h3>
        </div>

        <div className="cursor-pointer hover:bg-gray-200 dark:hover:bg-black-200 transition-colors"
          onClick={() => handleNavigation('wallet')}>
          <h3 className="px-4 py-5 font-bold text-md text-black-200 dark:text-gray-300">Wallet</h3>
        </div>

        <div className="cursor-pointer hover:bg-gray-200 dark:hover:bg-black-200 transition-colors"
          onClick={() => handleNavigation('orders')}>
          <h3 className="px-4 py-5 font-bold text-md text-black-200 dark:text-gray-300">Orders</h3>
        </div>


        {isRunErrand && currentOrder?.paymentStatus === 'paid' && (
          <div className="cursor-pointer hover:bg-gray-200 dark:hover:bg-black-200 transition-colors"
            onClick={() => handleNavigation('payout')}>
            <h3 className="px-4 py-5 font-bold text-md text-black-200 dark:text-gray-300">Payout</h3>
          </div>
        )}

        {showStartNewOrder && (
          <div
            onClick={() => kycStep >= 6 ? handleModalClick('newOrder') : null}
            className={kycStep < 6 ? 'opacity-40 pointer-events-none' : 'cursor-pointer hover:bg-gray-200 dark:hover:bg-black-200 transition-colors'}
          >
            <h3 className="px-4 py-5 font-bold text-md text-black-200 dark:text-gray-300">
              Start new order
            </h3>
          </div>
        )}
      </>

      {canCancel && (
        <div
          onClick={() => handleModalClick('cancelOrder')}
          className="cursor-pointer hover:bg-gray-200 dark:hover:bg-black-200 transition-colors">
          <p className="px-4 py-5 text-md font-medium text-red-400 dark:text-red-400">Cancel order</p>
        </div>
      )}
    </div>
  );
}