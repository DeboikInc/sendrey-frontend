import { useRef, useEffect } from "react";
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Truck } from 'lucide-react';

export default function AttachmentOptionsFlow({
    isOpen,
    onClose,
    darkMode,
    onSelectCamera,
    onSelectGallery,
    onSubmitItems,
    showSubmitItems,
    deliveryMarked,
    onMarkDelivery,
    showSubmitPickupItem,
    onSubmitPickupItem,
    isPaid,
    forceReset,
}) {

    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    // forceReset kept for API compatibility but nothing to reset now
    useEffect(() => {}, [forceReset]);

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
                                <p className='border-b border-gray-600 p-2'></p>
                            </div>

                            <div className="flex flex-col gap-3">
                                {/* Submit Items — run-errand only */}
                                {showSubmitItems && (
                                    <button
                                        onClick={() => {
                                            if (!isPaid) return;
                                            // onSubmitItems just opens the form — no async needed
                                            onSubmitItems();
                                        }}
                                        disabled={!isPaid}
                                        className={`w-full flex items-center justify-center gap-3 p-4 rounded-xl transition-colors
                                            ${!isPaid
                                                ? 'opacity-40 cursor-not-allowed bg-gray-100 dark:bg-black-200'
                                                : 'bg-gray-100 dark:bg-black-200 hover:opacity-80'
                                            }`}
                                    >
                                        <Package className="h-6 w-6 text-primary" />
                                        <p className={`text-lg font-medium ${darkMode ? 'text-white' : 'text-black-200'}`}>
                                            {!isPaid
                                                ? 'Submit Items (awaiting payment)'
                                                : 'Submit Items'}
                                        </p>
                                    </button>
                                )}

                                {/* Submit Pickup Item — pick-up only */}
                                {showSubmitPickupItem && (
                                    <button
                                        onClick={() => {
                                            if (!isPaid) return;
                                            // onSubmitPickupItem just opens the form — no async needed
                                            onSubmitPickupItem();
                                        }}
                                        disabled={!isPaid}
                                        className={`w-full flex items-center justify-center gap-3 p-4 rounded-xl transition-colors
                                            ${!isPaid
                                                ? 'opacity-40 cursor-not-allowed bg-gray-100 dark:bg-black-200'
                                                : 'bg-gray-100 dark:bg-black-200 hover:opacity-80'
                                            }`}
                                    >
                                        <Package className="h-6 w-6 text-primary" />
                                        <p className={`text-lg font-medium ${darkMode ? 'text-white' : 'text-black-200'}`}>
                                            {!isPaid
                                                ? 'Submit Item (awaiting payment)'
                                                : 'Submit Pickup Item'}
                                        </p>
                                    </button>
                                )}

                                {/* Mark as Delivered — always visible */}
                                <button
                                    onClick={async () => {
                                        if (!isPaid || deliveryMarked) return;
                                        try {
                                            await onMarkDelivery();
                                        } catch {
                                            // delivery error handled upstream
                                        }
                                    }}
                                    disabled={!isPaid || deliveryMarked}
                                    className={`w-full flex items-center justify-center gap-3 p-4 rounded-xl transition-colors
                                        ${!isPaid || deliveryMarked
                                            ? 'opacity-40 cursor-not-allowed bg-gray-100 dark:bg-black-200'
                                            : 'bg-gray-100 dark:bg-black-200 hover:opacity-80'
                                        }`}
                                >
                                    <Truck className="h-6 w-6 text-green-500" />
                                    <p className={`text-lg font-medium ${darkMode ? 'text-white' : 'text-black-200'}`}>
                                        {deliveryMarked
                                            ? 'Marked as Delivered'
                                            : !isPaid
                                                ? 'Mark as Delivered (awaiting payment)'
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