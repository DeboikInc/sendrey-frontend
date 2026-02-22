// runner component
import React, { useState, useEffect } from 'react';
import { ArrowLeft, ChevronRight, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const OrderStatusFlow = ({
    isOpen,
    onClose,
    orderData,
    darkMode,
    onStatusClick,
    completedStatuses = [],
    setCompletedStatuses,
    socket,
    taskType = orderData?.taskType
}) => {
    const [showFullView, setShowFullView] = useState(false);


    const getFilteredStatuses = (taskType) => {
        // Shopping flow (run-errand)
        const shoppingStatuses = [
            { id: 1, label: "Arrived at market", key: "arrived_at_market" },
            { id: 3, label: "Purchase in progress", key: "purchase_in_progress" },
            { id: 4, label: "Purchase completed", key: "purchase_completed" },
            { id: 5, label: "En route to delivery", key: "en_route_to_delivery" },
            { id: 6, label: "Item(s) delivered", key: "item_delivered" },
            { id: 7, label: "Task completed", key: "task_completed" }
        ];

        // Pickup flow (pick-up)
        const pickupStatuses = [
            { id: 1, label: "Arrived at pickup location", key: "arrived_at_pickup_location" },
            { id: 2, label: "Item collected", key: "item_collected" },
            { id: 3, label: "En route to delivery", key: "en_route_to_delivery" },
            { id: 4, label: "Item delivered", key: "item_delivered" },
            { id: 5, label: "Task completed", key: "task_completed" }
        ];

        return taskType === 'pickup_delivery' ? pickupStatuses : shoppingStatuses;
    };

    const statuses = getFilteredStatuses(taskType);

    const deliveryLocation = orderData?.deliveryLocation || "Delivery Location";
    const chatId = orderData?.chatId;
    const runnerId = orderData?.runnerId;
    const userId = orderData?.userId;

    const completionPercentage = Math.round((completedStatuses.length / statuses.length) * 100);

    const handleStatusClick = (statusKey) => {

        // Emit to backend
        if (socket) {
            console.log('Emitting updateStatus:', { chatId, status: statusKey });
            socket.emit('updateStatus', {
                chatId,
                status: statusKey
            });
        }

        // Mark as completed
        if (setCompletedStatuses) {
            setCompletedStatuses(prev => {
                if (prev.includes(statusKey)) return prev;
                return [...prev, statusKey];
            });
        }

        // Call parent handler
        if (onStatusClick) {
            onStatusClick(statusKey, taskType);
        }

        // Close after showing green
        setTimeout(() => {
            onClose();
        }, 800);
    };

    const handleInvoiceSent = () => {
        console.log('Invoice sent successfully, marking send_invoice as complete');
        if (setCompletedStatuses) {
            setCompletedStatuses(prev => {
                if (prev.includes("send_invoice")) return prev;
                return [...prev, "send_invoice"];
            });
        }
        onClose();
    };

    const handleInvoiceClose = () => {
        console.log('Invoice screen closed without sending');
        setShowFullView(true);
    };

    useEffect(() => {
        if (!socket) return;

        const handleInvoiceDeclined = (data) => {
            console.log('Invoice declined, removing status:', data.statusToRemove);
            if (data.statusToRemove && setCompletedStatuses) {
                setCompletedStatuses(prev =>
                    prev.filter(status => status !== data.statusToRemove)
                );
            }
        };

        socket.on('invoiceDeclined', handleInvoiceDeclined);

        return () => {
            socket.off('invoiceDeclined', handleInvoiceDeclined);
        };
    }, [socket, setCompletedStatuses]);

    if (!isOpen) return null;

    return (
        <>
            <AnimatePresence>
                {/* Options Popup */}
                {!showFullView  && (
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
                                    <h3 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-black-200'}`}>
                                        Options
                                    </h3>
                                    <p className='border-b border-gray-600 p-2'></p>
                                </div>

                                <button
                                    onClick={() => setShowFullView(true)}
                                    className={`w-full text-center p-4 rounded-xl ${darkMode ? 'bg-black-200' : 'bg-gray-100'} transition-colors`}
                                >
                                    <div>
                                        <p className={`text-lg ${darkMode ? 'text-primary' : 'text-primary'}`}>
                                            {deliveryLocation}
                                        </p>
                                    </div>
                                </button>
                            </div>

                            <div className="h-8 backdrop-blur-sm"></div>

                            <button
                                onClick={onClose}
                                className={`w-full text-center p-4 rounded-xl border border-primary ${darkMode ? 'bg-black-100' : 'bg-white'}`}
                            >
                                <p className="font-medium text-red-600 dark:text-primary">Cancel</p>
                            </button>
                        </motion.div>
                    </motion.div>
                )}

                {/* Status page */}
                {showFullView  && (
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className={`absolute inset-0 z-50 ${darkMode ? 'bg-black-100' : 'bg-white'}`}
                    >
                        <div className={`sticky top-0 ${darkMode ? 'bg-primary' : 'bg-primary'} text-white p-4 z-10`}>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setShowFullView(false)}
                                    className="p-2 hover:bg-white/10 rounded-full transition-colors"
                                >
                                    <ArrowLeft className="h-5 w-5" />
                                </button>
                                <span className="font-semibold text-lg ml-auto mr-auto">{deliveryLocation}</span>
                            </div>
                        </div>

                        <div className="p-4 space-y-6 overflow-y-auto" style={{ height: 'calc(100vh - 64px)' }}>
                            <div className="bg-gray-200 dark:bg-gray-700 rounded-2xl h-48 flex items-center justify-center">
                                <p className="text-gray-600 dark:text-white">Map showing delivery location</p>
                            </div>

                            <div className="space-y-3">
                                <div>
                                    <h2 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-black-200'}`}>
                                        {completionPercentage}%
                                    </h2>
                                </div>

                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                                    <div
                                        className="bg-primary h-3 rounded-full transition-all duration-500"
                                        style={{ width: `${completionPercentage}%` }}
                                    />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <h3 className={`font-semibold ${darkMode ? 'text-white' : 'text-black-200'}`}>
                                    Send updates to Sender:
                                </h3>

                                <div className={`rounded-2xl overflow-hidden ${darkMode ? 'bg-black-200' : 'bg-gray-50'}`}>
                                    {statuses.map((item, index) => (
                                        <button
                                            key={item.id}
                                            onClick={() => handleStatusClick(item.key)}
                                            className={`w-full p-4 flex items-center justify-between transition-colors ${
                                                index !== statuses.length - 1 ? 'border-b border-gray-200 dark:border-gray-700' : ''
                                            } ${
                                                completedStatuses.includes(item.key)
                                                    ? 'bg-black-200 dark:bg-green-900/20'
                                                    : 'hover:bg-gray-100 dark:hover:bg-primary'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                                                        completedStatuses.includes(item.key)
                                                            ? 'bg-green-500 border-green-500'
                                                            : 'border-gray-300 dark:border-gray-600'
                                                    }`}
                                                >
                                                    {completedStatuses.includes(item.key) && (
                                                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    )}
                                                </div>
                                                <span className={`font-medium ${
                                                    completedStatuses.includes(item.key)
                                                        ? 'text-green-600 dark:text-green-400'
                                                        : darkMode ? 'text-white' : 'text-black-200'
                                                }`}>
                                                    {item.label}
                                                </span>
                                            </div>
                                            <ChevronRight className={`h-5 w-5 ${
                                                completedStatuses.includes(item.key) ? 'text-green-500' : 'text-gray-400'
                                            }`} />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

export default OrderStatusFlow;