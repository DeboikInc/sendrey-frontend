// store/orderStore.js
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

const DEFAULT_CHAT = () => ({
  currentOrder: null,
  completedStatuses: [],
  messages: [],
  deliveryMarked: false,
  userConfirmedDelivery: false,
  specialInstructions: null,
  //  terminal flags live here so ALL consumers react ──────────────────
  taskCompleted: false,
  orderCancelled: false,
  cancellationReason: null,
});

const useOrderStore = create(persist((set, get) => ({
  _chats: {},

  // ── Getter ─────────────────────────────────────────────────────────────────
  getChat: (chatId) => get()._chats[chatId] ?? DEFAULT_CHAT(),

  // ── Internal helper ────────────────────────────────────────────────────────
  _patch: (chatId, partial) => set(state => ({
    _chats: {
      ...state._chats,
      [chatId]: { ...(state._chats[chatId] ?? DEFAULT_CHAT()), ...partial },
    },
  })),

  // ── Order ──────────────────────────────────────────────────────────────────
  setCurrentOrder: (chatId, orderOrUpdater) => set(state => {
    const prev = state._chats[chatId] ?? DEFAULT_CHAT();
    const next = typeof orderOrUpdater === 'function'
      ? orderOrUpdater(prev.currentOrder ?? null)
      : orderOrUpdater;
    return { _chats: { ...state._chats, [chatId]: { ...prev, currentOrder: next } } };
  }),

  mergeCurrentOrder: (chatId, partial) => set(state => {
    const prev = state._chats[chatId] ?? DEFAULT_CHAT();
    return {
      _chats: {
        ...state._chats,
        [chatId]: { ...prev, currentOrder: { ...(prev.currentOrder ?? {}), ...partial } },
      },
    };
  }),

  // ── Delivery ───────────────────────────────────────────────────────────────
  setDeliveryMarked: (chatId, val) => get()._patch(chatId, { deliveryMarked: val }),
  setUserConfirmedDelivery: (chatId, val) => get()._patch(chatId, { userConfirmedDelivery: val }),

  // ── Instructions ───────────────────────────────────────────────────────────
  setSpecialInstructions: (chatId, val) => get()._patch(chatId, { specialInstructions: val }),

  // ── Status chips ───────────────────────────────────────────────────────────
  setCompletedStatuses: (chatId, valOrUpdater) => set(state => {
    const prev = state._chats[chatId] ?? DEFAULT_CHAT();
    const next = typeof valOrUpdater === 'function'
      ? valOrUpdater(prev.completedStatuses ?? [])
      : valOrUpdater;
    return { _chats: { ...state._chats, [chatId]: { ...prev, completedStatuses: next } } };
  }),

  addCompletedStatus: (chatId, statusKey) => set(state => {
    const prev = state._chats[chatId] ?? DEFAULT_CHAT();
    const existing = prev.completedStatuses ?? [];
    if (existing.includes(statusKey)) return state; // no-op
    return {
      _chats: {
        ...state._chats,
        [chatId]: { ...prev, completedStatuses: [...existing, statusKey] },
      },
    };
  }),

  // ── Terminal flags (NEW — key fix) ─────────────────────────────────────────
  setTaskCompleted: (chatId, val) => get()._patch(chatId, { taskCompleted: val }),

  setOrderCancelled: (chatId, reason) => get()._patch(chatId, {
    orderCancelled: true,
    cancellationReason: reason ?? null,
  }),

  // ── Reset for new session ──────────────────────────────────────────────────
  clearChatOrder: (chatId) => set(state => ({
    _chats: {
      ...state._chats,
      [chatId]: DEFAULT_CHAT(),
    },
  })),

  clearChat: (chatId) => set(state => {
    const chats = { ...state._chats };
    delete chats[chatId];
    return { _chats: chats };
  }),

  setMessages: (chatId, messages) => set(state => {
    const prev = state._chats[chatId] ?? DEFAULT_CHAT();
    return { _chats: { ...state._chats, [chatId]: { ...prev, messages } } };
  }),

  getMessages: (chatId) =>
    get()._chats[chatId]?.messages ?? [],

  clearMessages: (chatId) => set(state => {
    const prev = state._chats[chatId] ?? DEFAULT_CHAT();
    return { _chats: { ...state._chats, [chatId]: { ...prev, messages: [] } } };
  }),
  clearPersistedChat: (chatId) => {
    set(state => {
      const chats = { ...state._chats };
      delete chats[chatId];
      return { _chats: chats };
    });
  },

  _reset: () => set({ _chats: {} }),
}),
  {
    name: 'sendrey-order-store',
    // version: 2,
    storage: createJSONStorage(() => localStorage),
    partialize: (state) => ({ _chats: state._chats }),
    // migrate: (persistedState, version) => {
    //   // Wipe everything on version mismatch — fresh start
    //   return { _chats: {} };
    // }
  }
));

export default useOrderStore;