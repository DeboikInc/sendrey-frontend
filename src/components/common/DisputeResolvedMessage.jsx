import React from 'react';
import { CheckCircle, AlertTriangle } from 'lucide-react';

export default function DisputeResolvedMessage({ message, darkMode }) {
  const { resolutionDetails } = message;

  const outcomeLabels = {
    full_release: 'Full payment released to runner',
    full_refund: 'Full refund to user',
    partial_release: 'Partial payment to runner',
    partial_refund: 'Partial refund to user'
  };

  return (
    <div className="flex justify-center my-4 px-4">
      <div className={`max-w-md w-full rounded-2xl shadow-lg border ${
        darkMode ? 'bg-black-100 border-black-200' : 'bg-white border-gray-1001'
      } p-5`}>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <CheckCircle className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className={`font-bold ${darkMode ? 'text-white' : 'text-black-200'}`}>
              Dispute Resolved
            </h3>
            <p className={`text-xs ${darkMode ? 'text-gray-1002' : 'text-gray-600'}`}>
              Final decision - no appeals
            </p>
          </div>
        </div>

        <div className={`space-y-3 p-3 rounded-xl mb-3 ${
          darkMode ? 'bg-black-200' : 'bg-gray-1001'
        }`}>
          <div className="flex justify-between">
            <span className={`text-xs ${darkMode ? 'text-gray-1002' : 'text-gray-600'}`}>
              Outcome
            </span>
            <span className={`text-xs font-semibold ${darkMode ? 'text-white' : 'text-black-200'}`}>
              {outcomeLabels[resolutionDetails?.outcome]}
            </span>
          </div>

          {resolutionDetails?.amountToUser > 0 && (
            <div className="flex justify-between">
              <span className={`text-xs ${darkMode ? 'text-gray-1002' : 'text-gray-600'}`}>
                Refund to User
              </span>
              <span className="text-xs font-bold text-green-500">
                +₦{resolutionDetails.amountToUser?.toLocaleString()}
              </span>
            </div>
          )}

          {resolutionDetails?.amountToRunner > 0 && (
            <div className="flex justify-between">
              <span className={`text-xs ${darkMode ? 'text-gray-1002' : 'text-gray-600'}`}>
                Released to Runner
              </span>
              <span className="text-xs font-bold text-primary">
                ₦{resolutionDetails.amountToRunner?.toLocaleString()}
              </span>
            </div>
          )}

          {resolutionDetails?.adminNote && (
            <div>
              <span className={`text-xs ${darkMode ? 'text-gray-1002' : 'text-gray-600'}`}>
                Admin Note
              </span>
              <p className={`text-xs mt-1 ${darkMode ? 'text-white' : 'text-black-200'}`}>
                {resolutionDetails.adminNote}
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 p-3 rounded-xl bg-primary/5">
          <AlertTriangle className="w-4 h-4 text-primary flex-shrink-0" />
          <p className={`text-xs ${darkMode ? 'text-gray-1002' : 'text-gray-600'}`}>
            This resolution is final. Funds have been processed accordingly.
          </p>
        </div>
      </div>
    </div>
  );
}