import React, { useState } from 'react';
import { Wallet, CreditCard, Loader } from 'lucide-react';

const PaymentRequestMessage = ({ message, darkMode, onPayment }) => {
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const { orderId, paymentDetails } = message;
  const { itemBudget, deliveryFee, totalAmount, platformFee } = paymentDetails || {};

  const handlePayment = async (method) => {
    setPaymentMethod(method);
    setIsProcessing(true);

    try {
      await onPayment(orderId, method);
    } catch (error) {
      console.error('Payment failed:', error);
      setIsProcessing(false);
    }
  };

  return (
    <div className={`flex justify-center my-4 px-4`}>
      <div className={`max-w-md w-full rounded-2xl shadow-lg ${
        darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      } border p-6`}>
        
        {/* Header */}
        <div className="text-center mb-4">
          <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-3 ${
            darkMode ? 'bg-blue-900' : 'bg-blue-100'
          }`}>
            <Wallet className={`w-8 h-8 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`} />
          </div>
          <h3 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            Payment Required
          </h3>
          <p className={`text-sm mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            Complete payment to start your order
          </p>
        </div>

        {/* Payment Breakdown */}
        <div className={`rounded-xl p-4 mb-4 ${
          darkMode ? 'bg-gray-700/50' : 'bg-gray-50'
        }`}>
          <h4 className={`text-sm font-semibold mb-3 ${
            darkMode ? 'text-gray-300' : 'text-gray-700'
          }`}>
            Payment Breakdown
          </h4>
          
          <div className="space-y-2">
            {itemBudget > 0 && (
              <div className="flex justify-between">
                <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Item Budget
                </span>
                <span className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  ₦{itemBudget?.toLocaleString()}
                </span>
              </div>
            )}
            
            <div className="flex justify-between">
              <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Delivery Fee
              </span>
              <span className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                ₦{deliveryFee?.toLocaleString()}
              </span>
            </div>

            <div className={`pt-2 mt-2 border-t ${
              darkMode ? 'border-gray-600' : 'border-gray-200'
            }`}>
              <div className="flex justify-between">
                <span className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  Total Amount
                </span>
                <span className={`text-lg font-bold ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                  ₦{totalAmount?.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Buttons */}
        {!isProcessing ? (
          <div className="space-y-3">
            <button
              onClick={() => handlePayment('wallet')}
              className={`w-full flex items-center justify-center gap-3 px-6 py-3 rounded-xl font-semibold transition-all ${
                darkMode
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              <Wallet className="w-5 h-5" />
              Pay via Wallet
            </button>

            <button
              onClick={() => handlePayment('card')}
              className={`w-full flex items-center justify-center gap-3 px-6 py-3 rounded-xl font-semibold transition-all ${
                darkMode
                  ? 'bg-gray-700 hover:bg-gray-600 text-white border border-gray-600'
                  : 'bg-white hover:bg-gray-50 text-gray-900 border-2 border-gray-300'
              }`}
            >
              <CreditCard className="w-5 h-5" />
              Pay with Card
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6">
            <Loader className={`w-8 h-8 animate-spin mb-3 ${
              darkMode ? 'text-blue-400' : 'text-blue-600'
            }`} />
            <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Processing payment via {paymentMethod === 'wallet' ? 'Wallet' : 'Card'}...
            </p>
          </div>
        )}

        {/* Info */}
        <p className={`text-xs text-center mt-4 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
          Your payment is secure and protected
        </p>
      </div>
    </div>
  );
};

export default PaymentRequestMessage;