import { useState } from "react";

export const Modal = ({ type, onClose, onConfirm, isConnectLocked, selectedUser, currentOrder, registrationComplete, darkMode }) => {
    const [cancelReason, setCancelReason] = useState("");
    const [customReason, setCustomReason] = useState("");

    const canCancel = currentOrder && currentOrder.paymentStatus !== 'paid';

    const suggestedReasons = [
        "Items exceed 5kg weight limit",
        "Cannot locate pickup address",
        "Safety concern at pickup location",
        "Item not available at market",
        "Other",
    ];

    const finalReason = cancelReason === "Other" ? customReason : cancelReason;
    const canConfirmCancel = finalReason.trim().length > 0;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className={`rounded-2xl shadow-xl max-w-sm w-full p-6 ${darkMode ? 'bg-black-100 text-white' : 'bg-white text-gray-900'}`}>
                {type === 'cancelOrder' && (
                    <>
                        {canCancel ? (
                            <>
                                <h1 className="text-xl font-bold text-red-900 mb-2">Cancel Order</h1>
                                <p className={`text-sm mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Please select a reason for cancelling:</p>
                                <div className="flex flex-col gap-2 mb-4">
                                    {suggestedReasons.map((reason) => (
                                        <button
                                            key={reason}
                                            onClick={() => { setCancelReason(reason); setCustomReason(""); }}
                                            className={`text-left px-3 py-2 rounded-lg border text-sm transition-colors ${cancelReason === reason
                                                ? 'border-red-400 bg-red-50 text-red-700'
                                                : darkMode
                                                    ? 'border-black-200 text-gray-300 hover:border-gray-500'
                                                    : 'border-gray-200 text-gray-700 hover:border-gray-400'
                                            }`}
                                        >
                                            {reason}
                                        </button>
                                    ))}
                                </div>
                                {cancelReason === "Other" && (
                                    <textarea
                                        value={customReason}
                                        onChange={(e) => setCustomReason(e.target.value)}
                                        placeholder="Describe your reason..."
                                        className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-300 resize-none mb-4 ${darkMode
                                            ? 'bg-black-200 border-black-200 text-gray-300 placeholder-gray-500'
                                            : 'border-gray-200 text-gray-700'
                                        }`}
                                        rows={3}
                                    />
                                )}
                            </>
                        ) : (
                            <>
                                <h1 className={`text-xl font-bold mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Cancel Order</h1>
                                <p className={`mb-6 ${darkMode ? 'text-gray-400' : 'text-black'}`}>
                                    {currentOrder?.paymentStatus === 'paid'
                                        ? 'This order has already been funded and cannot be cancelled. Please raise a dispute instead.'
                                        : 'There is no active order to cancel.'
                                    }
                                </p>
                            </>
                        )}
                    </>
                )}

                <div className="flex justify-end gap-3 font-medium">
                    <button onClick={onClose} className="text-red-400">
                        {type === 'cancelOrder' && !canCancel ? 'Close' : 'No'}
                    </button>
                    {type === 'cancelOrder' && canCancel && (
                        <button
                            onClick={() => onConfirm?.(finalReason)}
                            disabled={!canConfirmCancel}
                            className={`text-primary ${!canConfirmCancel ? 'opacity-40 pointer-events-none' : ''}`}
                        >
                            Yes
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};