import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, Info, Flag, Ban, AlertTriangle, FileText } from 'lucide-react';

export default function MoreOptionsSheet({
  isOpen,
  onClose,
  darkMode,
  onWallet,
  onRaiseDispute,
  hasActiveOrder, onOrderDetails
}) {
  if (!isOpen) return null;

  const options = [
    {
      icon: <Wallet className="w-5 h-5 text-primary" />,
      label: 'My Wallet',
      description: 'View balance & transactions',
      onClick: () => {
        onClose();
        onWallet();
      }
    },
    ...(hasActiveOrder ? [
      {
        icon: <FileText className="w-5 h-5 text-secondary" />,
        label: 'Order Details',
        description: 'View payment breakdown & status',
        onClick: () => { onClose(); onOrderDetails(); }  
      },
      {
        icon: <AlertTriangle className="w-5 h-5 text-red-500" />,
        label: 'Raise Dispute',
        description: 'Report an issue with this order',
        onClick: () => { onClose(); onRaiseDispute(); }
      }] : []),
    // {
    //   icon: <Flag className="w-5 h-5 text-yellow-500" />,
    //   label: 'Report Issue',
    //   description: 'Report a problem',
    //   onClick: () => {}
    // },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 z-50 flex items-end"
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

              {/* Title */}
              <div className="text-center mb-4">
                <h3 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-black-200'}`}>
                  Options
                </h3>
                <div className={`border-b mt-3 ${darkMode ? 'border-black-200' : 'border-gray-1001'}`} />
              </div>

              {/* Options */}
              <div className="space-y-2">
                {options.map((option, index) => (
                  <button
                    key={index}
                    onClick={option.onClick}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl transition-colors ${darkMode
                      ? 'bg-black-200 hover:bg-black-200/80'
                      : 'bg-gray-1001 hover:bg-gray-100'
                      }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      {option.icon}
                    </div>
                    <div className="text-left">
                      <p className={`font-semibold ${darkMode ? 'text-white' : 'text-black-200'}`}>
                        {option.label}
                      </p>
                      <p className={`text-xs ${darkMode ? 'text-gray-1002' : 'text-gray-600'}`}>
                        {option.description}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="h-4" />

            {/* Cancel */}
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