import React, { useState, useRef } from 'react';
import { X, AlertTriangle, Upload, Camera } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { raiseDispute } from '../../Redux/disputeSlice';

const DISPUTE_REASONS = [
  { value: 'item_mismatch', label: 'Wrong items delivered' },
  { value: 'item_damage', label: 'Items damaged' },
  { value: 'delivery_delay', label: 'Significant delivery delay' },
  { value: 'non_delivery', label: 'Items not delivered' },
  { value: 'pricing_dispute', label: 'Price disagreement' },
  { value: 'quality_issue', label: 'Item quality issue' },
  { value: 'runner_behavior', label: 'Unprofessional behavior' },
  { value: 'payment_issue', label: 'Payment related issue' },
  { value: 'other', label: 'Other' },
];

export default function DisputeForm({
  isOpen,
  onClose,
  darkMode,
  orderId,
  chatId,
  userId,
  runnerId,
  raisedBy,
  raisedById,
  socket
}) {
  const dispatch = useDispatch();
  const { loading } = useSelector((state) => state.dispute);

  const [step, setStep] = useState('form'); // form | confirm | success
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [evidenceFiles, setEvidenceFiles] = useState([]);
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setEvidenceFiles(prev => [...prev, {
          base64: e.target.result,
          type: file.type.startsWith('image') ? 'image' : 'document',
          preview: e.target.result,
          name: file.name
        }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeFile = (index) => {
    setEvidenceFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!reason) { alert('Please select a reason'); return; }
    if (!description.trim()) { alert('Please describe the issue'); return; }
    if (description.trim().length < 20) { alert('Please provide more detail (at least 20 characters)'); return; }

    try {
      await dispatch(raiseDispute({
        orderId,
        chatId,
        raisedBy,
        raisedById,
        userId,
        runnerId,
        reason,
        description,
        evidenceFiles
      })).unwrap();

      // Also emit via socket for real-time
      if (socket) {
        socket.emit('raiseDispute', {
          orderId,
          chatId,
          raisedBy,
          raisedById,
          userId,
          runnerId,
          reason,
          description,
          evidenceFiles
        });
      }

      setStep('success');
    } catch (error) {
      alert(error || 'Failed to raise dispute. Please try again.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
      <div className={`w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl ${
        darkMode ? 'bg-black-100' : 'bg-white'
      }`}>

        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className={`w-10 h-1 rounded-full ${darkMode ? 'bg-black-200' : 'bg-gray-1001'}`} />
        </div>

        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${
          darkMode ? 'border-black-200' : 'border-gray-1001'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <h2 className={`font-bold ${darkMode ? 'text-white' : 'text-black-200'}`}>
                Raise Dispute
              </h2>
              <p className={`text-xs ${darkMode ? 'text-gray-1002' : 'text-gray-600'}`}>
                Order #{orderId}
              </p>
            </div>
          </div>
          <button onClick={onClose}>
            <X className={`w-5 h-5 ${darkMode ? 'text-gray-1002' : 'text-gray-600'}`} />
          </button>
        </div>

        <div className="px-6 py-4">

          {/* SUCCESS */}
          {step === 'success' && (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-primary" />
              </div>
              <h3 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-black-200'}`}>
                Dispute Raised!
              </h3>
              <p className={`text-sm text-center ${darkMode ? 'text-gray-1002' : 'text-gray-600'}`}>
                Your dispute has been submitted. Our team will review it and notify both parties of the resolution.
                Escrow funds are locked until resolved.
              </p>
              <button
                onClick={onClose}
                className="w-full py-3 rounded-xl bg-primary text-white font-semibold"
              >
                Got it
              </button>
            </div>
          )}

          {/* FORM */}
          {step === 'form' && (
            <div className="space-y-4">

              {/* Warning */}
              <div className={`p-3 rounded-xl border border-red-500/20 bg-red-500/5`}>
                <p className={`text-xs ${darkMode ? 'text-gray-1002' : 'text-gray-600'}`}>
                  ⚠️ Raising a dispute will pause all escrow releases until resolved by admin. This action cannot be undone.
                </p>
              </div>

              {/* Reason */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  darkMode ? 'text-gray-1002' : 'text-black-200'
                }`}>
                  Reason
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {DISPUTE_REASONS.map((r) => (
                    <button
                      key={r.value}
                      onClick={() => setReason(r.value)}
                      className={`text-left px-4 py-3 rounded-xl text-sm transition-colors ${
                        reason === r.value
                          ? 'bg-primary text-white'
                          : darkMode
                            ? 'bg-black-200 text-gray-1002 hover:bg-primary/10'
                            : 'bg-gray-1001 text-black-200 hover:bg-primary/10'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  darkMode ? 'text-gray-1002' : 'text-black-200'
                }`}>
                  Describe the issue
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Provide details about what went wrong..."
                  rows={4}
                  className={`w-full p-3 rounded-xl border outline-none resize-none text-sm ${
                    darkMode
                      ? 'bg-black-200 border-black-200 text-white placeholder-gray-1002'
                      : 'bg-gray-1001 border-gray-1001 text-black-200 placeholder-gray-600'
                  }`}
                />
                <p className={`text-xs mt-1 ${darkMode ? 'text-gray-1002' : 'text-gray-600'}`}>
                  {description.length}/1000
                </p>
              </div>

              {/* Evidence */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  darkMode ? 'text-gray-1002' : 'text-black-200'
                }`}>
                  Evidence (optional)
                </label>

                {/* Preview uploaded files */}
                {evidenceFiles.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    {evidenceFiles.map((file, i) => (
                      <div key={i} className="relative">
                        <img
                          src={file.preview}
                          alt={file.name}
                          className="w-full h-24 object-cover rounded-lg"
                        />
                        <button
                          onClick={() => removeFile(i)}
                          className="absolute top-1 right-1 p-1 bg-red-500 rounded-full"
                        >
                          <X className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className={`w-full h-20 border-2 border-dashed rounded-xl flex items-center justify-center gap-2 transition-colors ${
                    darkMode
                      ? 'border-black-200 hover:border-primary text-gray-1002 hover:text-primary'
                      : 'border-gray-1001 hover:border-primary text-gray-600 hover:text-primary'
                  }`}
                >
                  <Upload className="w-5 h-5" />
                  <span className="text-sm">Upload Photos/Documents</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>

              {/* Submit */}
              <div className="flex gap-3 pb-4">
                <button
                  onClick={onClose}
                  className={`flex-1 py-3 rounded-xl font-semibold ${
                    darkMode
                      ? 'bg-black-200 text-white'
                      : 'bg-gray-1001 text-black-200'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading || !reason || !description.trim()}
                  className={`flex-1 py-3 rounded-xl font-semibold bg-red-500 text-white ${
                    loading || !reason || !description.trim()
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:opacity-90'
                  }`}
                >
                  {loading ? 'Submitting...' : 'Raise Dispute'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}