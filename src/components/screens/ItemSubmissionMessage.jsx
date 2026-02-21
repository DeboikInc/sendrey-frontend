import React, { useState } from 'react';
import { Check, X, ShoppingBag, Receipt, AlertCircle } from 'lucide-react';

const ItemSubmissionMessage = ({ message, darkMode, onApprove, onReject }) => {
  const { submissionId, items, receiptUrl, totalAmount, status, rejectionReason, escrowId } = message;
  
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleApprove = async () => {
    setIsProcessing(true);
    try {
      await onApprove(submissionId, escrowId);
    } catch (error) {
      console.error('Error approving items:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }

    setIsProcessing(true);
    try {
      await onReject(submissionId, rejectReason);
      setShowRejectModal(false);
      setRejectReason('');
    } catch (error) {
      console.error('Error rejecting items:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // If already approved
  if (status === 'approved') {
    return (
      <div className="flex justify-center my-4 px-4">
        <div className={`max-w-md w-full rounded-2xl shadow-lg border ${
          darkMode ? 'bg-green-900/20 border-green-800' : 'bg-green-50 border-green-200'
        } p-6`}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
              <Check className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <h3 className={`font-bold ${darkMode ? 'text-green-400' : 'text-green-700'}`}>
                Items Approved
              </h3>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Runner can now proceed with delivery
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If rejected
  if (status === 'rejected') {
    return (
      <div className="flex justify-center my-4 px-4">
        <div className={`max-w-md w-full rounded-2xl shadow-lg border ${
          darkMode ? 'bg-red-900/20 border-red-800' : 'bg-red-50 border-red-200'
        } p-6`}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
              <X className="w-6 h-6 text-red-500" />
            </div>
            <div>
              <h3 className={`font-bold ${darkMode ? 'text-red-400' : 'text-red-700'}`}>
                Items Rejected
              </h3>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Runner can resubmit items
              </p>
            </div>
          </div>
          {rejectionReason && (
            <div className={`mt-3 p-3 rounded-lg ${
              darkMode ? 'bg-gray-800' : 'bg-white'
            }`}>
              <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                <span className="font-medium">Reason:</span> {rejectionReason}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Pending approval
  return (
    <>
      <div className="flex justify-center my-4 px-4">
        <div className={`max-w-md w-full rounded-2xl shadow-lg ${
          darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        } border p-6`}>
          
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              darkMode ? 'bg-blue-900/20' : 'bg-blue-100'
            }`}>
              <ShoppingBag className={`w-6 h-6 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`} />
            </div>
            <div>
              <h3 className={`font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                Items Purchased
              </h3>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Review and approve items
              </p>
            </div>
          </div>

          {/* Items List */}
          <div className="space-y-3 mb-4">
            {items.map((item, index) => (
              <div key={index} className={`flex gap-3 p-3 rounded-lg ${
                darkMode ? 'bg-gray-700/50' : 'bg-gray-50'
              }`}>
                {item.photoUrl && (
                  <img
                    src={item.photoUrl}
                    alt={item.name}
                    className="w-16 h-16 rounded-lg object-cover"
                  />
                )}
                <div className="flex-1">
                  <p className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    {item.name}
                  </p>
                  <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Qty: {item.quantity} × ₦{item.price.toLocaleString()}
                  </p>
                  <p className={`text-sm font-semibold ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                    ₦{(item.quantity * item.price).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Receipt */}
          {receiptUrl && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Receipt className={`w-4 h-4 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`} />
                <span className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Receipt
                </span>
              </div>
              <img
                src={receiptUrl}
                alt="Receipt"
                className="w-full rounded-lg cursor-pointer hover:opacity-90"
                onClick={() => window.open(receiptUrl, '_blank')}
              />
            </div>
          )}

          {/* Total */}
          <div className={`flex justify-between items-center p-3 rounded-lg mb-4 ${
            darkMode ? 'bg-gray-700' : 'bg-gray-100'
          }`}>
            <span className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              Total Amount
            </span>
            <span className={`text-lg font-bold ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
              ₦{totalAmount?.toLocaleString()}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => setShowRejectModal(true)}
              disabled={isProcessing}
              className={`flex-1 py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                darkMode
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-red-600 hover:bg-red-700 text-white'
              } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <X className="w-5 h-5" />
              Reject
            </button>
            <button
              onClick={handleApprove}
              disabled={isProcessing}
              className={`flex-1 py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                darkMode
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Check className="w-5 h-5" />
              {isProcessing ? 'Processing...' : 'Approve'}
            </button>
          </div>
        </div>
      </div>

      {/* Rejection Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className={`w-full max-w-md rounded-2xl shadow-2xl p-6 ${
            darkMode ? 'bg-gray-900 border border-gray-800' : 'bg-white'
          }`}>
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="w-6 h-6 text-red-500" />
              <h3 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                Reject Items
              </h3>
            </div>

            <p className={`text-sm mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Please provide a reason for rejecting these items. The runner will be able to resubmit.
            </p>

            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g., Wrong brand, missing items, incorrect prices..."
              className={`w-full p-3 rounded-lg border outline-none resize-none ${
                darkMode
                  ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500'
                  : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400'
              }`}
              rows={4}
            />

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                }}
                className={`flex-1 py-2 rounded-lg font-medium ${
                  darkMode
                    ? 'bg-gray-700 hover:bg-gray-600 text-white'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectReason.trim() || isProcessing}
                className={`flex-1 py-2 rounded-lg font-medium ${
                  darkMode
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                } ${(!rejectReason.trim() || isProcessing) ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isProcessing ? 'Rejecting...' : 'Reject Items'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ItemSubmissionMessage;