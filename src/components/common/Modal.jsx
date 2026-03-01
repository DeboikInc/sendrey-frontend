export const Modal = ({ type, onClose, onConfirm, isConnectLocked, selectedUser, currentOrder, registrationComplete }) => {

    // Cancel order only visible when there's an active unpaid order
    const canCancel = currentOrder && currentOrder.paymentStatus !== 'paid';

    // Start new order always visible once registered
    const canStartNew = registrationComplete;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">

                {type === 'newOrder' && (
                    <>
                        {isConnectLocked ? (
                            <>
                                <h1 className="text-xl font-bold text-red-600 mb-2">Start New Order</h1>
                                <p className="text-black mb-6">
                                    Are you really sure? This will cancel your current order with{' '}
                                    <span className="font-bold">
                                        {selectedUser?.firstName} ({currentOrder?.serviceType})
                                    </span>.
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

                <div className="flex justify-end gap-3 text-green-400 font-medium">
                    <button onClick={onClose}>
                        {type === 'cancelOrder' && !canCancel ? 'Close' : 'No'}
                    </button>
                    {/* Hide Yes for cancel when not cancellable */}
                    {!(type === 'cancelOrder' && !canCancel) && (
                        <button onClick={onConfirm}>Yes</button>
                    )}
                </div>
            </div>
        </div>
    );
};