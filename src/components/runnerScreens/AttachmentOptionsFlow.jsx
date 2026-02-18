import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Image, Package } from 'lucide-react';

export default function AttachmentOptionsFlow({
    isOpen,
    onClose,
    darkMode,
    onSelectCamera,
    onSelectGallery,
    onSubmitItems,
    currentOrder,
    deliveryMarked,
    onMarkDelivery,
}) {
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

                            <button
                                onClick={onSelectCamera}
                                className={`w-full flex items-center justify-center gap-3 text-center p-4 mb-3 rounded-xl ${darkMode ? 'bg-black-200 text-white' : 'bg-gray-100 text-black'
                                    } transition-colors`}
                            >
                                <Camera className="h-6 w-6 text-secondary" />
                                <p className="text-lg font-medium">Take Photo</p>
                            </button>

                            <button
                                onClick={onSelectGallery}
                                className={`w-full flex items-center justify-center gap-3 text-center p-4 mb-3 rounded-xl ${darkMode ? 'bg-black-200 text-white' : 'bg-gray-100 text-black'
                                    } transition-colors`}
                            >
                                <Image className="h-6 w-6 text-secondary" />
                                <p className="text-lg font-medium">Choose from Gallery</p>
                            </button>


                            {(currentOrder?.taskType === 'shopping' || currentOrder?.taskType === 'run-errand') &&
                                currentOrder?.paymentStatus === 'paid' && (
                                    <button
                                        onClick={onSubmitItems}
                                        className={`w-full flex items-center justify-center gap-3 text-center p-4 mb-3 rounded-xl ${darkMode ? 'bg-black-200 text-white' : 'bg-gray-100 text-black'
                                            } transition-colors`}
                                    >
                                        <Package className="h-6 w-6 text-primary" />
                                        <p className="text-lg font-medium">Submit Items</p>
                                    </button>
                                )}
                        </div>

                        <div className="h-8 backdrop-blur-sm"></div>

                        {currentOrder &&
                            currentOrder.paymentStatus === 'paid' &&
                            !deliveryMarked && (
                                <button
                                    onClick={onMarkDelivery}
                                    className="flex items-center gap-3 w-full p-4 rounded-xl hover:bg-primary/10 transition-colors"
                                >
                                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                                        <Package className="w-6 h-6 text-primary" />
                                    </div>
                                    <div className="flex-1 text-left">
                                        <p className={`font-semibold ${darkMode ? 'text-white' : 'text-black-200'}`}>
                                            Mark as Delivered
                                        </p>
                                        <p className={`text-sm ${darkMode ? 'text-gray-1002' : 'text-gray-600'}`}>
                                            Confirm you have delivered the order
                                        </p>
                                    </div>
                                </button>
                            )}

                        <button
                            onClick={onClose}
                            className={`w-full text-center p-4 rounded-xl border border-red-600 ${darkMode ? 'bg-black-100' : 'bg-white'
                                }`}
                        >
                            <p className="font-medium text-red-600">Cancel</p>
                        </button>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}