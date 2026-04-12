import React, { useState } from 'react';
import { FileText, ExternalLink, CheckCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function TermsAcceptanceModal({
  isOpen,
  onClose,
  onAccept,
  terms,
  darkMode,
  userType = 'user'
}) {
  const [isChecked, setIsChecked] = useState(false);
  const [showFullTerms, setShowFullTerms] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);

  const handleAccept = async () => {
    if (!isChecked || isAccepting) return;
    setIsAccepting(true);
    await onAccept();
    setIsAccepting(false);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className={`w-full max-w-lg max-h-[90vh] overflow-hidden rounded-2xl shadow-2xl ${
            darkMode ? 'bg-black-100' : 'bg-white'
          }`}
        >
          {/* Header */}
          <div className={`flex items-center justify-between px-6 py-4 border-b ${
            darkMode ? 'border-black-200' : 'border-gray-1001'
          }`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className={`font-bold ${darkMode ? 'text-white' : 'text-black-200'}`}>
                  {terms.title}
                </h2>
                <p className={`text-xs ${darkMode ? 'text-gray-1002' : 'text-gray-600'}`}>
                  Version {terms.version} • {terms.effectiveDate}
                </p>
              </div>
            </div>

          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-[60vh] px-6 py-4">
            {/* Summary */}
            <div className={`mb-6 p-4 rounded-xl border ${
              darkMode ? 'bg-black-100 shadow-lg border-0' : 'bg-primary/5 border-primary/20'
            }`}>
              <h3 className={`text-lg font-semibold mb-2 ${darkMode ? 'text-white' : 'text-black-200'}`}>
                📋 Key Terms and Condition
              </h3>
              <ul className="space-y-2">
                {terms.summary.map((point, i) => (
                  <li key={i} className={`text-[14px] flex gap-2 ${
                    darkMode ? 'text-gray-100' : 'text-gray-600'
                  }`}>
                    <span className="text-primary mt-0.5">•</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* View Full Terms Link */}
            <button
              onClick={() => setShowFullTerms(!showFullTerms)}
              className="flex items-center gap-2 text-sm text-primary hover:underline mb-4"
            >
              <ExternalLink className="w-4 h-4" />
              {showFullTerms ? 'Hide' : 'View'} full terms & conditions
            </button>

            {/* Full Terms (Collapsible) */}
            <AnimatePresence>
              {showFullTerms && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className={`p-4 rounded-xl mb-4 space-y-4 ${
                    darkMode ? 'bg-black-200' : 'bg-black-100'
                  }`}>
                    {terms.sections.map((section, i) => (
                      <div key={i}>
                        <h4 className={`text-sm font-semibold mb-1 ${
                          darkMode ? 'text-white' : 'text-black-200'
                        }`}>
                          {section.title}
                        </h4>
                        <p className={`text-xs whitespace-pre-line ${
                          darkMode ? 'text-gray-1002' : 'text-gray-600'
                        }`}>
                          {section.content}
                        </p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Agreement Checkbox */}
            <div className={`p-4 rounded-xl border mb-4 ${
              darkMode
                ? 'bg-black-200 border-black-200'
                : 'bg-gray-1001 border-gray-1001'
            }`}>
              <label className="flex items-start gap-3 cursor-pointer">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => !isAccepting && setIsChecked(e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                    isChecked
                      ? 'bg-primary border-primary'
                      : darkMode
                        ? 'border-gray-1002'
                        : 'border-gray-400'
                  }`}>
                    {isChecked && <CheckCircle className="w-3 h-3 text-white" />}
                  </div>
                </div>
                <div>
                  <p className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-black-200'}`}>
                    I have read and agree to the {terms.title}
                  </p>
                  <p className={`text-xs mt-1 ${darkMode ? 'text-gray-1002' : 'text-gray-600'}`}>
                    By checking this box, you acknowledge that you understand and accept all terms outlined above.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Footer Actions */}
          <div className={`flex gap-3 px-6 py-4 border-t ${
            darkMode ? 'border-black-200' : 'border-gray-1001'
          }`}>

            <button
              onClick={handleAccept}
              disabled={!isChecked || isAccepting}
              className={`flex-1 py-3 rounded-xl font-semibold text-white transition-all ${
                isChecked && !isAccepting
                  ? 'bg-primary hover:opacity-90'
                  : 'bg-gray-400 cursor-not-allowed'
              }`}
            >
              {isAccepting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Accepting...
                </span>
              ) : 'Accept & Continue'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}