import React, { useState, useRef } from 'react';
import { X, AlertTriangle, Upload } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { raiseDispute } from '../../Redux/disputeSlice';
import { getAvailableReasons } from '../../utils/disputeReasons';

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
  serviceType,  // order.serviceType — determines reason set
  orderStatus,  // order.status — determines which reasons are still open
  socket,
}) {
  const dispatch = useDispatch();
  const loading = useSelector((s) => s.dispute.loading);

  const [step, setStep] = useState('form'); // form | success
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [evidenceFiles, setEvidenceFiles] = useState([]);
  const fileInputRef = useRef(null);

  // Only show reasons admin can still act on at this stage of the order
  const availableReasons = getAvailableReasons(serviceType, orderStatus);
  const selectedReason   = availableReasons.find((r) => r.value === reason);

  const handleFileSelect = (e) => {
    Array.from(e.target.files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setEvidenceFiles((prev) => [
          ...prev,
          {
            base64:  ev.target.result,
            type:    file.type.startsWith('image') ? 'image' : 'document',
            preview: ev.target.result,
            name:    file.name,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeFile = (index) =>
    setEvidenceFiles((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = async () => {
    if (!reason) { alert('Please select a reason'); return; }
    if (!description.trim()) { alert('Please describe the issue'); return; }
    if (description.trim().length < 20) { alert('Please provide more detail (at least 20 characters)'); return; }

    try {
      await dispatch(
        raiseDispute({
          orderId, chatId, raisedBy, raisedById,
          userId, runnerId, reason, description, evidenceFiles,
        })
      ).unwrap();

      socket?.emit('raiseDispute', {
        orderId, chatId, raisedBy, raisedById,
        userId, runnerId, reason, description, evidenceFiles,
      });

      setStep('success');
    } catch (error) {
      alert(error || 'Failed to raise dispute. Please try again.');
    }
  };

  if (!isOpen) return null;

  // ── Theme shortcuts ──────────────────────────────────────────────────────
  const cardBg      = darkMode ? 'bg-black-200'     : 'bg-gray-1001';
  const border      = darkMode ? 'border-black-200'  : 'border-gray-1001';
  const textPrimary = darkMode ? 'text-white'        : 'text-black-200';
  const textMuted   = darkMode ? 'text-gray-1002'    : 'text-gray-600';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
      <div
        className={`w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl ${
          darkMode ? 'bg-black-100' : 'bg-white'
        }`}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className={`w-10 h-1 rounded-full ${darkMode ? 'bg-black-200' : 'bg-gray-1001'}`} />
        </div>

        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${border}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-500" />
            </div>
            <h2 className={`font-bold ${textPrimary}`}>Raise Dispute</h2>
          </div>
          <button onClick={onClose}>
            <X className={`w-5 h-5 ${textMuted}`} />
          </button>
        </div>

        <div className="px-6 py-4">

          {/* ── SUCCESS ──────────────────────────────────────────────────── */}
          {step === 'success' && (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-primary" />
              </div>
              <h3 className={`text-lg font-bold ${textPrimary}`}>Dispute Raised</h3>
              <p className={`text-sm text-center ${textMuted}`}>
                Your dispute has been submitted. Our team will review it and reach out to both
                parties. Escrow funds are locked until the matter is resolved.
              </p>
              <button
                onClick={onClose}
                className="w-full py-3 rounded-xl bg-primary text-white font-semibold"
              >
                Got it
              </button>
            </div>
          )}

          {/* ── FORM ─────────────────────────────────────────────────────── */}
          {step === 'form' && (
            <div className="space-y-5">

              {/* Window closed — no actionable reasons left */}
              {availableReasons.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                  <AlertTriangle className="w-8 h-8 text-gray-400" />
                  <p className={`text-sm text-center ${textMuted}`}>
                    The dispute window for this order has closed. No further action can be taken
                    at this stage.
                  </p>
                  <button
                    onClick={onClose}
                    className={`mt-2 px-6 py-2 rounded-xl font-semibold ${cardBg} ${textPrimary}`}
                  >
                    Close
                  </button>
                </div>
              ) : (
                <>
                  {/* Warning banner */}
                  <div className="p-3 rounded-xl border border-red-500/20 bg-red-500/5">
                    <p className={`text-xs ${textMuted}`}>
                      ⚠️ Raising a dispute will pause all escrow releases until resolved by admin.
                      This action cannot be undone.
                    </p>
                  </div>

                  {/* Reason list */}
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${textMuted}`}>
                      What's the issue?
                    </label>
                    <div className="space-y-2">
                      {availableReasons.map((r) => {
                        const selected = reason === r.value;
                        return (
                          <button
                            key={r.value}
                            onClick={() => setReason(r.value)}
                            className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-colors ${
                              selected
                                ? 'bg-primary text-white'
                                : darkMode
                                  ? 'bg-black-200 text-white hover:bg-primary/10'
                                  : 'bg-gray-1001 text-black-200 hover:bg-primary/10'
                            }`}
                          >
                            <p className="font-semibold">{r.label}</p>
                            <p className={`text-xs mt-0.5 ${selected ? 'text-white/70' : textMuted}`}>
                              {r.description}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${textMuted}`}>
                      Tell us what happened
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value.slice(0, 1000))}
                      placeholder={
                        selectedReason
                          ? `Describe the "${selectedReason.label}" issue in detail…`
                          : 'Select a reason above, then describe what happened…'
                      }
                      rows={4}
                      className={`w-full p-3 rounded-xl border outline-none resize-none text-sm ${
                        darkMode
                          ? 'bg-black-200 border-black-200 text-white placeholder-gray-1002'
                          : 'bg-gray-1001 border-gray-1001 text-black-200 placeholder-gray-600'
                      }`}
                    />
                    <p className={`text-xs mt-1 ${textMuted}`}>{description.length}/1000</p>
                  </div>

                  {/* Evidence */}
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${textMuted}`}>
                      Evidence{' '}
                      <span className={`font-normal ${textMuted}`}>(optional — photos or documents)</span>
                    </label>

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
                          : 'border-gray-300 hover:border-primary text-gray-600 hover:text-primary'
                      }`}
                    >
                      <Upload className="w-5 h-5" />
                      <span className="text-sm">Upload Photos / Documents</span>
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

                  {/* Actions */}
                  <div className="flex gap-3 pb-4">
                    <button
                      onClick={onClose}
                      className={`flex-1 py-3 rounded-xl font-semibold ${cardBg} ${textPrimary}`}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={loading || !reason || description.trim().length < 20}
                      className={`flex-1 py-3 rounded-xl font-semibold bg-red-500 text-white transition-opacity ${
                        loading || !reason || description.trim().length < 20
                          ? 'opacity-50 cursor-not-allowed'
                          : 'hover:opacity-90'
                      }`}
                    >
                      {loading ? 'Submitting…' : 'Raise Dispute'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}