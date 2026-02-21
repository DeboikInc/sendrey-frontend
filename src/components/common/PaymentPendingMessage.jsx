import React from 'react';
import { Clock, Loader } from 'lucide-react';

const PaymentPendingMessage = ({ message, darkMode }) => {
  const text = message?.text || 'Please wait while we confirm your payment...';

  return (
    <div className="flex justify-center my-4 px-4">
      <div className={`max-w-md w-full rounded-2xl shadow-lg border p-6 ${
        darkMode ? 'bg-yellow-900/20 border-yellow-800' : 'bg-yellow-50 border-yellow-200'
      }`}>
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-3 bg-yellow-500/20">
            <Loader className="w-8 h-8 text-yellow-500 animate-spin" />
          </div>

          <h3 className={`text-xl font-bold mb-2 ${darkMode ? 'text-yellow-400' : 'text-yellow-700'}`}>
            Payment Processing
          </h3>

          <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            {text}
          </p>

          <div className="flex items-center justify-center gap-2 mt-4">
            <Clock className={`w-4 h-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
            <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              This usually takes a few seconds
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentPendingMessage;