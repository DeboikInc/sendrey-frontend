import React from 'react';
import { CheckCircle } from 'lucide-react';

const PaymentSuccessMessage = ({ message, darkMode }) => {
  // Support both old (message.paymentDetails) and new (message.paymentData) shapes
  const data = message?.paymentData || message?.paymentDetails || {};
  const { totalAmount, paymentMethod } = data;
  const text = message?.text || 'Your order has been confirmed';

  return (
    <div className="flex justify-center my-4 px-4">
      <div className={`max-w-md w-full rounded-2xl shadow-lg border p-6 ${
        darkMode ? 'bg-green-900/20 border-green-800' : 'bg-green-50 border-green-200'
      }`}>
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-3 bg-green-500/20">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>

          <h3 className={`text-xl font-bold mb-2 ${darkMode ? 'text-green-400' : 'text-green-700'}`}>
            Payment Successful!
          </h3>

          <p className={`text-sm mb-4 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            {text}
          </p>

          {totalAmount && (
            <div className={`rounded-xl p-4 ${darkMode ? 'bg-gray-800/50' : 'bg-white'}`}>
              <div className="flex justify-between items-center">
                <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Amount Paid
                </span>
                <span className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  ₦{Number(totalAmount).toLocaleString()}
                </span>
              </div>

              {paymentMethod && (
                <div className="flex justify-between items-center mt-2">
                  <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                    Payment Method
                  </span>
                  <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    {paymentMethod === 'wallet' ? 'Wallet' : 'Card'}
                  </span>
                </div>
              )}
            </div>
          )}

          <p className={`text-xs mt-4 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
            Your runner will start processing your order shortly
          </p>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccessMessage;