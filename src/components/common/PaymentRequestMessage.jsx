import React, { useState } from 'react';
import { Wallet, CreditCard, Loader, CheckCircle } from 'lucide-react';

const PaymentRequestMessage = ({
  paymentData,
  alreadyPaid,
  onPayWithWallet,
  onPayWithCard,
  message,
  onPayment,
  darkMode,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState(null);

  const data = paymentData || message?.paymentData || {};
  const { itemBudget = 0, deliveryFee = 0, totalAmount = 0, serviceType = '' } = data;
  const isRunErrand = serviceType === 'run-errand' || serviceType === 'run_errand';
  const isPaid = alreadyPaid || message?.status === 'paid';
  const fmt = (n) => Number(n || 0).toLocaleString();

  const handlePayment = async (method) => {
    if (isPaid || isProcessing) return;
    setPaymentMethod(method);
    setIsProcessing(true);
    try {
      if (method === 'wallet') {
        if (onPayWithWallet) await onPayWithWallet();
        else if (onPayment) await onPayment(data, 'wallet');
      } else {
        if (onPayWithCard) await onPayWithCard();
        else if (onPayment) await onPayment(data, 'card');
      }
    } catch (error) {
      console.error('Payment failed:', error);
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex justify-center my-4 px-4">
      <div className={`max-w-md w-full rounded-2xl shadow-lg border p-6 ${
        darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}>

        {/* Header */}
        <div className="text-center mb-4">
          <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-3 ${
            isPaid
              ? darkMode ? 'bg-green-900' : 'bg-green-100'
              : darkMode ? 'bg-primary' : 'bg-primary/20'
          }`}>
            {isPaid
              ? <CheckCircle className={`w-8 h-8 ${darkMode ? 'text-green-400' : 'text-green-600'}`} />
              : <Wallet className="w-8 h-8 text-secondary" />
            }
          </div>
          <h3 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            {isPaid ? 'Payment Complete' : 'Payment Required'}
          </h3>
          <p className={`text-sm mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            {isPaid ? 'Your task is funded and active' : 'Complete payment to start your order'}
          </p>
        </div>

        {/* Breakdown */}
        <div className={`rounded-xl p-4 mb-4 ${darkMode ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
          <h4 className={`text-sm font-semibold mb-3 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            Payment Breakdown
          </h4>

          <div className="space-y-2">
            {/* Item budget — run-errand only */}
            {isRunErrand && (
              <div className="flex justify-between">
                <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Item Budget</span>
                <span className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  ₦{fmt(itemBudget)}
                </span>
              </div>
            )}

            {/* Delivery fee — always shown */}
            <div className="flex justify-between">
              <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Delivery Fee{isRunErrand ? ' (20%)' : ''}
              </span>
              <span className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                ₦{fmt(deliveryFee)}
              </span>
            </div>

            {/* Total */}
            <div className={`pt-2 mt-2 border-t ${darkMode ? 'border-gray-600' : 'border-gray-200'}`}>
              <div className="flex justify-between">
                <span className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Total</span>
                <span className={`text-lg font-bold ${
                  isPaid
                    ? darkMode ? 'text-green-400' : 'text-green-600'
                    : 'text-secondary'
                }`}>
                  ₦{fmt(totalAmount)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Action */}
        {isPaid ? (
          <div className={`flex items-center justify-center gap-2 py-3 rounded-xl ${
            darkMode ? 'bg-green-900/30 text-green-400' : 'bg-green-50 text-green-700'
          }`}>
            <CheckCircle className="w-5 h-5" />
            <span className="font-semibold text-sm">Paid</span>
          </div>
        ) : isProcessing ? (
          <div className="flex flex-col items-center justify-center py-6">
            <Loader className="w-8 h-8 animate-spin mb-3 text-secondary" />
            <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Processing via {paymentMethod === 'wallet' ? 'Wallet' : 'Card'}...
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <button
              onClick={() => handlePayment('wallet')}
              className="w-full flex items-center justify-center gap-3 px-6 py-3 rounded-xl font-semibold bg-secondary hover:bg-secondary/80 text-white transition-all"
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
        )}

        <p className={`text-xs text-center mt-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          Your payment is secure and protected
        </p>
      </div>
    </div>
  );
};

export default PaymentRequestMessage;