import React, { useState, useRef } from 'react';
import { X, AlertTriangle, Upload, CheckCircle } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { raiseDispute } from '../../Redux/disputeSlice';
import { getAvailableReasons, getReasonLabel } from '../../utils/disputeReasons';
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
  existingDispute, // pass in the current order's dispute doc if any
}) {
  const dispatch = useDispatch();
  const loading = useSelector((s) => s.dispute.loading);

  const currentOrder = useUserOrderStore((s) => s.currentOrder);

  const orderId = currentOrder?.orderId;
  const serviceType = currentOrder?.serviceType ?? currentOrder?.taskType ?? serviceTypeProp ?? null;

  const [showNewForm, setShowNewForm] = useState(false);
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [evidenceFiles, setEvidenceFiles] = useState([]);
  const [formError, setFormError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const errorTimerRef = useRef(null);
  const fileInputRef = useRef(null);

  const availableReasons = getAvailableReasons(serviceType);
  const selectedReason = availableReasons.find((r) => r.value === reason);

  const hasActiveDispute = existingDispute &&
    ['open', 'under_review', 'pending'].includes(existingDispute.status);
  const hasResolvedDispute = existingDispute &&
    ['resolved', 'dismissed'].includes(existingDispute.status);

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

      setSubmitted(true);
      setShowNewForm(false);
    } catch (error) {
      const msg = typeof error === 'string' ? error : error?.message || 'Failed to raise dispute. Please try again.';
      showError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setReason('');
    setDescription('');
    setEvidenceFiles([]);
    setFormError('');
    setShowNewForm(true);
  };

  if (!isOpen) return null;

  const cardBg = darkMode ? 'bg-black-200' : 'bg-gray-1001';
  const border = darkMode ? 'border-black-200' : 'border-gray-1001';
  const textPrimary = darkMode ? 'text-white' : 'text-black-200';
  const textMuted = darkMode ? 'text-gray-1002' : 'text-gray-600';
  const isSubmitDisabled = loading || submitting || !!formError || !reason || description.trim().length < 20;

  // ── Active dispute screen ───────────────────────────────────────────────────
  const renderActiveDispute = () => (
    <div className="flex flex-col items-center justify-center py-8 gap-4">
      <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center">
        <AlertTriangle className="w-8 h-8 text-yellow-500" />
      </div>
      <h3 className={`text-lg font-bold ${textPrimary}`}>Dispute Under Review</h3>
      <p className={`text-sm text-center ${textMuted}`}>
        Your dispute is currently being reviewed by our team. You'll be notified once it's resolved.
      </p>
      <div className={`w-full p-4 rounded-xl ${cardBg} space-y-2`}>
        <p className={`text-xs font-semibold uppercase tracking-widest ${textMuted}`}>Reason</p>
        <p className={`text-sm font-bold ${textPrimary}`}>{getReasonLabel(existingDispute.reason)}</p>
        {existingDispute.description && (
          <p className={`text-xs mt-1 ${textMuted}`}>{existingDispute.description}</p>
        )}
      </div>
      <button onClick={onClose} className={`w-full py-3 rounded-xl font-semibold ${cardBg} ${textPrimary}`}>
        Close
      </button>
    </div>
  );

  // ── Resolved dispute screen ─────────────────────────────────────────────────
  const renderResolvedDispute = () => (
    <div className="flex flex-col py-6 gap-4">
      <div className="flex items-center gap-3">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
          existingDispute.status === 'dismissed' ? 'bg-orange-500/10' : 'bg-green-500/10'
        }`}>
          {existingDispute.status === 'dismissed'
            ? <AlertTriangle className="w-6 h-6 text-orange-500" />
            : <CheckCircle className="w-6 h-6 text-green-500" />
          }
        </div>
        <div>
          <h3 className={`font-bold ${textPrimary}`}>
            {existingDispute.status === 'dismissed' ? 'Dispute Dismissed' : 'Dispute Resolved'}
          </h3>
          <p className={`text-xs ${textMuted}`}>
            {existingDispute.resolution?.resolvedAt
              ? new Date(existingDispute.resolution.resolvedAt).toLocaleDateString()
              : ''}
          </p>
        </div>
      </div>

      <div className={`p-4 rounded-xl ${cardBg} space-y-2`}>
        <p className={`text-xs font-semibold uppercase tracking-widest ${textMuted}`}>Dispute</p>
        <p className={`text-sm font-bold ${textPrimary}`}>{getReasonLabel(existingDispute.reason)}</p>
        {existingDispute.description && (
          <p className={`text-xs ${textMuted}`}>{existingDispute.description}</p>
        )}
      </div>

      {existingDispute.resolution && (
        <div className={`p-4 rounded-xl border ${
          existingDispute.status === 'dismissed'
            ? 'border-orange-500/20 bg-orange-500/5'
            : 'border-green-500/20 bg-green-500/5'
        } space-y-2`}>
          <p className={`text-xs font-semibold uppercase tracking-widest ${textMuted}`}>Resolution</p>
          {existingDispute.resolution.outcome && (
            <p className={`text-sm font-bold capitalize ${textPrimary}`}>
              {existingDispute.resolution.outcome.replace(/_/g, ' ')}
            </p>
          )}
          {existingDispute.resolution.notes && (
            <p className={`text-xs ${textMuted}`}>{existingDispute.resolution.notes}</p>
          )}
          {existingDispute.resolution.amountToUser != null && existingDispute.resolution.amountToUser > 0 && (
            <p className={`text-xs font-semibold text-green-500`}>
              ₦{existingDispute.resolution.amountToUser.toLocaleString()} refunded to your wallet
            </p>
          )}
        </div>
      )}

      <button
        onClick={resetForm}
        className={`w-full py-3 rounded-xl font-semibold border-2 border-dashed transition-colors ${
          darkMode
            ? 'border-white/20 text-gray-400 hover:border-white/40 hover:text-white'
            : 'border-gray-300 text-gray-500 hover:border-gray-400 hover:text-black-200'
        }`}
      >
        + Raise New Dispute
      </button>

      <button onClick={onClose} className={`w-full py-3 rounded-xl font-semibold ${cardBg} ${textPrimary}`}>
        Close
      </button>
    </div>
  );

  // ── Just submitted screen ───────────────────────────────────────────────────
  const renderSubmitted = () => (
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
  );

  // ── Form ────────────────────────────────────────────────────────────────────
  const renderForm = () => (
    <div className="space-y-5">
      <div className="p-3 rounded-xl border border-red-500/20 bg-red-500/5">
        <p className={`text-xs ${textMuted}`}>
          ⚠️ Raising a dispute will pause all escrow releases until resolved by admin.
          This action cannot be undone.
        </p>
      </div>

      <div>
        <label className={`block text-sm font-medium mb-2 ${textMuted}`}>What's the issue?</label>
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

      <div>
        <label className={`block text-sm font-medium mb-2 ${textMuted}`}>Tell us what happened</label>
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

      <div>
        <label className={`block text-sm font-medium mb-2 ${textMuted}`}>
          Evidence <span className={`font-normal ${textMuted}`}>(optional — photos or documents)</span>
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
          className={`w-full h-20 border-2 border-dashed rounded-xl flex items-center justify-center gap-2 transition-colors ${
            darkMode
              ? 'border-black-200 hover:border-primary text-gray-1002 hover:text-primary'
              : 'border-gray-300 hover:border-primary text-gray-600 hover:text-primary'
          }`}
        >
          <Upload className="w-5 h-5" />
          <span className="text-sm">Upload Photos / Documents</span>
        </button>
        <input ref={fileInputRef} type="file" accept="image/*,.pdf" multiple className="hidden" onChange={handleFileSelect} />
      </div>

      {formError && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <p className="text-xs text-red-500 font-medium">{formError}</p>
        </div>
      )}

      <div className="flex gap-3 pb-4">
        <button
          onClick={() => { setShowNewForm(false); setFormError(''); }}
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
    </div>
  );

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
          {submitted && renderSubmitted()}
          {!submitted && showNewForm && renderForm()}
          {!submitted && !showNewForm && hasActiveDispute && renderActiveDispute()}
          {!submitted && !showNewForm && hasResolvedDispute && renderResolvedDispute()}
          {!submitted && !showNewForm && !existingDispute && renderForm()}
        </div>
      </div>
    </div>
  );
}