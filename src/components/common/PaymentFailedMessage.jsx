import React from 'react';
import { XCircle, RefreshCw } from 'lucide-react';

const PaymentFailedMessage = ({ message, darkMode, onRetry }) => {
  const { orderId, errorMessage } = message;

  return (
    <div className="flex justify-center my-4 px-4">
      <div className={`max-w-md w-full rounded-2xl shadow-lg ${
        darkMode ? 'bg-red-900/20 border-red-800' : 'bg-red-50 border-red-200'
      } border p-6`}>
        
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-3 bg-red-500/20">
            <XCircle className="w-10 h-10 text-red-500" />
          </div>
          
          <h3 className={`text-xl font-bold mb-2 ${
            darkMode ? 'text-red-400' : 'text-red-700'
          }`}>
            Payment Failed
          </h3>
          
          <p className={`text-sm mb-4 ${
            darkMode ? 'text-gray-300' : 'text-gray-600'
          }`}>
            {errorMessage || 'We couldn\'t process your payment. Please try again.'}
          </p>

          <button
            onClick={() => onRetry(orderId)}
            className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all ${
              darkMode
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
          >
            <RefreshCw className="w-5 h-5" />
            Retry Payment
          </button>

          <p className={`text-xs mt-4 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
            Need help? Contact support
          </p>
        </div>
      </div>
    </div>
  );
};

export default PaymentFailedMessage;