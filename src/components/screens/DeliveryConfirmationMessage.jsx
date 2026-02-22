import React, { useState } from 'react';
import { Package, CheckCircle, Clock } from 'lucide-react';

const DeliveryConfirmationMessage = ({ message, darkMode, onConfirm }) => {
  const [isConfirming, setIsConfirming] = useState(false);
  const { orderId, deliveryProof, confirmationStatus } = message;

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      await onConfirm(orderId);
    } catch (error) {
      console.error('Error confirming delivery:', error);
    } finally {
      setIsConfirming(false);
    }
  };

  // Already confirmed
  if (confirmationStatus === 'confirmed') {
    return (
      <div className="flex justify-center my-4 px-4">
        <div className={`max-w-md w-full rounded-2xl shadow-lg border ${
          darkMode ? 'bg-black-100 border-black-200' : 'bg-white border-gray-1001'
        } p-6`}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className={`font-bold ${darkMode ? 'text-white' : 'text-black-200'}`}>
                Delivery Confirmed
              </h3>
              <p className={`text-sm ${darkMode ? 'text-gray-1002' : 'text-gray-600'}`}>
                Order completed successfully
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-center my-4 px-4">
      <div className={`max-w-md w-full rounded-2xl shadow-lg border ${
        darkMode ? 'bg-black-100 border-black-200' : 'bg-white border-gray-1001'
      } p-6`}>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
            <Package className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className={`font-bold ${darkMode ? 'text-white' : 'text-black-200'}`}>
              Confirm Delivery
            </h3>
            <p className={`text-sm ${darkMode ? 'text-gray-1002' : 'text-gray-600'}`}>
              Runner has marked your order as delivered
            </p>
          </div>
        </div>

        {/* Delivery Proof */}
        {deliveryProof && (
          <div className="mb-4">
            <p className={`text-sm font-medium mb-2 ${
              darkMode ? 'text-gray-1002' : 'text-gray-600'
            }`}>
              Delivery Photo
            </p>
            <img
              src={deliveryProof}
              alt="Delivery proof"
              className="w-full rounded-xl object-cover max-h-48 cursor-pointer hover:opacity-90"
              onClick={() => window.open(deliveryProof, '_blank')}
            />
          </div>
        )}

        {/* Auto confirm notice */}
        <div className={`flex items-center gap-2 p-3 rounded-xl mb-4 ${
          darkMode ? 'bg-black-200' : 'bg-gray-1001'
        }`}>
          <Clock className={`w-4 h-4 flex-shrink-0 ${
            darkMode ? 'text-gray-1002' : 'text-gray-600'
          }`} />
          <p className={`text-xs ${darkMode ? 'text-gray-1002' : 'text-gray-600'}`}>
            Order will be auto-confirmed in 24 hours if no action is taken
          </p>
        </div>

        {/* Confirm Button */}
        <button
          onClick={handleConfirm}
          disabled={isConfirming}
          className={`w-full py-3 rounded-xl font-semibold transition-all bg-primary text-white hover:opacity-90 ${
            isConfirming ? 'opacity-50 cursor-not-allowed bg-gray-400' : ''
          }`}
        >
          {isConfirming ? 'Confirming...' : 'Confirm Delivery'}
        </button>
      </div>
    </div>
  );
};

export default DeliveryConfirmationMessage;