import { useEffect, useCallback } from 'react';
import chatManager from '../utils/chatStateManager';
import useOrderStore from '../store/orderStore';

const BOT_CHAT_ID = 'sendrey-bot';

export function useRunnerSocketHandlers({
  socket,
  runnerId,
  runnerIdRef,
  selectedUserRef,
  activeChatIdRef,
  currentOrderRef,
  pushToActiveScreen,
  setOrderPending,
  setCompletedStatusesVersion,
  setAwaitingChatReady,
}) {
  // Memoize pushToActiveScreen callback
  const stablePushToActiveScreen = useCallback((prev) => {
    return pushToActiveScreen(prev);
  }, [pushToActiveScreen]);

  useEffect(() => {
    if (!socket) return;

    const {
      setCurrentOrder,
      mergeCurrentOrder,
      setTaskCompleted,
      setOrderCancelled,
    } = useOrderStore.getState();

    // ── resolveChatId ─────────────────────────────────────────────────────────
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
        orderId: data.orderId ?? useOrderStore.getState()._chats[chatId]?.currentOrder?.orderId,
        paymentStatus: 'paid',
        status: 'active',
      });

      currentOrderRef.current = useOrderStore.getState()._chats[chatId]?.currentOrder ?? null;
      chatManager.set(chatId, { currentOrder: currentOrderRef.current });
      stablePushToActiveScreen(prev => [...prev]);
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

      const prevOrder = useOrderStore.getState()._chats[chatId]?.currentOrder ?? null;
      const isNewOrder = !prevOrder || prevOrder.orderId !== order.orderId;

      const resolvedServiceType =
        order.serviceType ||
        order.taskType ||
        selectedUserRef.current?.currentRequest?.serviceType ||
        selectedUserRef.current?.serviceType ||
        null;

      const merged = isNewOrder
        ? { ...order, serviceType: resolvedServiceType }
        : { ...prevOrder, ...order, serviceType: resolvedServiceType };

      setCurrentOrder(chatId, merged);
      currentOrderRef.current = merged;
      chatManager.set(chatId, { currentOrder: merged });

      if (isNewOrder) {
        useOrderStore.getState()._patch(chatId, {
          taskCompleted: false,
          orderCancelled: false,
          cancellationReason: null,
          completedStatuses: [],
          deliveryMarked: false,
          userConfirmedDelivery: false,
        });
        chatManager.set(chatId, {
          completedOrderStatuses: [],
          deliveryMarked: false,
          userConfirmedDelivery: false,
          taskCompleted: false,
          orderCancelled: false,
          cancellationReason: null,
        });
        setOrderPending(false);
        setCompletedStatusesVersion(v => v + 1);
      }

      if (setAwaitingChatReady) setAwaitingChatReady(false);
    };

    // ── disputeRaised ─────────────────────────────────────────────────────────
    const onDisputeRaised = ({ orderId }) => {
      const chatId = resolveChatId({ orderId });
      if (!chatId) return;
      useOrderStore.getState().mergeCurrentOrder(chatId, { hasDispute: true });
      chatManager.set(chatId, {
        currentOrder: { ...chatManager.get(chatId).currentOrder, hasDispute: true },
      });
    };

    // ── task_completed ────────────────────────────────────────────────────────
    const onTaskCompleted = (data) => {
      const chatId = resolveChatId(data ?? {});
      if (!chatId) return;

      setTaskCompleted(chatId, true);

      const storeOrder = useOrderStore.getState()._chats[chatId]?.currentOrder ?? null;
      if (storeOrder) {
        mergeCurrentOrder(chatId, { status: 'completed', paymentStatus: 'paid' });
      }

      chatManager.set(chatId, {
        taskCompleted: true,
        currentOrder: storeOrder
          ? { ...storeOrder, status: 'completed', paymentStatus: 'paid' }
          : null,
      });

      try { localStorage.removeItem(`currentOrder_${runnerIdRef.current}`); } catch (_) { }

      const systemMsg = {
        id: `task-completed-${Date.now()}`,
        from: 'system', type: 'system', messageType: 'system',
        text: 'Task completed! Great job.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        senderId: 'system', senderType: 'system',
      };

      stablePushToActiveScreen(prev => {
        const alreadyHas = prev.some(m => m.type === 'system' && m.text?.toLowerCase().includes('task completed'));
        return alreadyHas ? prev : [...prev, systemMsg];
      });

      chatManager.updateMessages(chatId, prev => {
        const alreadyHas = prev.some(m => m.type === 'system' && m.text?.toLowerCase().includes('task completed'));
        return alreadyHas ? prev : [...prev, systemMsg];
      });
    };

    // ── orderCancelled ────────────────────────────────────────────────────────
    const onOrderCancelled = (data) => {
      const chatId = resolveChatId(data ?? {});
      if (!chatId) return;

      const cancelledBy = data?.cancelledBy ?? data?.reason ?? 'Unknown';

      setOrderCancelled(chatId, cancelledBy);
      mergeCurrentOrder(chatId, { status: 'cancelled' });

      const storeOrder = useOrderStore.getState()._chats[chatId]?.currentOrder ?? null;
      currentOrderRef.current = storeOrder ? { ...storeOrder, status: 'cancelled' } : null;
      chatManager.set(chatId, {
        orderCancelled: true,
        cancellationReason: cancelledBy,
        currentOrder: currentOrderRef.current,
      });

      const cancelMsg = {
        id: `cancel-${Date.now()}`,
        from: 'system', type: 'system', messageType: 'system',
        text: cancelledBy === 'runner' ? 'You cancelled this order.' : 'The user cancelled this order.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        senderId: 'system', senderType: 'system',
      };

      stablePushToActiveScreen(prev => {
        const alreadyHas = prev.some(m => m.text?.toLowerCase().includes('cancelled this order'));
        return alreadyHas ? prev : [...prev, cancelMsg];
      });

      chatManager.updateMessages(chatId, prev => {
        const alreadyHas = prev.some(m => m.text?.toLowerCase().includes('cancelled this order'));
        return alreadyHas ? prev : [...prev, cancelMsg];
      });
    };

    // Register event listeners
    socket.on('paymentSuccess', onPayment);
    socket.on('paymentReceived', onPayment);
    socket.on('orderCreated', onOrderCreated);
    socket.on('task_completed', onTaskCompleted);
    socket.on('orderCancelled', onOrderCancelled);
    socket.on('disputeRaised', onDisputeRaised);

    // Cleanup function
    return () => {
      socket.off('paymentSuccess', onPayment);
      socket.off('paymentReceived', onPayment);
      socket.off('orderCreated', onOrderCreated);
      socket.off('task_completed', onTaskCompleted);
      socket.off('orderCancelled', onOrderCancelled);
      socket.off('disputeRaised', onDisputeRaised);
    };
    // Include all refs and stable callbacks in dependency array
  }, [
    socket,
    runnerId,
    runnerIdRef,
    selectedUserRef,
    activeChatIdRef,
    currentOrderRef,
    stablePushToActiveScreen,
    setOrderPending,
    setCompletedStatusesVersion,
    setAwaitingChatReady,
  ]);
}