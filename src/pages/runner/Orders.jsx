import { useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { ChevronLeft } from 'lucide-react';
import { fetchRunnerOrders, resetRunnerOrders } from '../../Redux/orderSlice';

const STATUS_STYLES = {
    pending_payment:      { label: 'Pending Payment',   color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
    payment_failed:       { label: 'Payment Failed',    color: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' },
    paid:                 { label: 'Paid',              color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    accepted:             { label: 'Accepted',          color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    shopping:             { label: 'Shopping',          color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
    items_submitted:      { label: 'Items Submitted',   color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
    items_approved:       { label: 'Items Approved',    color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' },
    en_route_to_pickup:   { label: 'En Route',          color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    arrived_at_pickup:    { label: 'Arrived',           color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    picked_up:            { label: 'Picked Up',         color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    en_route_to_delivery: { label: 'Delivering',        color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' },
    arrived_at_delivery:  { label: 'Arrived',           color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' },
    delivered:            { label: 'Delivered',         color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
    completed:            { label: 'Completed',         color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
    cancelled:            { label: 'Cancelled',         color: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' },
    disputed:             { label: 'Disputed',          color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
};

const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-NG', {
        day: 'numeric', month: 'short', year: 'numeric'
    });
};

const formatAmount = (amount) => {
    if (!amount && amount !== 0) return '—';
    return `₦${Number(amount).toLocaleString()}`;
};

const shortOrderId = (orderId) => {
    if (!orderId) return '—';
    return orderId.split('-').slice(-2).join('-');
};

export const Orders = ({ darkMode, onBack, runnerId, registrationComplete }) => {
    const dispatch = useDispatch();
    const { runnerOrders, ordersLoading, ordersError, ordersHasMore, ordersPage } = useSelector(state => state.order);

    // Initial load
    useEffect(() => {
        if (!registrationComplete || !runnerId) return;
        dispatch(resetRunnerOrders());
        dispatch(fetchRunnerOrders({ runnerId, page: 1 }));
    }, [runnerId, registrationComplete, dispatch]);

    const handleLoadMore = useCallback(() => {
        if (ordersLoading || !ordersHasMore) return;
        dispatch(fetchRunnerOrders({ runnerId, page: ordersPage + 1 }));
    }, [ordersLoading, ordersHasMore, ordersPage, runnerId, dispatch]);

    const renderContent = () => {
        // Not registered
        if (!registrationComplete) {
            return (
                <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20">
                    <p className="text-2xl mb-2">🔒</p>
                    <p className="text-gray-500 dark:text-gray-400 font-medium">
                        Nothing to see here yet
                    </p>
                    <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                        Complete your registration first
                    </p>
                </div>
            );
        }

        // Loading initial
        if (ordersLoading && runnerOrders.length === 0) {
            return (
                <div className="flex-1 flex items-center justify-center py-20">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
            );
        }

        // Error
        if (ordersError && runnerOrders.length === 0) {
            return (
                <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20">
                    {/* <p className="text-gray-500 dark:text-gray-400">{ordersError}</p> */}
                    <p className="text-gray-500 dark:text-gray-400">something went wrong, come back later</p>
                </div>
            );
        }

        // No orders
        if (runnerOrders.length === 0) {
            return (
                <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20">
                    <p className="text-2xl mb-2">📦</p>
                    <p className="text-gray-500 dark:text-gray-400 font-medium">
                        No orders yet
                    </p>
                    <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                        Pick a service to get started
                    </p>
                </div>
            );
        }

        // Orders list
        return (
            <div className="flex-1 overflow-y-auto">
                <div className="divide-y dark:divide-white/5 divide-gray-100">
                    {runnerOrders.map((order) => {
                        const statusInfo = STATUS_STYLES[order.status] || {
                            label: order.status,
                            color: 'bg-gray-100 text-gray-600'
                        };

                        return (
                            <div
                                key={order.orderId}
                                className="px-4 py-4 flex items-center justify-between gap-3"
                            >
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs font-mono text-gray-400 dark:text-gray-500">
                                            #{shortOrderId(order.orderId)}
                                        </span>
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusInfo.color}`}>
                                            {statusInfo.label}
                                        </span>
                                    </div>
                                    <p className="text-sm font-medium text-black-200 dark:text-gray-200 capitalize">
                                        {order.serviceType === 'run-errand' ? 'Run Errand' : 'Pick Up'}
                                    </p>
                                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                                        {formatDate(order.createdAt)}
                                    </p>
                                </div>

                                <div className="text-right flex-shrink-0">
                                    <p className="text-sm font-semibold text-black-200 dark:text-white">
                                        {formatAmount(order.totalAmount)}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Load more */}
                {ordersHasMore && (
                    <div className="flex justify-center py-4">
                        <button
                            onClick={handleLoadMore}
                            disabled={ordersLoading}
                            className="text-sm text-primary font-medium disabled:opacity-50"
                        >
                            {ordersLoading ? 'Loading...' : 'Load more'}
                        </button>
                    </div>
                )}

                {!ordersHasMore && runnerOrders.length > 0 && (
                    <p className="text-center text-xs text-gray-400 dark:text-gray-600 py-4">
                        All orders loaded
                    </p>
                )}
            </div>
        );
    };

    return (
        <div className={`min-h-screen flex flex-col bg-white dark:bg-black-100 ${darkMode ? 'dark' : ''}`}>
            <div className="flex items-center border-b border-gray-100 dark:border-white/10 p-3">
                <div onClick={onBack} className="cursor-pointer text-black-200 dark:text-gray-300">
                    <ChevronLeft />
                </div>
                <h1 className="text-lg font-bold mx-auto text-black-200 dark:text-gray-300">Orders</h1>
            </div>

            {renderContent()}
        </div>
    );
};