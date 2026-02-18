// runner component
import React from 'react';
import { AlertTriangle, Shield } from 'lucide-react';

export default function DisputeRaisedMessage({ message, darkMode }) {
  const { disputeDetails } = message;

  const reasonLabels = {
    item_mismatch: 'Wrong items delivered',
    item_damage: 'Items damaged',
    delivery_delay: 'Delivery delay',
    non_delivery: 'Items not delivered',
    pricing_dispute: 'Price disagreement',
    quality_issue: 'Item quality issue',
    runner_behavior: 'Unprofessional behavior',
    payment_issue: 'Payment issue',
    other: 'Other'
  };

  return (
    <div className="flex justify-center my-4 px-4">
      <div className={`max-w-md w-full rounded-2xl shadow-lg border border-red-500/20 ${
        darkMode ? 'bg-black-100' : 'bg-white'
      } p-5`}>

        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h3 className={`font-bold ${darkMode ? 'text-white' : 'text-black-200'}`}>
              Dispute Raised
            </h3>
            <p className={`text-xs ${darkMode ? 'text-gray-1002' : 'text-gray-600'}`}>
              ID: {disputeDetails?.disputeId}
            </p>
          </div>
        </div>

        <div className={`p-3 rounded-xl mb-3 ${darkMode ? 'bg-black-200' : 'bg-gray-1001'}`}>
          <p className={`text-xs font-medium mb-1 ${darkMode ? 'text-gray-1002' : 'text-gray-600'}`}>
            Reason
          </p>
          <p className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-black-200'}`}>
            {reasonLabels[disputeDetails?.reason] || disputeDetails?.reason}
          </p>
        </div>

        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/5 border border-red-500/10">
          <Shield className="w-4 h-4 text-red-500 flex-shrink-0" />
          <p className={`text-xs ${darkMode ? 'text-gray-1002' : 'text-gray-600'}`}>
            Escrow funds are locked pending admin review. Both parties will be notified of the resolution.
          </p>
        </div>
      </div>
    </div>
  );
}