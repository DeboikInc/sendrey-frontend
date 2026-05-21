import React from 'react';
import { AlertTriangle, Shield } from 'lucide-react';
import { getReasonLabel } from '../../utils/disputeReasons';

export default function DisputeRaisedMessage({ message, darkMode }) {
  const { disputeDetails } = message;

  const textPrimary = darkMode ? 'text-white' : 'text-black-200';
  const textMuted = darkMode ? 'text-gray-1002' : 'text-gray-600';
  const cardBg = darkMode ? 'bg-black-200' : 'bg-gray-1001';

  return (
    <div className="flex justify-center my-4 px-4">
      <div
        className={`max-w-md w-full rounded-2xl shadow-lg border border-red-500/20 p-5 ${
          darkMode ? 'bg-black-100' : 'bg-white'
        }`}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h3 className={`font-bold ${textPrimary}`}>Dispute Raised</h3>
            <p className={`text-xs ${textMuted}`}>ID: {disputeDetails?.disputeId}</p>
          </div>
        </div>

        {/* Reason */}
        <div className={`p-3 rounded-xl mb-3 ${cardBg}`}>
          <p className={`text-xs font-medium mb-1 ${textMuted}`}>Reason</p>
          <p className={`text-sm font-semibold ${textPrimary}`}>
            {getReasonLabel(disputeDetails?.reason)}
          </p>
        </div>

        {/* Escrow notice */}
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/5 border border-red-500/10">
          <Shield className="w-4 h-4 text-red-500 flex-shrink-0" />
          <p className={`text-xs ${textMuted}`}>
            Escrow funds are locked pending admin review. Both parties will be notified of the resolution.
          </p>
        </div>
      </div>
    </div>
  );
}