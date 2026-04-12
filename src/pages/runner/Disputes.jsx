import { useEffect, useState } from "react";
import { useDispatch, useSelector, shallowEqual } from "react-redux";
import { ChevronLeft, Plus, AlertCircle, Clock, CheckCircle, XCircle } from "lucide-react";
import { raiseDispute, getRunnerDisputes, clearDispute } from "../../Redux/disputeSlice";

export function Disputes({ darkMode, onBack, runnerId, currentOrder, chatId }) {
    const disputes = useSelector(s => s.dispute.disputes, shallowEqual);
    const loading = useSelector(s => s.dispute.loading);
    const disputeError = useSelector(s => s.dispute.error);
    const dispatch = useDispatch();

    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ reason: "", description: "" });
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState("");

    const page = darkMode ? "bg-black-100" : "bg-gray-50";
    const card = darkMode ? "bg-black-100 border-white/10" : "bg-white border-gray-100";
    const heading = darkMode ? "text-white" : "text-black-200";
    const ghost = darkMode ? "border-white/10 text-gray-300" : "border-gray-200 text-black-200";
    const inputCls = `w-full rounded-2xl px-5 py-4 text-sm focus:outline-none placeholder:text-gray-400 border ${darkMode ? "bg-black-200 border-white/10 text-white" : "bg-white border-gray-200 text-black-200"
        }`;

    useEffect(() => {
        if (runnerId) dispatch(getRunnerDisputes(runnerId));
        return () => dispatch(clearDispute());
    }, [runnerId, dispatch]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.reason.trim() || !form.description.trim()) {
            setFormError("Please fill in all fields.");
            return;
        }
        if (!currentOrder?.orderId) {
            setFormError("No active order to raise a dispute for.");
            return;
        }

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
            setFormError(err.response?.data?.message || "Failed to raise dispute.");
        } finally {
            setSubmitting(false);
        }
    };

    const statusIcon = (s) => ({
        open: <Clock className="h-4 w-4 text-yellow-400" />,
        resolved: <CheckCircle className="h-4 w-4 text-green-400" />,
        rejected: <XCircle className="h-4 w-4 text-red-400" />,
        pending: <AlertCircle className="h-4 w-4 text-orange-400" />,
    }[s] || <AlertCircle className="h-4 w-4 text-gray-400" />);

    const statusBadge = (s) => ({
        open: darkMode ? "bg-yellow-500/20 text-yellow-400" : "bg-yellow-100 text-yellow-700",
        resolved: darkMode ? "bg-green-500/20 text-green-400" : "bg-green-100 text-green-700",
        rejected: darkMode ? "bg-red-500/20 text-red-400" : "bg-red-100 text-red-700",
        pending: darkMode ? "bg-orange-500/20 text-orange-400" : "bg-orange-100 text-orange-700",
    }[s] || (darkMode ? "bg-white/5 text-gray-400" : "bg-gray-100 text-gray-500"));

    return (
        <div className={`h-screen flex flex-col transition-colors duration-300 ${page}`}>

            {/* Header */}
            <div className={`flex items-center gap-3 px-4 py-4 border-b flex-shrink-0 ${darkMode ? "border-white/10" : "border-gray-100"
                }`}>
                <button
                    onClick={onBack}
                    className={`p-2 rounded-full transition-colors ${darkMode ? "hover:bg-black-200" : "hover:bg-gray-100"
                        }`}
                >
                    <ChevronLeft className={`w-5 h-5 ${heading}`} />
                </button>
                <div className="flex-1">
                    <h1 className={`text-lg font-bold ${heading}`}>Disputes</h1>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">
                        Raise & track disputes
                    </p>
                </div>
                {currentOrder?.orderId && !showForm && (
                    <button
                        onClick={() => setShowForm(true)}
                        className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl border transition-all ${ghost}`}
                    >
                        <Plus className="h-3 w-3" /> New
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 marketSelection space-y-4">

                {/* Raise dispute form */}
                {showForm && (
                    <div className={`rounded-3xl p-6 border-2 border-dashed space-y-3 ${darkMode ? "border-white/10" : "border-gray-200"
                        }`}>
                        <p className={`text-xs font-black uppercase tracking-widest mb-2 ${heading}`}>
                            Order: {currentOrder?.orderId}
                        </p>
                        <form onSubmit={handleSubmit} className="space-y-3">
                            <select
                                value={form.reason}
                                onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
                                className={inputCls}
                            >
                                <option value="">Select reason</option>
                                <option value="wrong_item">Wrong item delivered</option>
                                <option value="item_missing">Item missing</option>
                                <option value="damaged_item">Item damaged</option>
                                <option value="not_delivered">Not delivered</option>
                                <option value="payment_issue">Payment issue</option>
                                <option value="other">Other</option>
                            </select>

                            <textarea
                                rows={4}
                                placeholder="Describe the issue in detail..."
                                value={form.description}
                                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                                className={`${inputCls} resize-none`}
                            />

                            {formError && (
                                <p className="text-xs text-red-400">{formError}</p>
                            )}

                            <div className="flex gap-3">
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex-1 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-primary text-white active:scale-95 disabled:opacity-50 transition-all"
                                >
                                    {submitting ? "Submitting..." : "Submit Dispute"}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setShowForm(false); setFormError(""); }}
                                    className={`px-6 rounded-2xl text-[11px] font-black uppercase border ${ghost}`}
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* No active order warning */}
                {!currentOrder?.orderId && !showForm && (
                    <div className={`rounded-3xl p-6 border ${card} text-center`}>
                        <AlertCircle className="h-8 w-8 text-gray-400 mx-auto mb-3" />
                        <p className={`text-sm font-bold ${heading}`}>No active order</p>
                        <p className="text-xs text-gray-400 mt-1">
                            Disputes can only be raised for active or recently completed orders.
                        </p>
                    </div>
                )}

                {/* Disputes list */}
                {loading && (
                    <p className="text-xs text-gray-400 text-center py-8">Loading disputes...</p>
                )}
                {disputeError && (
                    <p className="text-xs text-red-400 text-center py-8">Failed to load disputes.</p>
                )}
                {!loading && !disputeError && disputes.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-8">No disputes yet.</p>
                )}

                {disputes.map(d => (
                    <div key={d._id} className={`rounded-3xl p-6 border ${card} space-y-3`}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                {statusIcon(d.status)}
                                <p className={`text-sm font-bold ${heading}`}>
                                    {d.reason?.replace(/_/g, ' ')}
                                </p>
                            </div>
                            <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg ${statusBadge(d.status)}`}>
                                {d.status}
                            </span>
                        </div>

                        <p className="text-xs text-gray-400">{d.description}</p>

                        <div className="flex items-center justify-between">
                            <p className="text-[10px] text-gray-400">
                                Order: {d.orderId?.orderId || d.orderId}
                            </p>
                            <p className="text-[10px] text-gray-400">
                                {d.createdAt ? new Date(d.createdAt).toLocaleDateString() : ""}
                            </p>
                        </div>

                        {d.resolution && (
                            <div className={`rounded-2xl p-3 ${darkMode ? "bg-black-200" : "bg-gray-50"
                                }`}>
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">
                                    Resolution
                                </p>
                                <p className="text-xs text-gray-400">{d.resolution}</p>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}