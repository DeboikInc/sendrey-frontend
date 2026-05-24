import React, { useState, useRef } from 'react';
import { X, AlertTriangle, Upload } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { raiseDispute } from '../../Redux/disputeSlice';
import { getAvailableReasons } from '../../utils/disputeReasons';
import useUserOrderStore from '../../store/userOrderStore';
import api from '../../utils/api';

export default function DisputeForm({
  isOpen,
  onClose,
  darkMode,
  chatId,
  userId,
  runnerId,
  raisedBy,
  raisedById,
  socket,
  serviceType: serviceTypeProp,
  orderStatus: orderStatusProp,
}) {
  const dispatch = useDispatch();
  const loading = useSelector((s) => s.dispute.loading);

  const currentOrder = useUserOrderStore((s) => s.currentOrder);
  
  const orderId = currentOrder?.orderId;
  const serviceType = currentOrder?.serviceType ?? currentOrder?.taskType ?? serviceTypeProp ?? null;
  const orderStatus = currentOrder?.status ?? orderStatusProp ?? null;

  const [step, setStep] = useState('form');
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [evidenceFiles, setEvidenceFiles] = useState([]);
  const [formError, setFormError] = useState('');
  const errorTimerRef = useRef(null);
  const fileInputRef = useRef(null);

  const availableReasons = getAvailableReasons(serviceType, orderStatus);
  const selectedReason = availableReasons.find((r) => r.value === reason);

  const showError = (msg) => {
    setFormError(msg);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => setFormError(''), 2000);
  };

  const handleFileSelect = (e) => {
    Array.from(e.target.files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setEvidenceFiles((prev) => [
          ...prev,
          {
            base64: ev.target.result,
            type: file.type.startsWith('image') ? 'image' : 'document',
            preview: ev.target.result,
            name: file.name,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeFile = (index) =>
    setEvidenceFiles((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = async () => {
    if (!reason) { showError('Please select a reason for the dispute.'); return; }
    if (!description.trim()) { showError('Please describe what happened.'); return; }
    if (description.trim().length < 20) { showError('Please provide more detail (at least 20 characters).'); return; }

    setSubmitting(true);
    setFormError('');

    try {
      let evidenceUrls = [];

      if (evidenceFiles.length > 0) {
        const formData = new FormData();
        for (const file of evidenceFiles) {
          const blob = await fetch(file.base64).then(r => r.blob());
          formData.append('evidence', blob, file.name);
        }
        const uploadRes = await api.post('/uploads/dispute-evidence', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        evidenceUrls = uploadRes.data.urls;
      }

      await dispatch(
        raiseDispute({
          orderId, chatId, raisedBy, raisedById,
          userId, runnerId, reason, description,
          evidenceFiles: evidenceUrls,
        })
      ).unwrap();

      socket?.emit('raiseDispute', {
        orderId, chatId, raisedBy, raisedById,
        userId, runnerId, reason, description,
        evidenceFiles: evidenceUrls,
      });

      setStep('success');
    } catch (error) {
      const msg = typeof error === 'string' ? error : error?.message || 'Failed to raise dispute. Please try again.';
      showError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const cardBg = darkMode ? 'bg-black-200' : 'bg-gray-1001';
  const border = darkMode ? 'border-black-200' : 'border-gray-1001';
  const textPrimary = darkMode ? 'text-white' : 'text-black-200';
  const textMuted = darkMode ? 'text-gray-1002' : 'text-gray-600';

  const isSubmitDisabled = loading || submitting || !!formError || !reason || description.trim().length < 20;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
      <div className={`w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl ${darkMode ? 'bg-black-100' : 'bg-white'}`}>
        <div className="flex justify-center pt-3 pb-1">
          <div className={`w-10 h-1 rounded-full ${darkMode ? 'bg-black-200' : 'bg-gray-1001'}`} />
        </div>

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
              <button onClick={onClose} className="w-full py-3 rounded-xl bg-primary text-white font-semibold">
                Got it
              </button>
            </div>
          )}

          {step === 'form' && (
            <div className="space-y-5">
              {availableReasons.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                  <AlertTriangle className="w-8 h-8 text-gray-400" />
                  <p className={`text-sm text-center ${textMuted}`}>
                    The dispute window for this order has closed. No further action can be taken
                    at this stage.
                  </p>
                  <button onClick={onClose} className={`mt-2 px-6 py-2 rounded-xl font-semibold ${cardBg} ${textPrimary}`}>
                    Close
                  </button>
                </div>
              ) : (
                <>
                  <div className="p-3 rounded-xl border border-red-500/20 bg-red-500/5">
                    <p className={`text-xs ${textMuted}`}>
                      ⚠️ Raising a dispute will pause all escrow releases until resolved by admin.
                      This action cannot be undone.
                    </p>
                  </div>

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
                            className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-colors ${selected
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
                      className={`w-full p-3 rounded-xl border outline-none resize-none text-sm ${darkMode
                        ? 'bg-black-200 border-black-200 text-white placeholder-gray-1002'
                        : 'bg-gray-1001 border-gray-1001 text-black-200 placeholder-gray-600'
                        }`}
                    />
                    <p className={`text-xs mt-1 ${textMuted}`}>{description.length}/1000</p>
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${textMuted}`}>
                      Evidence{' '}
                      <span className={`font-normal ${textMuted}`}>(optional — photos or documents)</span>
                    </label>

                    {evidenceFiles.length > 0 && (
                      <div className="grid grid-cols-3 gap-2 mb-2">
                        {evidenceFiles.map((file, i) => (
                          <div key={i} className="relative">
                            <img src={file.preview} alt={file.name} className="w-full h-24 object-cover rounded-lg" />
                            <button onClick={() => removeFile(i)} className="absolute top-1 right-1 p-1 bg-red-500 rounded-full">
                              <X className="w-3 h-3 text-white" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className={`w-full h-20 border-2 border-dashed rounded-xl flex items-center justify-center gap-2 transition-colors ${darkMode
                        ? 'border-black-200 hover:border-primary text-gray-1002 hover:text-primary'
                        : 'border-gray-300 hover:border-primary text-gray-600 hover:text-primary'
                        }`}
                    >
                      <Upload className="w-5 h-5" />
                      <span className="text-sm">Upload Photos / Documents</span>
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/*,.pdf" multiple className="hidden" onChange={handleFileSelect} />
                  </div>

                  {/* Inline error — shown above action buttons */}
                  {formError && (
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                      <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      <p className="text-xs text-red-500 font-medium">{formError}</p>
                    </div>
                  )}

                  <div className="flex gap-3 pb-4">
                    <button
                      onClick={onClose}
                      disabled={submitting}
                      className={`flex-1 py-3 rounded-xl font-semibold transition-opacity ${submitting ? 'opacity-50 cursor-not-allowed' : ''} ${cardBg} ${textPrimary}`}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={isSubmitDisabled}
                      className={`flex-1 py-3 rounded-xl font-semibold bg-red-500 text-white transition-opacity ${isSubmitDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'}`}
                    >
                      {submitting ? 'Submitting…' : 'Raise Dispute'}
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