import { useEffect, useState, useMemo } from "react";
import { useDispatch, useSelector, shallowEqual } from "react-redux";
import { ChevronLeft, Plus, AlertCircle, Clock, CheckCircle, XCircle } from "lucide-react";
import { raiseDispute, getRunnerDisputes, clearDispute } from "../../Redux/disputeSlice";
import { getAvailableRunnerReasons, getReasonLabel } from "../../utils/disputeReasons";

export function Disputes({ darkMode, onBack, runnerId, currentOrder, chatId }) {
  const disputes = useSelector(s => s.dispute.disputes, shallowEqual);
  const loading = useSelector(s => s.dispute.loading);
  const disputeError = useSelector(s => s.dispute.error);
  const dispatch = useDispatch();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ reason: "", description: "" });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const availableReasons = useMemo(
    () => getAvailableRunnerReasons(
      currentOrder?.serviceType ?? currentOrder?.taskType,
    ),
    [currentOrder?.serviceType, currentOrder?.taskType]
  );

  const hasActiveOrder = !!currentOrder?.orderId &&
    !['completed', 'cancelled', 'task_completed'].includes(currentOrder?.status);

  // The dispute for the current order if any
  const currentOrderDispute = useMemo(() =>
    disputes?.find(d =>
      (d.orderId?.orderId || d.orderId) === currentOrder?.orderId
    ) ?? null,
    [disputes, currentOrder?.orderId]
  );

  const hasActiveDispute = currentOrderDispute &&
    ['open', 'under_review', 'pending'].includes(currentOrderDispute.status);

  const hasResolvedDispute = currentOrderDispute &&
    ['resolved', 'dismissed'].includes(currentOrderDispute.status);

  const canRaise = hasActiveOrder && !hasActiveDispute && !showForm;

  // Theme shortcuts
  const page = darkMode ? "bg-black-100" : "bg-gray-50";
  const card = darkMode ? "bg-black-100 border-white/10" : "bg-white border-gray-100";
  const heading = darkMode ? "text-white" : "text-black-200";
  const ghost = darkMode ? "border-white/10 text-gray-300" : "border-gray-200 text-black-200";
  const inputCls = `w-full rounded-2xl px-5 py-4 text-sm focus:outline-none placeholder:text-black-100/80 border ${
    darkMode ? "bg-black-200 border-white/10 text-white placeholder:text-gray-400" : "bg-white border-gray-200 text-black-200 placeholder:text-black-100/80"
  }`;

  useEffect(() => {
    if (runnerId) dispatch(getRunnerDisputes(runnerId));
    return () => dispatch(clearDispute());
  }, [runnerId, dispatch]);

  useEffect(() => {
    if (form.reason && !availableReasons.find(r => r.value === form.reason)) {
      setForm(p => ({ ...p, reason: "" }));
    }
  }, [availableReasons, form.reason]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!form.reason.trim() || !form.description.trim()) {
      setFormError("Please fill in all fields.");
      return;
    }
    if (!currentOrder?.orderId) {
      setFormError("No active order to raise a dispute for.");
      return;
    }
    if (form.description.trim().length < 20) {
      setFormError("Please provide more detail (at least 20 characters).");
      return;
    }
    setSubmitting(true);
    try {
      await dispatch(raiseDispute({
        orderId: currentOrder.orderId,
        chatId,
        reason: form.reason.trim(),
        description: form.description.trim(),
      })).unwrap();
      setForm({ reason: "", description: "" });
      setShowForm(false);
      dispatch(getRunnerDisputes(runnerId));
    } catch (err) {
      setFormError(err?.message || err?.response?.data?.message || "Failed to raise dispute.");
    } finally {
      setSubmitting(false);
    }
  };

  const statusIcon = (s) => ({
    open: <Clock className="h-4 w-4 text-yellow-400" />,
    resolved: <CheckCircle className="h-4 w-4 text-green-400" />,
    dismissed: <XCircle className="h-4 w-4 text-orange-400" />,
    rejected: <XCircle className="h-4 w-4 text-red-400" />,
    pending: <AlertCircle className="h-4 w-4 text-orange-400" />,
    under_review: <Clock className="h-4 w-4 text-blue-400" />,
  }[s] ?? <AlertCircle className="h-4 w-4 text-black-100/80 dark:text-gray-400" />);

  const statusBadge = (s) => ({
    open: darkMode ? "bg-yellow-500/20 text-yellow-400" : "bg-yellow-100 text-yellow-700",
    resolved: darkMode ? "bg-green-500/20 text-green-400" : "bg-green-100 text-green-700",
    dismissed: darkMode ? "bg-orange-500/20 text-orange-400" : "bg-orange-100 text-orange-700",
    rejected: darkMode ? "bg-red-500/20 text-red-400" : "bg-red-100 text-red-700",
    pending: darkMode ? "bg-orange-500/20 text-orange-400" : "bg-orange-100 text-orange-700",
    under_review: darkMode ? "bg-blue-500/20 text-blue-400" : "bg-blue-100 text-blue-700",
  }[s] ?? (darkMode ? "bg-white/5 text-gray-400" : "bg-gray-100 text-black-100/80"));

  if (!runnerId) {
    return (
      <div className={`h-screen flex flex-col transition-colors duration-300 ${page}`}>
        <div className={`flex items-center gap-3 px-4 py-4 border-b ${darkMode ? "border-white/50" : "border-gray-100"}`}>
          <button onClick={onBack} className={`p-2 transition-colors ${darkMode ? "hover:bg-black-200" : "hover:bg-gray-100"}`}>
            <ChevronLeft className={`w-5 h-5 ${heading}`} />
          </button>
          <h1 className={`text-lg font-bold ${heading}`}>Disputes</h1>
        </div>
        <div className="flex-1 flex items-center justify-center px-4">
          <div className={`p-6 ${card} text-center`}>
            <AlertCircle className="h-8 w-8 text-black-100/80 dark:text-gray-400 mx-auto mb-3" />
            <p className={`text-sm font-medium ${heading}`}>Get Started to view disputes</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-screen flex flex-col transition-colors duration-300 ${page}`}>

      {/* Header */}
      <div className={`flex items-center gap-3 px-4 py-4 border-b flex-shrink-0 ${
        darkMode ? "border-white/10" : "border-gray-100"
      }`}>
        <button
          onClick={onBack}
          className={`p-2 rounded-full transition-colors ${darkMode ? "hover:bg-black-200" : "hover:bg-gray-100"}`}
        >
          <ChevronLeft className={`w-5 h-5 ${heading}`} />
        </button>
        <div className="flex-1">
          <h1 className={`text-lg font-bold ${heading}`}>Disputes</h1>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-black-100/80 dark:text-gray-400">
            {hasActiveOrder ? 'Raise & track disputes' : 'Your dispute history'}
          </p>
        </div>

        {canRaise && (
          <button
            onClick={() => setShowForm(true)}
            className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl border transition-all ${ghost}`}
          >
            <Plus className="h-3 w-3" /> New
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 marketSelection space-y-4">

        {/* ── Active dispute for current order ─────────────────────────────── */}
        {hasActiveDispute && !showForm && (
          <div className={`rounded-3xl p-5 border border-yellow-500/20 bg-yellow-500/5`}>
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-yellow-400" />
              <p className={`text-sm font-bold ${heading}`}>Dispute Under Review</p>
            </div>
            <p className="text-xs text-black-100/80 dark:text-gray-400">
              Your dispute for order <span className="font-semibold text-white/70">{currentOrder?.orderId}</span> is
              currently being reviewed by admin. You'll be notified once it's resolved.
            </p>
            <div className={`mt-3 pt-3 border-t border-yellow-500/10 space-y-1`}>
              <p className="text-[10px] text-black-100/80 dark:text-gray-400 uppercase tracking-widest font-bold">Reason</p>
              <p className={`text-xs font-semibold ${heading}`}>{getReasonLabel(currentOrderDispute.reason)}</p>
              {currentOrderDispute.description && (
                <p className="text-xs text-black-100/80 dark:text-gray-400 mt-1">{currentOrderDispute.description}</p>
              )}
            </div>
          </div>
        )}

        {/* ── Resolved dispute for current order ───────────────────────────── */}
        {hasResolvedDispute && !showForm && (
          <div className={`rounded-3xl p-5 border ${
            currentOrderDispute.status === 'dismissed'
              ? 'border-orange-500/20 bg-orange-500/5'
              : 'border-green-500/20 bg-green-500/5'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {currentOrderDispute.status === 'dismissed'
                  ? <XCircle className="h-4 w-4 text-orange-400" />
                  : <CheckCircle className="h-4 w-4 text-green-400" />
                }
                <p className={`text-sm font-bold ${heading}`}>
                  {currentOrderDispute.status === 'dismissed' ? 'Dispute Dismissed' : 'Dispute Resolved'}
                </p>
              </div>
              <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg ${statusBadge(currentOrderDispute.status)}`}>
                {currentOrderDispute.status}
              </span>
            </div>

            <div className="space-y-1 mt-3">
              <p className="text-[10px] text-black-100/80 dark:text-gray-400 uppercase tracking-widest font-bold">Reason</p>
              <p className={`text-xs font-semibold ${heading}`}>{getReasonLabel(currentOrderDispute.reason)}</p>
              {currentOrderDispute.description && (
                <p className="text-xs text-black-100/80 dark:text-gray-400">{currentOrderDispute.description}</p>
              )}
            </div>

            {currentOrderDispute.resolution && (
              <div className={`mt-3 pt-3 border-t ${
                currentOrderDispute.status === 'dismissed' ? 'border-orange-500/10' : 'border-green-500/10'
              } space-y-1.5`}>
                <p className="text-[10px] text-black-100/80 dark:text-gray-400 uppercase tracking-widest font-bold">Resolution</p>
                {currentOrderDispute.resolution.outcome && (
                  <p className="text-xs text-black-100/80 dark:text-gray-400 capitalize">
                    <span className="font-bold">Outcome:</span>{' '}
                    {currentOrderDispute.resolution.outcome.replace(/_/g, ' ')}
                  </p>
                )}
                {currentOrderDispute.resolution.notes && (
                  <p className="text-xs text-black-100/80 dark:text-gray-400">
                    <span className="font-bold">Notes:</span> {currentOrderDispute.resolution.notes}
                  </p>
                )}
                {currentOrderDispute.resolution.amountToRunner != null && (
                  <p className="text-xs text-black-100/80 dark:text-gray-400">
                    <span className="font-bold">Released to you:</span>{' '}
                    ₦{currentOrderDispute.resolution.amountToRunner?.toLocaleString()}
                  </p>
                )}
                {currentOrderDispute.resolution.resolvedAt && (
                  <p className="text-[10px] text-black-100/80 dark:text-gray-400">
                    Resolved {new Date(currentOrderDispute.resolution.resolvedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            )}

            {/* Raise new dispute after resolution */}
            {hasActiveOrder && (
              <button
                onClick={() => {
                  setForm({ reason: "", description: "" });
                  setFormError("");
                  setShowForm(true);
                }}
                className="mt-4 w-full py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest border border-dashed border-white/20 text-black-100/80 dark:text-gray-400 hover:text-white hover:border-white/40 transition-all"
              >
                + Raise New Dispute
              </button>
            )}
          </div>
        )}

        {/* ── No active order — view-only ──────────────────────────────────── */}
        {!hasActiveOrder && !currentOrderDispute && (
          <div className={`rounded-3xl p-5 border ${card} flex items-start gap-3`}>
            <AlertCircle className="h-5 w-5 text-black-100/80 dark:text-gray-400 flex-shrink-0 mt-0.5" />
            <div className="flex flex-col ml-auto mr-auto justify-center items-center">
              <p className={`text-sm font-bold ${heading}`}>No disputes yet</p>
              <p className="text-xs text-black-100/80 dark:text-gray-400 mt-1 text-center">
                You can raise a dispute during an active order if something goes wrong.
              </p>
            </div>
          </div>
        )}

        {/* ── Raise dispute form ───────────────────────────────────────────── */}
        {showForm && (
          <div className={`rounded-3xl p-6 border-2 border-dashed space-y-3 ${
            darkMode ? "border-white/10" : "border-gray-200"
          }`}>
            <p className={`text-xs font-black uppercase tracking-widest mb-2 ${heading}`}>
              Order: {currentOrder?.orderId}
            </p>
            <div className="p-3 rounded-xl border border-red-500/20 bg-red-500/5">
              <p className="text-xs text-black-100/80 dark:text-gray-400">
                ⚠️ Raising a dispute will pause all escrow releases until resolved by admin.
                This action cannot be undone.
              </p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <select
                value={form.reason}
                onChange={e => { setForm(p => ({ ...p, reason: e.target.value })); setFormError(""); }}
                className={inputCls}
              >
                <option value="">Select reason</option>
                {availableReasons.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              {form.reason && (
                <p className="text-xs text-black-100/80 dark:text-gray-400 px-1">
                  {availableReasons.find(r => r.value === form.reason)?.description}
                </p>
              )}
              <textarea
                rows={4}
                placeholder={
                  form.reason
                    ? `Describe the "${availableReasons.find(r => r.value === form.reason)?.label}" issue in detail…`
                    : "Select a reason above, then describe what happened…"
                }
                value={form.description}
                onChange={e => {
                  setForm(p => ({ ...p, description: e.target.value.slice(0, 1000) }));
                  setFormError("");
                }}
                className={`${inputCls} resize-none`}
              />
              <p className="text-[10px] text-black-100/80 dark:text-gray-400 text-right">{form.description.length}/1000</p>
              {formError && <p className="text-xs text-red-400">{formError}</p>}
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={submitting || !form.reason || form.description.trim().length < 20}
                  className="flex-1 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-red-500 text-white active:scale-95 disabled:opacity-50 transition-all"
                >
                  {submitting ? "Submitting…" : "Submit Dispute"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setFormError(""); setForm({ reason: "", description: "" }); }}
                  className={`px-6 rounded-2xl text-[11px] font-black uppercase border ${ghost}`}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Disputes list ────────────────────────────────────────────────── */}
        {loading && (
          <p className="text-xs text-black-100/80 dark:text-gray-400 text-center py-8">Loading disputes…</p>
        )}
        {disputeError && (
          <p className="text-xs text-red-400 text-center py-8">Failed to load disputes.</p>
        )}

        {!loading && !disputeError && disputes.length > 0 && (
          <div className="space-y-3">
            <p className="text-[10px] text-black-100/80 dark:text-gray-400 uppercase tracking-widest font-bold">All Disputes</p>
            {disputes.map(d => (
              <div key={d._id} className={`rounded-3xl p-6 border ${card} space-y-3`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {statusIcon(d.status)}
                    <p className={`text-sm font-bold ${heading}`}>{getReasonLabel(d.reason)}</p>
                  </div>
                  <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg ${statusBadge(d.status)}`}>
                    {d.status}
                  </span>
                </div>
                <p className="text-xs text-black-100/80 dark:text-gray-400">{d.description}</p>
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-black-100/80 dark:text-gray-400">Order: {d.orderId?.orderId || d.orderId}</p>
                  <p className="text-[10px] text-black-100/80 dark:text-gray-400">
                    {d.createdAt ? new Date(d.createdAt).toLocaleDateString() : ""}
                  </p>
                </div>
                {d.resolution && (
                  <div className={`rounded-2xl p-3 ${darkMode ? "bg-black-200" : "bg-gray-50"}`}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-black-100/80 dark:text-gray-400 mb-2">Resolution</p>
                    {d.resolution.outcome && (
                      <p className="text-xs text-black-100/80 dark:text-gray-400 capitalize">
                        <span className="font-bold">Outcome:</span> {d.resolution.outcome.replace(/_/g, ' ')}
                      </p>
                    )}
                    {d.resolution.notes && (
                      <p className="text-xs text-black-100/80 dark:text-gray-400 mt-1">
                        <span className="font-bold">Notes:</span> {d.resolution.notes}
                      </p>
                    )}
                    {d.resolution.amountToRunner != null && (
                      <p className="text-xs text-black-100/80 dark:text-gray-400 mt-1">
                        <span className="font-bold">Released to you:</span> ₦{d.resolution.amountToRunner?.toLocaleString()}
                      </p>
                    )}
                    {d.resolution.resolvedAt && (
                      <p className="text-[10px] text-black-100/80 dark:text-gray-400 mt-2">
                        Resolved {new Date(d.resolution.resolvedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}