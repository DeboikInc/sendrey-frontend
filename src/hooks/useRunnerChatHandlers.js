import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { fetchNearbyUserRequests, clearNearbyUsers } from '../Redux/userSlice';
import { updateProfile } from '../Redux/runnerSlice';
import chatManager from '../utils/chatStateManager';
import useOrderStore from '../store/orderStore';
import { unstable_batchedUpdates } from 'react-dom';

const BOT_CHAT_ID = 'sendrey-bot';

export function useRunnerChatHandlers({
  // identity
  runnerId,
  runnerIdRef,
  selectedUserRef,
  activeChatIdRef,
  activeScreenIdRef,
  activeSetMessagesRef,
  currentOrderRef,
  fleetTypeRef,
  searchIntervalRef,
  pendingChatSwitchRef,

  // state setters
  setActiveChatId,
  setSelectedUser,
  setActive,
  setChatHistory,
  setOrderPending,
  setCompletedStatusesVersion,
  setHasSearched,
  setIsLoadingArchive,
  setAwaitingChatReady,
  setChatSessionKey,
  setVerificationState,
  setNewOrderTrigger,
  setBotRefreshTrigger,
  setSilentRefreshKey,
  setRunnerLocation,

  // socket
  socket,
  isConnected,
  joinRunnerRoom,

  // helpers from raw.jsx
  botMessagesUpdater,
  runnerData,
  runnerLocation,
}) {
  const dispatch = useDispatch();

  // ── handleBotClick ──────────────────────────────────────────────────────────
  const handleBotClick = useCallback(() => {
    setActiveChatId(BOT_CHAT_ID);
    setSelectedUser(null);
    setActive({ id: BOT_CHAT_ID, isBot: true });
    selectedUserRef.current = null;

    const botState = chatManager.get(BOT_CHAT_ID);
    if (botState.messages.length === 0) {
      chatManager.set(BOT_CHAT_ID, { messages: [] });
    }
  }, [setActiveChatId, setSelectedUser, setActive, selectedUserRef]);

  // ── handleUserClick ─────────────────────────────────────────────────────────
  const handleUserClick = useCallback(async (chatEntry) => {
    if (chatEntry.isBot) { handleBotClick(); return; }

    const chatId = `user-${chatEntry.userId}-runner-${runnerId}`;
    const fullUser = {
      ...chatEntry,
      firstName: chatEntry.firstName || chatEntry.name?.split(' ')[0] || chatEntry.name,
      lastName: chatEntry.lastName || chatEntry.name?.split(' ').slice(1).join(' ') || '',
      _id: chatEntry.userId,
      serviceType: chatEntry.serviceType ?? null,
    };

    selectedUserRef.current = fullUser;
    setSelectedUser(fullUser);
    setActive(chatEntry);
    setActiveChatId(chatId);
    setChatHistory(prev => prev.map(c => c.id === chatEntry.userId ? { ...c, unread: 0 } : c));

    const savedState = chatManager.get(chatId);

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
        chatManager.set(chatId, { ...savedState, messages: formatted });
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
      setTimeout(() => {
        if (activeSetMessagesRef.current) activeSetMessagesRef.current(savedState.messages);
      }, 50);
    }
  }, [
    runnerId, socket, isConnected, handleBotClick,
    selectedUserRef, activeChatIdRef, activeSetMessagesRef,
    setSelectedUser, setActive, setActiveChatId, setChatHistory, setIsLoadingArchive,
  ]);

  // ── handlePickService ───────────────────────────────────────────────────────
  const handlePickService = useCallback(async (user, specialInstructions = null) => {
    const currentRunnerId = runnerIdRef.current;
    const chatId = `user-${user._id}-runner-${currentRunnerId}`;

    console.log('[handlePickService] START', {
      chatId,
      serviceType: user.currentRequest?.serviceType ?? user.serviceType,
      storeStateBefore: useOrderStore.getState()._chats[chatId],
    });

    activeChatIdRef.current = chatId;

    dispatch(clearNearbyUsers());
    setHasSearched(false);
    if (searchIntervalRef.current) clearInterval(searchIntervalRef.current);

    const fullUser = {
      ...user,
      serviceType: user.currentRequest?.serviceType ?? user.serviceType ?? null,
      specialInstructions: specialInstructions ?? user.currentRequest?.specialInstructions ?? null,
    };
    
    useOrderStore.getState().clearChatOrder(chatId);

    chatManager.set(chatId, {
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


    setOrderPending(true);
    setCompletedStatusesVersion(v => v + 1);

    selectedUserRef.current = fullUser;

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

    setAwaitingChatReady(true);
    pendingChatSwitchRef.current = { user: fullUser, chatId, chatEntry: newChatEntry };

    unstable_batchedUpdates(() => {
      setSelectedUser(fullUser);
      setActiveChatId(chatId);
      setActive(newChatEntry);
      setChatHistory(prev => {
        if (prev.find(c => c.id === user._id)) return prev;
        return [newChatEntry, ...prev];
      });
      setAwaitingChatReady(true);
    });

    selectedUserRef.current = fullUser;
    console.log('[PICK] setAwaitingChatReady(true) and setActiveChatId:', chatId);
    // eslint-disable-next-line
  }, [
    dispatch, runnerIdRef, searchIntervalRef, pendingChatSwitchRef, currentOrderRef,
    selectedUserRef, setSelectedUser, setActiveChatId, setActive, setChatHistory,
    setOrderPending, setCompletedStatusesVersion, setHasSearched,
    setAwaitingChatReady,
  ]);

  // ── handleStartNewOrder ─────────────────────────────────────────────────────
  const handleStartNewOrder = useCallback(() => {
    const currentSelectedUser = selectedUserRef.current;
    const currentRunnerId = runnerIdRef.current;
    const isBotMode = activeChatIdRef.current === BOT_CHAT_ID;

    if (!isBotMode && currentSelectedUser?._id) {
      const prevChatId = `user-${currentSelectedUser._id}-runner-${currentRunnerId}`;

      if (socket && currentOrderRef.current?.orderId) {
        socket.emit('archiveChatSession', {
          chatId: prevChatId,
          orderId: currentOrderRef.current.orderId,
          status: currentOrderRef.current.status === 'task_completed' ? 'completed' : 'cancelled',
        });
      }

      chatManager.set(prevChatId, {
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

      setChatHistory(prev => prev.map(c =>
        c.userId === selectedUserRef.current?._id ? { ...c, lastMessage: '', time: '' } : c
      ));

      useOrderStore.getState().clearChatOrder(prevChatId);
      setChatSessionKey(k => k + 1);

      const prevOrderId = currentOrderRef.current?.orderId;
      currentOrderRef.current = null;
      setOrderPending(true);
      setCompletedStatusesVersion(v => v + 1);

      try { localStorage.removeItem(`currentOrder_${currentRunnerId}`); } catch { }

      if (socket && prevOrderId) {
        socket.emit('runnerStartedNewOrder', { runnerId: currentRunnerId, previousOrderId: prevOrderId });
      }
    }

    chatManager.set(BOT_CHAT_ID, {
      newOrderComplete: false,
      newOrderStep: null,
      showConnectButton: false,
      serviceType: null,
      fleetType: null,
    });

    setVerificationState(null);
    currentOrderRef.current = null;

    setTimeout(() => {
      handleBotClick();
      setNewOrderTrigger(t => t + 1);
    }, 0);
  }, [
    socket, handleBotClick, selectedUserRef, runnerIdRef, activeChatIdRef, currentOrderRef,
    setChatHistory, setOrderPending, setCompletedStatusesVersion,
    setVerificationState, setNewOrderTrigger, setChatSessionKey
  ]);

  // ── handleBackToHome ────────────────────────────────────────────────────────
  const handleBackToHome = useCallback(() => {
    const chatId = activeChatIdRef.current;
    const chatState = chatManager.get(chatId);

    if (chatState.currentOrder) {
      const terminalStatus = chatState.taskCompleted ? 'completed' : 'cancelled';
      chatManager.set(chatId, {
        currentOrder: { ...chatState.currentOrder, status: terminalStatus },
      });
      currentOrderRef.current = null;
    }

    useOrderStore.getState()._patch(chatId, {
      currentOrder: null,
      deliveryMarked: false,
      userConfirmedDelivery: false,
      completedStatuses: [],
    });

    if (chatState.taskCompleted || chatState.orderCancelled) {
      setSilentRefreshKey(k => k + 1);
    }

    chatManager.set(BOT_CHAT_ID, {
      newOrderComplete: false,
      newOrderStep: null,
      showConnectButton: false,
      serviceType: null,
      fleetType: null,
    });

    setOrderPending(false);
    setBotRefreshTrigger(t => t + 1);
    handleBotClick();
  }, [
    handleBotClick, activeChatIdRef, currentOrderRef,
    setOrderPending, setBotRefreshTrigger, setSilentRefreshKey,
  ]);

  // ── handleOrderStatusClick ──────────────────────────────────────────────────
  const handleOrderStatusClick = useCallback((statusKey, selectedUser) => {
    if (!selectedUser?._id) return;
    const chatId = `user-${selectedUser._id}-runner-${runnerId}`;
    const current = chatManager.get(chatId);
    const next = Array.isArray(current.completedOrderStatuses) && current.completedOrderStatuses.includes(statusKey)
      ? current.completedOrderStatuses
      : [...(Array.isArray(current.completedOrderStatuses) ? current.completedOrderStatuses : []), statusKey];
    chatManager.set(chatId, { completedOrderStatuses: next });
    setCompletedStatusesVersion(v => v + 1);

    if (statusKey === 'en_route_to_delivery' && socket && isConnected) {
      socket.emit('startTrackRunner', { chatId, runnerId, userId: selectedUser._id });
    }
  }, [runnerId, socket, isConnected, setCompletedStatusesVersion]);

  // ── handleSetCompletedStatuses ──────────────────────────────────────────────
  const handleSetCompletedStatuses = useCallback((s) => {
    const chatId = activeChatIdRef.current;
    const current = useOrderStore.getState()._chats[chatId]?.completedStatuses ?? [];
    const next = Array.isArray(s) ? s : typeof s === 'function' ? s(current) : [];
    chatManager.set(chatId, { completedOrderStatuses: next });
    useOrderStore.getState().setCompletedStatuses(chatId, next);
    setCompletedStatusesVersion(v => v + 1);
  }, [activeChatIdRef, setCompletedStatusesVersion]);

  // ── handleConnectToService ──────────────────────────────────────────────────
  const handleConnectToService = useCallback(async () => {
    if (!runnerLocation) return;

    let freshLocation = runnerLocation;
    try {
      const pos = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true, timeout: 5000, maximumAge: 0,
        })
      );
      freshLocation = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      setRunnerLocation(freshLocation);
    } catch (e) {
      console.warn('[handleConnectToService] GPS failed, using last known location', e);
    }

    dispatch(clearNearbyUsers());
    setHasSearched(false);

    const searchParams = {
      latitude: runnerLocation.latitude,
      longitude: runnerLocation.longitude,
      fleetType: fleetTypeRef.current || runnerData?.fleetType,
    };

    const searching = {
      id: `searching-${Date.now()}`, from: 'them', text: 'Connecting....',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'delivered',
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
          id: `verification-error-${Date.now()}`, from: 'them', text: error.reason,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: 'delivered', isKyc: true, verificationError: true,
          verificationStatus: { status: error.status, dailyCount: error.dailyCount, maxDaily: error.maxDaily, resetIn: error.resetIn },
        }]);
        setVerificationState({ canAccept: false, ...error });
      } else {
        botMessagesUpdater(prev => [...prev, {
          id: `error-${Date.now()}`, from: 'them',
          text: error.message || "Couldn't find any runners nearby. Please try again.",
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: 'delivered',
        }]);
      }
    }
  }, [dispatch, runnerLocation, runnerData?.fleetType, botMessagesUpdater, fleetTypeRef, setHasSearched, setRunnerLocation, setVerificationState]);

  // ── handleFindMore ──────────────────────────────────────────────────────────
  const handleFindMore = useCallback(() => {
    dispatch(fetchNearbyUserRequests({
      latitude: runnerLocation?.latitude,
      longitude: runnerLocation?.longitude,
      fleetType: runnerData?.fleetType,
    }));
  }, [dispatch, runnerLocation, runnerData?.fleetType]);

  // ── handleNewOrderFleetSelected ─────────────────────────────────────────────
  const handleNewOrderFleetSelected = useCallback(async (newFleetType) => {
    const currentRunnerId = runnerIdRef.current;
    chatManager.set(BOT_CHAT_ID, { newOrderComplete: true });
    fleetTypeRef.current = newFleetType;

    let latitude = null;
    let longitude = null;
    if (navigator.geolocation) {
      try {
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true, timeout: 10000, maximumAge: 0,
          });
        });
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
      } catch (error) {
        console.error('Location error:', error);
      }
    }

    if (runnerId && socket) joinRunnerRoom(currentRunnerId, null);

    dispatch(updateProfile({
      fleetType: newFleetType,
      ...(latitude !== null && longitude !== null && { latitude, longitude }),
    }));
  }, [socket, joinRunnerRoom, dispatch, runnerId, runnerIdRef, fleetTypeRef]);

  return {
    handleBotClick,
    handleUserClick,
    handlePickService,
    handleStartNewOrder,
    handleBackToHome,
    handleOrderStatusClick,
    handleSetCompletedStatuses,
    handleConnectToService,
    handleFindMore,
    handleNewOrderFleetSelected,
  };
}