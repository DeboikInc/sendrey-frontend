import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, Settings  } from 'lucide-react';

export default function MoreMenu({
    isOpen,
    onClose,
    darkMode,
    onWallet,
    onSettings,
    userId,
    // add more action props here as needed e.g. onSettings
}) {
    if (!isOpen) return null;

    const menuItems = [
        {
            icon: <Wallet className="h-6 w-6 text-primary" />,
            label: 'My Wallet',
            onClick: () => { onClose(); setTimeout(() => onWallet(), 200); },
        },
        {
            icon: <Settings className="h-6 w-6 text-primary" />,
            label: 'Settings',
            onClick: () => { onClose(); setTimeout(() => onSettings(), 200); },
        },
        // add more items here as needed
    ];

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/50 z-[9999] flex items-end"
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
                            <div className="text-center mb-4">
                                <h3 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-black-200'}`}>
                                    More Options
                                </h3>
                                <p className="border-b border-gray-600 p-2" />
                            </div>

                            {!userId ? (
                                <div className="flex flex-col items-center justify-center py-8 text-center">
                                    {/* <p className="text-2xl mb-2">🔒</p> */}
                                    <p className={`font-medium ${darkMode ? 'text-gray-300' : 'text-black-200'}`}>
                                        Nothing to see here
                                    </p>
                                    <p className={`text-sm mt-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                                        Sign up to continue
                                    </p>
                                </div>
                            ) : (
                                menuItems.map((item, i) => (
                                    <button
                                        key={i}
                                        onClick={item.onClick}
                                        className={`w-full flex items-center justify-center gap-3 text-center p-4 mb-3 rounded-xl transition-colors
                                            ${darkMode ? 'bg-black-200 text-white' : 'bg-gray-100 text-black'}`}
                                    >
                                        {item.icon}
                                        <p className="text-lg font-medium">{item.label}</p>
                                    </button>
                                ))
                            )}
                        </div>

                        <div className="h-4" />

                        <button
                            onClick={onClose}
                            className={`w-full text-center p-4 rounded-xl border border-primary ${darkMode ? 'bg-black-100' : 'bg-white'}`}
                        >
                            <p className="font-medium text-primary">Cancel</p>
                        </button>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}