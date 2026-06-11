import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { ChevronLeft, AlertCircle, Clock, CheckCircle, XCircle } from 'lucide-react';
import { getUserDisputes, clearDispute } from '../../Redux/disputeSlice';
import { getReasonLabel } from '../../utils/disputeReasons';

export default function UserDisputes({ darkMode, onBack, userId }) {
    const dispatch = useDispatch();
    const disputes = useSelector(s => s.dispute.disputes);
    const loading = useSelector(s => s.dispute.loading);
    const error = useSelector(s => s.dispute.error);

    useEffect(() => {
        console.log('UserDisputes useEffect - userId:', userId);
        if (!userId) {
            console.log('No userId, skipping fetch');
            return;
        }
        console.log('Dispatching getUserDisputes for userId:', userId);
        
        dispatch(getUserDisputes(userId));
        return () => dispatch(clearDispute());
    }, [userId, dispatch]);

    const page = darkMode ? 'bg-black-100' : 'bg-gray-1000';
    const card = darkMode ? 'bg-black-100 border-white/10' : 'bg-white border-gray-200';
    const heading = darkMode ? 'text-white' : 'text-black-200';

    const statusIcon = (s) => ({
        open: <Clock className="h-4 w-4 text-primary" />,
        resolved: <CheckCircle className="h-4 w-4 text-green-400" />,
        rejected: <XCircle className="h-4 w-4 text-red-400" />,
        under_review: <AlertCircle className="h-4 w-4 text-primary" />,
    }[s] ?? <AlertCircle className="h-4 w-4 text-black-100/80 dark:text-gray-500" />);

    const statusBadge = (s) => ({
        open: darkMode ? 'bg-primary/20 text-primary' : 'bg-primary/10 text-primary',
        resolved: darkMode ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700',
        rejected: darkMode ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700',
        under_review: darkMode ? 'bg-primary/20 text-primary' : 'bg-primary/10 text-primary',
    }[s] ?? (darkMode ? 'bg-white/5 text-gray-400' : 'bg-gray-100 text-black-100/80'));

    return (
        <div className={`h-screen flex flex-col transition-colors duration-300 ${page}`}>
            {/* Header */}
            <div className={`flex items-center gap-3 px-4 py-4 border-b flex-shrink-0 ${darkMode ? 'border-white/10' : 'border-gray-200'}`}>
                <button
                    onClick={onBack}
                    className={`p-2 rounded-full transition-colors ${darkMode ? 'hover:bg-black-200' : 'hover:bg-gray-100'}`}
                >
                    <ChevronLeft className={`w-5 h-5 ${heading}`} />
                </button>
                <div className="flex-1">
                    <h1 className={`text-lg font-bold ${heading}`}>Disputes</h1>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-black-100/80 dark:text-gray-500">
                        Your dispute history
                    </p>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {loading && (
                    <p className="text-xs text-black-100/80 dark:text-gray-500 text-center py-8">Loading disputes...</p>
                )}

                {error && (
                    <p className="text-xs text-red-400 text-center py-8">Failed to load disputes</p>
                )}

                {!loading && !error && disputes.length === 0 && (
                    <div className={`rounded-3xl p-6 border ${card} text-center`}>
                        <AlertCircle className="h-8 w-8 text-black-100/80 dark:text-gray-500 mx-auto mb-3" />
                        <p className={`text-sm font-bold ${heading}`}>No disputes yet</p>
                        <p className="text-xs text-black-100/80 dark:text-gray-500 mt-1">
                            You can raise a dispute during an active order if something goes wrong.
                        </p>
                    </div>
                )}

                {disputes.map(dispute => (
                    <div key={dispute._id} className={`rounded-3xl p-5 border ${card} space-y-3`}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                {statusIcon(dispute.status)}
                                <p className={`text-sm font-bold ${heading}`}>
                                    {getReasonLabel(dispute.reason)}
                                </p>
                            </div>
                            <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg ${statusBadge(dispute.status)}`}>
                                {dispute.status?.replace('_', ' ') || 'pending'}
                            </span>
                        </div>

                        <p className="text-xs text-black-100/80 dark:text-gray-500 line-clamp-2">{dispute.description}</p>

                        <div className="flex items-center justify-between">
                            <p className="text-[10px] text-black-100/80 dark:text-gray-500">
                                Order: {dispute.orderId?.orderId || dispute.orderId}
                            </p>
                            <p className="text-[10px] text-black-100/80 dark:text-gray-500">
                                {dispute.createdAt ? new Date(dispute.createdAt).toLocaleDateString() : ''}
                            </p>
                        </div>

                        {dispute.resolution && (
                            <div className={`rounded-2xl p-3 ${darkMode ? 'bg-black-200' : 'bg-gray-100'}`}>
                                <p className="text-[10px] font-black uppercase tracking-widest text-black-100/80 dark:text-gray-500 mb-2">
                                    Resolution
                                </p>
                                {dispute.resolution.outcome && (
                                    <p className="text-xs text-black-100/80 dark:text-gray-500 capitalize">
                                        <span className="font-bold">Outcome:</span> {dispute.resolution.outcome?.replace(/_/g, ' ')}
                                    </p>
                                )}
                                {dispute.resolution.amountToUser > 0 && (
                                    <p className="text-xs text-black-100/80 dark:text-gray-500 mt-1">
                                        <span className="font-bold">Refunded:</span> ₦{dispute.resolution.amountToUser?.toLocaleString()}
                                    </p>
                                )}
                                {dispute.resolution.notes && (
                                    <p className="text-xs text-black-100/80 dark:text-gray-500 mt-1">
                                        <span className="font-bold">Notes:</span> {dispute.resolution.notes}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}