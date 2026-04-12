
import React, { useState } from 'react';
import { Check, X, Package, AlertCircle } from 'lucide-react';

const PickupItemSubmissionMessage = ({ message, darkMode, onApprove, onReject }) => {
  const { submissionId, itemName, photoUrl, status, rejectionReason } = message;

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleApprove = async () => {
    if (submitted || isProcessing) return;
    setSubmitted(true);
    setIsProcessing(true);
    try {
      await onApprove(submissionId);
    } catch (error) {
      console.error('Error approving pickup item:', error);
      setSubmitted(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (submitted || isProcessing) return;
    if (!rejectReason.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }

    setSubmitted(true);
    setIsProcessing(true);
    try {
      await onReject(submissionId, rejectReason);
      setShowRejectModal(false);
      setRejectReason('');
    } catch (error) {
      console.error('Error rejecting pickup item:', error);
      setSubmitted(false);
    } finally {
      setIsProcessing(false);
    }
  };

  if (status === 'approved') {
    return (
      <div className="flex justify-center my-4 px-4">
        <div className={`max-w-md w-full rounded-2xl shadow-lg border ${darkMode ? 'bg-green-900/20 border-green-800' : 'bg-green-50 border-green-200'} p-6`}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
              <Check className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <h3 className={`font-bold ${darkMode ? 'text-green-400' : 'text-green-700'}`}>
                Pickup Item Approved
              </h3>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Runner can now mark as collected
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'rejected') {
    return (
      <div className="flex justify-center my-4 px-4">
        <div className={`max-w-md w-full rounded-2xl shadow-lg border ${darkMode ? 'bg-red-900/20 border-red-800' : 'bg-red-50 border-red-200'} p-6`}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
              <X className="w-6 h-6 text-red-500" />
            </div>
            <div>
              <h3 className={`font-bold ${darkMode ? 'text-red-400' : 'text-red-700'}`}>
                Pickup Item Rejected
              </h3>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Runner can resubmit
              </p>
            </div>
          </div>
          {rejectionReason && (
            <div className={`mt-3 p-3 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                <span className="font-medium">Reason:</span> {rejectionReason}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex justify-center my-4 px-4">
        <div className={`max-w-md w-full rounded-2xl shadow-lg ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border p-6`}>
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${darkMode ? 'bg-blue-900/20' : 'bg-blue-100'}`}>
              <Package className={`w-6 h-6 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`} />
            </div>
            <div>
              <h3 className={`font-bold ${darkMode ? 'text-white' : 'text-black-100'}`}>
                Pickup Item
              </h3>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-black-100'}`}>
                Review and approve
              </p>
            </div>
          </div>

          {photoUrl && (
            <div className="mb-4">
              <img
                src={photoUrl}
                alt={itemName}
                className="w-full rounded-lg cursor-pointer hover:opacity-90"
                onClick={() => window.open(photoUrl, '_blank')}
              />
            </div>
          )}

          <div className={`p-3 rounded-lg mb-4 ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
            <p className={`font-medium ${darkMode ? 'text-white' : 'text-black-100'}`}>
              {itemName}
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setShowRejectModal(true)}
              disabled={isProcessing || submitted}
              className={`flex-1 py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 bg-secondary text-white ${(isProcessing || submitted) ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80'}`}
            >
              <X className="w-5 h-5" />
              Reject
            </button>
            <button
              onClick={handleApprove}
              disabled={isProcessing || submitted}
              className={`flex-1 py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 bg-primary text-white ${(isProcessing || submitted) ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80'}`}
            >
              <Check className="w-5 h-5" />
              {isProcessing ? 'Processing...' : 'Approve'}
            </button>
          </div>
        </div>
      </div>

      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className={`w-full max-w-md rounded-2xl shadow-2xl p-6 ${darkMode ? 'bg-black-100 border border-gray-800' : 'bg-white'}`}>
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="w-6 h-6 text-red-500" />
              <h3 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                Reject Pickup Item
              </h3>
            </div>

            <p className={`text-sm mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Please provide a reason for rejecting this item.
            </p>

            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g., Wrong item, damaged, not as described..."
              className={`w-full p-3 rounded-lg border outline-none resize-none ${darkMode ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-400' : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400'}`}
              rows={4}
            />

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                }}
                className={`flex-1 py-2 rounded-lg font-medium ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'}`}
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectReason.trim() || isProcessing || submitted}
                className={`flex-1 py-2 rounded-lg font-medium bg-secondary text-white ${(!rejectReason.trim() || isProcessing || submitted) ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80'}`}
              >
                {isProcessing ? 'Rejecting...' : 'Reject Item'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PickupItemSubmissionMessage;