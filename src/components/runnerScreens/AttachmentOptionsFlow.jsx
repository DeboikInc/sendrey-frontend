import { useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Truck } from 'lucide-react';
import useOrderStore from '../../store/orderStore';

export default function AttachmentOptionsFlow({
    isOpen,
    onClose,
    darkMode,
    onSelectCamera,
    onSelectGallery,
    onSubmitItems,
    showSubmitItems,
    onMarkDelivery,
    showSubmitPickupItem,
    onSubmitPickupItem,
    forceReset,
    chatId,
    markingDelivery,
}) {
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    useEffect(() => { }, [forceReset]);

    const currentOrder = useOrderStore(
        useCallback(s => s.getChat(chatId).currentOrder, [chatId])
    );

    const deliveryMarked = useOrderStore(
        useCallback(s => s.getChat(chatId).deliveryMarked, [chatId])
    );

    const isPaid =
        currentOrder?.paymentStatus === 'paid' ||
        currentOrder?.status === 'active';

    const itemSubmissionApproved = useOrderStore(
        useCallback(
            s => (s.getChat(chatId).messages ?? []).some(
                m => (
                    ((m.type === 'item_submission' || m.messageType === 'item_submission') && m.status === 'approved')
                    ||
                    (m.type === 'system' && m.text?.toLowerCase().includes('approved the items'))
                )
            ),
            [chatId]
        )
    );

    const pickupItemApproved = useOrderStore(
        useCallback(
            s => (s.getChat(chatId).messages ?? []).some(
                m => (
                    ((m.type === 'pickup_item_submission' || m.messageType === 'pickup_item_submission') && m.status === 'approved')
                    ||
                    (m.type === 'system' && m.text?.toLowerCase().includes('approved the pickup item'))
                )
            ),
            [chatId]
        )
    );

    const approvedByName = useOrderStore(
        useCallback(
            s => {
                const msg = (s.getChat(chatId).messages ?? []).find(
                    m => m.type === 'system' && m.id?.startsWith('delivery-confirmed-runner-')
                );
                return msg?.text?.split(' confirmed')[0] || null;
            },
            [chatId]
        )
    );

    const completedOrderStatuses = useOrderStore(
        useCallback(s => s.getChat(chatId).completedStatuses ?? [], [chatId])
    );

    const hasReachedOrigin = showSubmitItems
        ? completedOrderStatuses.includes('arrived_at_market')
        : showSubmitPickupItem
            ? completedOrderStatuses.includes('arrived_at_pickup_location')
            : true;

    // ← pure derived value, no refs, re-renders whenever any selector above updates
    const canMarkDelivery =
        completedOrderStatuses.includes('arrived_at_delivery_location') &&
        (showSubmitItems
            ? itemSubmissionApproved || currentOrder?.status === 'items_approved'
            : showSubmitPickupItem
                ? pickupItemApproved || currentOrder?.status === 'items_approved'
                : true);

    const msgs = useOrderStore(s => s.getChat(chatId).messages ?? []);

    // Temporarily log to see what your approval messages actually look like
    console.log('[ERRAND APPROVAL CHECK]', msgs.filter(m =>
        m.type === 'item_submission' ||
        m.messageType === 'item_submission' ||
        (m.type === 'system' && m.text?.toLowerCase().includes('approv'))
    ));

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/50 z-50 flex items-end"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full rounded-t-3xl p-6"
                    >
                        <div className={`${darkMode ? 'bg-black-100' : 'bg-white'} rounded-2xl p-4`}>
                            <div className="text-center mb-6">
                                <h3 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-black-200'}`}>
                                    Options
                                </h3>
                                <p className='border-b border-black-100/20 dark:border-gray-600 p-2'></p>
                            </div>

                            <div className="flex flex-col gap-3">
                                {showSubmitItems && (
                                    <button
                                        onClick={() => { if (!isPaid || !hasReachedOrigin || itemSubmissionApproved) return; onSubmitItems(); }}
                                        disabled={!isPaid || !hasReachedOrigin || itemSubmissionApproved}
                                        className={`w-full flex items-center justify-center gap-3 p-4 rounded-xl transition-colors
                                            ${!isPaid || !hasReachedOrigin || itemSubmissionApproved
                                                ? 'opacity-40 cursor-not-allowed bg-gray-100 dark:bg-black-200'
                                                : 'bg-gray-100 dark:bg-black-200 hover:opacity-80'
                                            }`}
                                    >
                                        <Package className="h-6 w-6 text-primary" />
                                        <p className={`text-lg font-medium ${darkMode ? 'text-white' : 'text-black-200'}`}>
                                            {itemSubmissionApproved
                                                ? `Item(s) approved${approvedByName ? ` by ${approvedByName}` : ''}`
                                                : !isPaid
                                                    ? 'Submit Item(s) (awaiting payment)'
                                                    : !hasReachedOrigin
                                                        ? 'Submit Item(s) (get to market first)'
                                                        : 'Submit Item(s)'}
                                        </p>
                                    </button>
                                )}

                                {showSubmitPickupItem && (
                                    <button
                                        onClick={() => { if (!isPaid || !hasReachedOrigin || pickupItemApproved) return; onSubmitPickupItem(); }}
                                        disabled={!isPaid || !hasReachedOrigin || pickupItemApproved}
                                        className={`w-full flex items-center justify-center gap-3 p-4 rounded-xl transition-colors
                                        ${!isPaid || !hasReachedOrigin || pickupItemApproved
                                                ? 'opacity-40 cursor-not-allowed bg-gray-100 dark:bg-black-200'
                                                : 'bg-gray-100 dark:bg-black-200 hover:opacity-80'
                                            }`}
                                    >
                                        <Package className="h-6 w-6 text-primary" />
                                        <p className={`text-lg font-medium ${darkMode ? 'text-white' : 'text-black-200'}`}>
                                            {pickupItemApproved
                                                ? `Item(s) approved${approvedByName ? ` by ${approvedByName}` : ''}`
                                                : !isPaid
                                                    ? 'Submit Item(s) (awaiting payment)'
                                                    : !hasReachedOrigin
                                                        ? 'Submit Pickup Item (get to pickup location first)'
                                                        : 'Submit Pickup Item'}
                                        </p>
                                    </button>
                                )}

                                <button
                                    onClick={async () => {
                                        if (!isPaid || deliveryMarked || !canMarkDelivery || markingDelivery) return;
                                        try {
                                            await onMarkDelivery();
                                        } catch (e) { console.error('[MARK DELIVERY] error:', e); }
                                    }}
                                    disabled={!isPaid || deliveryMarked || !canMarkDelivery || markingDelivery}
                                    className={`w-full flex items-center justify-center gap-3 p-4 rounded-xl transition-colors
    ${!isPaid || deliveryMarked || !canMarkDelivery || markingDelivery
                                            ? 'opacity-40 cursor-not-allowed bg-gray-100 dark:bg-black-200'
                                            : 'bg-gray-100 dark:bg-black-200 hover:opacity-80'
                                        }`}
                                >
                                    <Truck className="h-6 w-6 text-green-500" />
                                    <p className={`text-lg font-medium ${darkMode ? 'text-white' : 'text-black-200'}`}>
                                        {deliveryMarked
                                            ? 'Marked as Delivered'
                                            : markingDelivery
                                                ? 'Sending…'
                                                : !isPaid
                                                    ? 'Mark as Delivered (awaiting payment)'
                                                    : !completedOrderStatuses.includes('arrived_at_delivery_location')
                                                        ? 'Mark as Delivered (get to delivery location first)'
                                                        : !canMarkDelivery
                                                            ? 'Mark as Delivered (waiting for item approval)'
                                                            : 'Mark as Delivered'}
                                    </p>
                                </button>
                            </div>
                        </div>

                        <div className="h-4" />

                        <button
                            onClick={onClose}
                            className={`w-full text-center p-4 rounded-xl border border-red-600 ${darkMode ? 'bg-black-100' : 'bg-white'}`}
                        >
                            <p className="font-medium text-red-600">Cancel</p>
                        </button>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}