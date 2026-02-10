import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Image } from 'lucide-react';

export default function AttachmentOptionsFlow({
    isOpen,
    onClose,
    darkMode,
    onSelectCamera,
    onSelectGallery,
}) {
    if (!isOpen) return null;

    const handleCameraClick = () => {
        if (onSelectCamera) {
            onSelectCamera();
        }
    };

    

    const handleGalleryClick = () => {
        if (onSelectGallery) {
            onSelectGallery();
        }
    };

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
                                onClick={handleCameraClick}
                                className={`w-full flex items-center justify-center gap-3 text-center p-4 mb-3 rounded-xl ${darkMode ? 'bg-black-200 text-white' : 'bg-gray-100 text-black'
                                    } transition-colors`}
                            >
                                <Camera className="h-6 w-6 text-blue-500" />
                                <p className="text-lg font-medium">
                                    Take Photo
                                </p>
                            </button>

                            <button
                                onClick={handleGalleryClick}
                                className={`w-full flex items-center justify-center gap-3 text-center p-4 rounded-xl ${darkMode ? 'bg-black-200 text-white' : 'bg-gray-100 text-black'
                                    } transition-colors`}
                            >
                                <Image className="h-6 w-6 text-green-500" />
                                <p className="text-lg font-medium">
                                    Choose from Gallery
                                </p>
                            </button>

                        </div>

                        <div className="h-8 backdrop-blur-sm"></div>

                        <button
                            onClick={onClose}
                            className={`w-full text-center p-4 rounded-xl border border-red-600 ${darkMode ? 'bg-black-100' : 'bg-white'}`}
                        >
                            <p className="font-medium text-red-600">
                                Cancel
                            </p>
                        </button>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}