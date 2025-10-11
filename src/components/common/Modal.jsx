
export const Modal = ({ type, onClose }) => {
    return (
        <>
            <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
                <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
                    {type === 'newOrder' && (
                        <>
                            <h1 className="text-xl font-bold text-black-100 mb-2">Start New Order</h1>
                            <p className="text-black mb-6">Are you sure you want to start a new order?</p>
                        </>
                    )}

                    {type === 'cancelOrder' && (
                        <>
                            <h1 className="text-xl font-bold text-red-900 mb-2">Cancel Order</h1>
                            <p className="text-black mb-6">Are you sure you want to cancel this order?</p>
                        </>
                    )}

                    <div className="flex justify-end gap-3 text-green-400 font-medium">
                        <button onClick={onClose}>
                            No
                        </button>
                        <button onClick={onClose}>
                            Yes
                        </button>
                    </div>
                </div>
            </div>
        </>
    )
}