import React, { useState } from "react";
import { X, Lock } from "lucide-react";
import { PaystackButton } from "react-paystack";

export default function PaystackPaymentModal({
  reference,
  amount,
  orderId,
  email,
  darkMode,
  onSuccess,
  onCancel,
}) {
  const [isProcessing, setIsProcessing] = useState(false);

  const config = {
    reference,
    email,
    amount: amount * 100, // Paystack uses kobo
    publicKey: process.env.REACT_APP_PAYSTACK_PUBLIC_KEY,
    metadata: {
      orderId,
      custom_fields: [
        { display_name: "Order ID", variable_name: "order_id", value: orderId }
      ]
    },
  };

  const handleSuccess = (reference) => {
    setIsProcessing(false);
    onSuccess(reference);
  };

  const handleClose = () => {
    setIsProcessing(false);
    onCancel();
  };

  if (!reference) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="bg-white dark:bg-black-100 rounded-2xl shadow-xl w-full max-w-md p-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Card Payment
            </h2>
            {orderId && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Order #{orderId}
              </p>
            )}
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          >
            <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Amount */}
        <div className="text-center pb-4 mb-4 border-b dark:border-gray-700 border-gray-200">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Amount to Pay</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            ₦{Number(amount).toLocaleString()}
          </p>
        </div>

        {/* Info */}
        <div className="space-y-3 mb-6">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Email</span>
            <span className="text-gray-900 dark:text-white font-medium">{email}</span>
          </div>
          {orderId && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Order ID</span>
              <span className="text-gray-900 dark:text-white font-medium">#{orderId}</span>
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            className="flex-1 py-3 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition disabled:opacity-50"
          >
            Cancel
          </button>

          <PaystackButton
            {...config}
            text={`Pay ₦${Number(amount).toLocaleString()}`}
            onSuccess={handleSuccess}
            onClose={handleClose}
            className="flex-1 py-3 rounded-lg bg-primary text-white text-sm font-medium transition flex items-center justify-center gap-2 disabled:opacity-60 hover:opacity-90"
            disabled={isProcessing}
          />
        </div>

        <p className="text-xs text-center text-gray-400 mt-4 flex items-center justify-center gap-1">
          <Lock className="w-3 h-3" /> Secured by Paystack
        </p>
      </div>
    </div>
  );
}