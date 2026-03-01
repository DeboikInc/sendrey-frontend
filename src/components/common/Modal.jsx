export const Modal = ({ type, onClose, onConfirm, isConnectLocked, selectedUser, currentOrder, registrationComplete }) => {

    // Cancel order only visible when there's an active unpaid order
    const canCancel = currentOrder && currentOrder.paymentStatus !== 'paid';

    // Start new order always visible once registered
    const canStartNew = registrationComplete; // eslint-disable-line no-unused-vars

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">

                {type === 'newOrder' && (
                    <>
                        {currentOrder && currentOrder.paymentStatus !== 'paid' ? (
                            // Active unpaid order exists — block new order
                            <>
                                <h1 className="text-xl font-bold text-red-600 mb-2">Cannot Start New Order</h1>
                                <p className="text-black mb-6">
                                    You have an active order with{' '}
                                    <span className="font-semibold">{selectedUser?.firstName}</span> that hasn't been paid yet.
                                    Please cancel it first before starting a new one.
                                </p>
                            </>
                        ) : isConnectLocked ? (
                            // Connected but no unpaid order (edge case)
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
                                <p className="text-black mb-6">Are you sure you want to cancel this order?</p>
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
                    {/* Hide Yes when blocking new order due to active unpaid order */}
                    {!(type === 'cancelOrder' && !canCancel) &&
                        !(type === 'newOrder' && currentOrder && currentOrder.paymentStatus !== 'paid') && (
                            <button onClick={onConfirm} className="text-primary">Yes</button>
                        )}
                </div>
            </div>
        </div>
    );
};