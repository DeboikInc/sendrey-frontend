import { useState } from "react";

export const Modal = ({ type, onClose, onConfirm, isConnectLocked, selectedUser, currentOrder, registrationComplete }) => {
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

    const handleConfirm = () => {
        onConfirm(finalReason);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">

                {type === 'newOrder' && (
                    <>
                        {currentOrder && currentOrder.paymentStatus !== 'paid' ? (
                            <>
                                <h1 className="text-xl font-bold text-red-600 mb-2">Cannot Start New Order</h1>
                                <p className="text-black mb-6">
                                    You have an active order with{' '}
                                    <span className="font-semibold">{selectedUser?.firstName}</span> that hasn't been paid yet.
                                    Please cancel it first before starting a new one.
                                </p>
                            </>
                        ) : isConnectLocked ? (
                            <>
                                <h1 className="text-xl font-bold text-red-600 mb-2">Start New Order</h1>
                                <p className="text-black mb-6">
                                    Are you really sure? This will end your current session with{' '}
                                    <span className="font-semibold">{selectedUser?.firstName}</span>.
                                </p>
                            </>
                        ) : (
                            <>
                                <h1 className="text-xl font-bold text-black-100 mb-2">Start New Order</h1>
                                <p className="text-black mb-6">Are you sure you want to start a new order?</p>
                            </>
                        )}
                    </>
                )}

                {type === 'cancelOrder' && (
                    <>
                        {canCancel ? (
                            <>
                                <h1 className="text-xl font-bold text-red-900 mb-2">Cancel Order</h1>
                                <p className="text-gray-600 text-sm mb-4">Please select a reason for cancelling:</p>

                                <div className="flex flex-col gap-2 mb-4">
                                    {suggestedReasons.map((reason) => (
                                        <button
                                            key={reason}
                                            onClick={() => { setCancelReason(reason); setCustomReason(""); }}
                                            className={`text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
                                                cancelReason === reason
                                                    ? 'border-red-400 bg-red-50 text-red-700'
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
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-red-300 resize-none mb-4"
                                        rows={3}
                                    />
                                )}
                            </>
                        ) : (
                            <>
                                <h1 className="text-xl font-bold text-gray-700 mb-2">Cancel Order</h1>
                                <p className="text-black mb-6">
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
                        {(type === 'cancelOrder' && !canCancel) || (type === 'newOrder' && currentOrder && currentOrder.paymentStatus !== 'paid')
                            ? 'Close'
                            : 'No'
                        }
                    </button>
                    {!(type === 'cancelOrder' && !canCancel) &&
                        !(type === 'newOrder' && currentOrder && currentOrder.paymentStatus !== 'paid') && (
                            <button
                                onClick={handleConfirm}
                                disabled={type === 'cancelOrder' && canCancel && !canConfirmCancel}
                                className={`text-primary ${type === 'cancelOrder' && canCancel && !canConfirmCancel ? 'opacity-40 pointer-events-none' : ''}`}
                            >
                                Yes
                            </button>
                        )}
                </div>
            </div>
        </div>
    );
};