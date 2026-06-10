import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * userOrderStore
 *
 * Single source of truth for the user's current active order.
 * Replaces prop-drilled `currentOrder` across ChatScreen, DisputeForm,
 * OrderDetailsSheet, MoreOptionsSheet, and any other consumer.
 *
 * Mirrors the pattern used by the runner's orderStore.
 */
const useUserOrderStore = create(
  persist(
    (set, get) => ({
      currentOrder: null,
      orderCancelled: false,
      cancelledByName: null,
      taskCompleted: false,

      // ── Setters ────────────────────────────────────────────────────────────

      setCurrentOrder: (order) => {
        console.log('[store] setCurrentOrder called:', order?.orderId, new Error().stack.split('\n')[2]);
        set({ currentOrder: order });
      },

      updateCurrentOrder: (patch) =>
        set((state) => ({
          currentOrder: state.currentOrder
            ? { ...state.currentOrder, ...patch }
            : null,
        })),

      setOrderCancelled: (cancelled, byName = null) =>
        set({ orderCancelled: cancelled, cancelledByName: byName }),

      setTaskCompleted: (done) => set({ taskCompleted: done }),

      clearOrder: () =>
        set({
          currentOrder: null,
          orderCancelled: false,
          cancelledByName: null,
          taskCompleted: false,
        }),

      // ── Derived ───────────────────────────────────────────────────────────
      // Keep logic here so consumers don't re-derive it everywhere.

      /** True when there's an active non-terminal order. */
      hasActiveOrder: () => {
        const { currentOrder, orderCancelled } = get();
        if (!currentOrder || orderCancelled) return false;
        const terminal = ['completed', 'cancelled', 'task_completed'];
        return !terminal.includes(currentOrder.status);
      },

      /** Resolved serviceType — handles both field names. */
      serviceType: () => {
        const { currentOrder } = get();
        return currentOrder?.serviceType || currentOrder?.taskType || null;
      },

      _logState: () => {
        const s = get();
        console.log('[userOrderStore] current state:', {
          orderId: s.currentOrder?.orderId,
          status: s.currentOrder?.status,
          orderCancelled: s.orderCancelled,
          taskCompleted: s.taskCompleted,
        });
      },
    }),
    {
      name: 'user-order-store',
      storage: createJSONStorage(() => sessionStorage), // session only — clears on tab close
      partialize: (state) => ({
        // Don't persist taskCompleted / orderCancelled — rehydrated from chat history
        currentOrder: state.currentOrder,
      }),
    }
  )
);

export default useUserOrderStore;