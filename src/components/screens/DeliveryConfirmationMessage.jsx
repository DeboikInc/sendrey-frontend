import React, { useState } from 'react';
import { Package, CheckCircle, XCircle, Clock } from 'lucide-react';

const DeliveryConfirmationMessage = ({ message, darkMode, onConfirm, onDeny }) => {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDenying, setIsDenying] = useState(false);
  const { orderId, deliveryProof, confirmationStatus, runnerName } = message;

  const displayName = runnerName || 'Runner';

  const handleConfirm = async () => {
    console.log("confirming order")
    setIsConfirming(true);
    try {
      await onConfirm(orderId);
    } catch (error) {
      console.error('Error confirming delivery:', error);
    } 
  };

  const handleDeny = async () => {
    console.log("denying order")
    setIsDenying(true);
    try {
      await onDeny(orderId);
    } catch (error) {
      console.error('Error denying delivery:', error);
    } 
  };

  // Already confirmed
  if (confirmationStatus === 'confirmed') {
    return (
      <div className="flex justify-center my-4 px-4">
        <div className={`max-w-md w-full rounded-2xl shadow-lg border ${
          darkMode ? 'bg-black-100 border-black-200' : 'bg-white border-gray-100'
        } p-6`}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <h3 className={`font-bold ${darkMode ? 'text-white' : 'text-black-200'}`}>
                Delivery Confirmed
              </h3>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                You confirmed {displayName} delivered your order
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Already denied
  if (confirmationStatus === 'denied') {
    return (
      <div className="flex justify-center my-4 px-4">
        <div className={`max-w-md w-full rounded-2xl shadow-lg border ${
          darkMode ? 'bg-black-100 border-black-200' : 'bg-white border-gray-100'
        } p-6`}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
              <XCircle className="w-6 h-6 text-red-500" />
            </div>
            <div>
              <h3 className={`font-bold ${darkMode ? 'text-white' : 'text-black-200'}`}>
                Delivery Denied
              </h3>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                You reported that this delivery was not completed
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
        darkMode ? 'bg-black-100 border-black-200' : 'bg-white border-gray-100'
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
            <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              {displayName} has marked your order as delivered
            </p>
          </div>
        </div>

        {/* Delivery Proof */}
        {deliveryProof && (
          <div className="mb-4">
            <p className={`text-sm font-medium mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
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
          darkMode ? 'bg-black-200' : 'bg-gray-50'
        }`}>
          <Clock className={`w-4 h-4 flex-shrink-0 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
          <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Order will be auto-confirmed in 24 hours if no action is taken
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleDeny}
            disabled={isDenying || isConfirming}
            className={`flex-1 py-3 rounded-xl font-semibold transition-all border border-red-500 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 ${
              isDenying || isConfirming ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {isDenying ? 'Denying...' : 'Deny'}
          </button>

          <button
            onClick={handleConfirm}
            disabled={isConfirming || isDenying}
            className={`flex-1 py-3 rounded-xl font-semibold transition-all bg-primary text-white hover:opacity-90 ${
              isConfirming || isDenying ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {isConfirming ? 'Confirming...' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeliveryConfirmationMessage;