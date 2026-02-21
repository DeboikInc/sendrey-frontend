import React, { useEffect, useState } from 'react';
import { 
  X, Shield, MapPin, Package, 
  Truck, Clock, CheckCircle, 
  ChevronRight, Copy
} from 'lucide-react';
import EscrowStatusBadge from './EscrowStatusBadge';

const ORDER_STATUS_LABELS = {
  pending:          { label: 'Pending',            color: 'text-gray-500' },
  payment_pending:  { label: 'Payment Pending',     color: 'text-yellow-500' },
  paid:             { label: 'Paid',                color: 'text-blue-500' },
  in_progress:      { label: 'In Progress',         color: 'text-primary' },
  items_submitted:  { label: 'Items Submitted',     color: 'text-orange-500' },
  items_approved:   { label: 'Items Approved',      color: 'text-teal-500' },
  delivered:        { label: 'Delivered',           color: 'text-purple-500' },
  completed:        { label: 'Completed',           color: 'text-green-500' },
  disputed:         { label: 'Disputed',            color: 'text-red-500' },
  dispute_resolved: { label: 'Dispute Resolved',    color: 'text-green-500' },
  archived:         { label: 'Archived',            color: 'text-gray-400' },
  cancelled:        { label: 'Cancelled',           color: 'text-red-500' },
};

const STATE_TIMELINE = [
  { status: 'payment_pending', label: 'Order Created' },
  { status: 'paid',            label: 'Payment Received' },
  { status: 'in_progress',     label: 'Runner Accepted' },
  { status: 'delivered',       label: 'Delivered' },
  { status: 'completed',       label: 'Completed' },
];

export default function OrderDetailsSheet({
  isOpen,
  onClose,
  darkMode,
  order,        // { orderId, status, escrowStatus, itemBudget, deliveryFee, platformFee, totalAmount, taskType, statusHistory }
  escrow,       // { status, totalAmount } - optional
}) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !order) return null;

  const statusInfo = ORDER_STATUS_LABELS[order.status] || ORDER_STATUS_LABELS['pending'];

  const handleCopyOrderId = () => {
    navigator.clipboard.writeText(order.orderId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Get current step in timeline
  const currentStepIndex = STATE_TIMELINE.findIndex(s => s.status === order.status);
  const timelineStep = currentStepIndex === -1 ? 1 : currentStepIndex;

  // Payment breakdown
  const itemBudget = order.itemBudget || 0;
  const deliveryFee = order.deliveryFee || 0;
  const platformFee = order.platformFee || 0;
  const total = order.totalAmount || (itemBudget + deliveryFee);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
      <div className={`w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl ${
        darkMode ? 'bg-black-100' : 'bg-white'
      }`}>

        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className={`w-10 h-1 rounded-full ${darkMode ? 'bg-black-200' : 'bg-gray-1001'}`} />
        </div>

        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${
          darkMode ? 'border-black-200' : 'border-gray-1001'
        }`}>
          <div>
            <h2 className={`font-bold text-lg ${darkMode ? 'text-white' : 'text-black-200'}`}>
              Order Details
            </h2>
            <button
              onClick={handleCopyOrderId}
              className="flex items-center gap-1 mt-0.5"
            >
              <span className={`text-xs ${darkMode ? 'text-gray-1002' : 'text-gray-600'}`}>
                #{order.orderId}
              </span>
              <Copy className={`w-3 h-3 ${darkMode ? 'text-gray-1002' : 'text-gray-400'}`} />
              {copied && <span className="text-xs text-primary">Copied!</span>}
            </button>
          </div>
          <button onClick={onClose}>
            <X className={`w-5 h-5 ${darkMode ? 'text-gray-1002' : 'text-gray-600'}`} />
          </button>
        </div>

        <div className="px-6 py-4 space-y-5">

          {/* Order Status */}
          <div className={`p-4 rounded-2xl ${darkMode ? 'bg-black-200' : 'bg-gray-1001'}`}>
            <div className="flex items-center justify-between mb-3">
              <p className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-black-200'}`}>
                Order Status
              </p>
              <span className={`text-sm font-bold ${statusInfo.color}`}>
                {statusInfo.label}
              </span>
            </div>

            {/* Timeline */}
            <div className="flex items-center gap-0">
              {STATE_TIMELINE.map((step, index) => {
                const isCompleted = index <= timelineStep;
                const isCurrent = index === timelineStep;
                const isLast = index === STATE_TIMELINE.length - 1;

                return (
                  <React.Fragment key={step.status}>
                    <div className="flex flex-col items-center">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                        isCompleted
                          ? 'bg-primary'
                          : darkMode ? 'bg-black-100' : 'bg-gray-300'
                      } ${isCurrent ? 'ring-2 ring-primary ring-offset-2' : ''}`}>
                        {isCompleted
                          ? <CheckCircle className="w-4 h-4 text-white" />
                          : <div className={`w-2 h-2 rounded-full ${
                              darkMode ? 'bg-gray-1002' : 'bg-gray-400'
                            }`} />
                        }
                      </div>
                      <p className={`text-xs mt-1 text-center w-14 leading-tight ${
                        isCurrent
                          ? 'text-primary font-medium'
                          : isCompleted
                            ? darkMode ? 'text-gray-1002' : 'text-gray-600'
                            : darkMode ? 'text-gray-1002' : 'text-gray-400'
                      }`}>
                        {step.label}
                      </p>
                    </div>
                    {!isLast && (
                      <div className={`flex-1 h-0.5 mb-5 ${
                        index < timelineStep ? 'bg-primary' : darkMode ? 'bg-black-100' : 'bg-gray-300'
                      }`} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* Escrow Status */}
          {escrow && (
            <div>
              <p className={`text-sm font-semibold mb-2 ${darkMode ? 'text-white' : 'text-black-200'}`}>
                Escrow Status
              </p>
              <EscrowStatusBadge
                status={escrow.status || order.escrowStatus}
                darkMode={darkMode}
                showDescription={true}
              />
            </div>
          )}

          {/* Payment Breakdown */}
          <div>
            <p className={`text-sm font-semibold mb-3 ${darkMode ? 'text-white' : 'text-black-200'}`}>
              Payment Breakdown
            </p>
            <div className={`rounded-2xl overflow-hidden border ${
              darkMode ? 'border-black-200' : 'border-gray-1001'
            }`}>

              {order.taskType === 'shopping' && itemBudget > 0 && (
                <div className={`flex justify-between items-center px-4 py-3 border-b ${
                  darkMode ? 'border-black-200 bg-black-200' : 'border-gray-1001 bg-gray-1001'
                }`}>
                  <div className="flex items-center gap-2">
                    <Package className={`w-4 h-4 ${darkMode ? 'text-gray-1002' : 'text-gray-600'}`} />
                    <span className={`text-sm ${darkMode ? 'text-gray-1002' : 'text-gray-600'}`}>
                      Item Budget
                    </span>
                  </div>
                  <span className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-black-200'}`}>
                    ₦{itemBudget.toLocaleString()}
                  </span>
                </div>
              )}

              <div className={`flex justify-between items-center px-4 py-3 border-b ${
                darkMode ? 'border-black-200 bg-black-200' : 'border-gray-1001 bg-gray-1001'
              }`}>
                <div className="flex items-center gap-2">
                  <Truck className={`w-4 h-4 ${darkMode ? 'text-gray-1002' : 'text-gray-600'}`} />
                  <span className={`text-sm ${darkMode ? 'text-gray-1002' : 'text-gray-600'}`}>
                    Delivery Fee
                  </span>
                </div>
                <span className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-black-200'}`}>
                  ₦{deliveryFee.toLocaleString()}
                </span>
              </div>

              {platformFee > 0 && (
                <div className={`flex justify-between items-center px-4 py-3 border-b ${
                  darkMode ? 'border-black-200 bg-black-200' : 'border-gray-1001 bg-gray-1001'
                }`}>
                  <div className="flex items-center gap-2">
                    <Shield className={`w-4 h-4 ${darkMode ? 'text-gray-1002' : 'text-gray-600'}`} />
                    <span className={`text-sm ${darkMode ? 'text-gray-1002' : 'text-gray-600'}`}>
                      Platform Fee
                    </span>
                  </div>
                  <span className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-black-200'}`}>
                    ₦{platformFee.toLocaleString()}
                  </span>
                </div>
              )}

              <div className={`flex justify-between items-center px-4 py-3 ${
                darkMode ? 'bg-black-100' : 'bg-white'
              }`}>
                <span className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-black-200'}`}>
                  Total
                </span>
                <span className="text-sm font-bold text-primary">
                  ₦{total.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Task Type */}
          <div className={`flex items-center justify-between p-4 rounded-2xl ${
            darkMode ? 'bg-black-200' : 'bg-gray-1001'
          }`}>
            <span className={`text-sm ${darkMode ? 'text-gray-1002' : 'text-gray-600'}`}>
              Task Type
            </span>
            <span className={`text-sm font-semibold capitalize ${
              darkMode ? 'text-white' : 'text-black-200'
            }`}>
              {order.taskType === 'shopping' ? '🛍 Shopping' : '📦 Pickup & Delivery'}
            </span>
          </div>

          {/* Status History (collapsible) */}
          {order.statusHistory?.length > 0 && (
            <div>
              <p className={`text-sm font-semibold mb-3 ${darkMode ? 'text-white' : 'text-black-200'}`}>
                Activity Log
              </p>
              <div className="space-y-2">
                {[...order.statusHistory].reverse().map((entry, i) => (
                  <div key={i} className={`flex items-start gap-3 p-3 rounded-xl ${
                    darkMode ? 'bg-black-200' : 'bg-gray-1001'
                  }`}>
                    <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className={`text-xs font-medium capitalize ${
                        darkMode ? 'text-white' : 'text-black-200'
                      }`}>
                        {ORDER_STATUS_LABELS[entry.status]?.label || entry.status}
                      </p>
                      {entry.note && (
                        <p className={`text-xs ${darkMode ? 'text-gray-1002' : 'text-gray-600'}`}>
                          {entry.note}
                        </p>
                      )}
                    </div>
                    <p className={`text-xs flex-shrink-0 ${darkMode ? 'text-gray-1002' : 'text-gray-400'}`}>
                      {new Date(entry.timestamp).toLocaleDateString('en-NG', {
                        day: 'numeric', month: 'short',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="h-2" />
        </div>
      </div>
    </div>
  );
}