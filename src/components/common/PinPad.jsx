import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { verifyPin, clearVerifyStatus } from '../../Redux/pinSlice';
import { X } from 'lucide-react';

/**
 * PinPad — reusable 4-digit PIN entry component
 *
 * Props:
 *   dark          — boolean
 *   title         — string (e.g. "Confirm Withdrawal")
 *   subtitle      — string (e.g. "Enter your PIN to continue")
 *   onVerified    — () => void  — called when PIN is correct
 *   onCancel      — () => void  — called when user dismisses
 *   skipVerify    — boolean — if true, just collects PIN and calls onPin(pin) instead
 *                   (used for setPin / resetPin flows where we don't call verify)
 *   onPin         — (pin: string) => void — used when skipVerify is true
 */
export const PinPad = ({
  dark,
  title = 'Enter PIN',
  subtitle = 'Enter your 4-digit PIN to continue',
  onVerified,
  onCancel,
  skipVerify = false,
  onPin,
}) => {
  const dispatch = useDispatch();
  const { verifyStatus, error } = useSelector(state => state.pin);

  const [digits, setDigits] = useState(['', '', '', '']);
  const [shake, setShake] = useState(false);
  const [localError, setLocalError] = useState(null);
  const inputRefs = [useRef(), useRef(), useRef(), useRef()];

  // Focus first input on mount
  useEffect(() => {
    setTimeout(() => inputRefs[0].current?.focus(), 100);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Watch verify result
  useEffect(() => {
    if (verifyStatus === 'success') {
      dispatch(clearVerifyStatus());
      onVerified?.();
    } else if (verifyStatus === 'failed') {
      triggerShake();
      setLocalError(error || 'Incorrect PIN');
      setDigits(['', '', '', '']);
      setTimeout(() => inputRefs[0].current?.focus(), 50);
      dispatch(clearVerifyStatus());

    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verifyStatus]);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const handleDigit = (index, value) => {
    if (!/^\d?$/.test(value)) return;
    setLocalError(null);

    const next = [...digits];
    next[index] = value;
    setDigits(next);

    if (value && index < 3) {
      inputRefs[index + 1].current?.focus();
    }

    // Auto-submit when all 4 filled
    if (value && index === 3) {
      const pin = [...next.slice(0, 3), value].join('');
      if (pin.length === 4) submit(pin);
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  const submit = (pin) => {
    if (skipVerify) {
      onPin?.(pin);
      return;
    }
    dispatch(verifyPin({ pin }));
  };

  const handlePaste = (e) => {
    const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (paste.length === 4) {
      setDigits(paste.split(''));
      submit(paste);
    }
  };

  const isLoading = verifyStatus === 'loading';
  const filled = digits.filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm px-4 pb-6">
      <div
        className={`w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl transition-transform
          ${dark ? 'bg-black-200' : 'bg-white'}
          ${shake ? 'animate-[shake_0.4s_ease]' : ''}`}
        style={shake ? { animation: 'shake 0.4s ease' } : {}}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-5 pt-5 pb-3`}>
          <div>
            <p className={`font-bold text-base ${dark ? 'text-white' : 'text-black-200'}`}>{title}</p>
            <p className={`text-xs mt-0.5 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>{subtitle}</p>
          </div>
          <button
            onClick={onCancel}
            className={`p-2 rounded-full ${dark ? 'hover:bg-black-100' : 'hover:bg-gray-100'}`}
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Dots indicator */}
        <div className="flex justify-center gap-3 py-4">
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full transition-all duration-150
                ${digits[i]
                  ? 'bg-primary scale-110'
                  : dark ? 'bg-black-100 border border-white/10' : 'bg-gray-200'
                }`}
            />
          ))}
        </div>

        {/* Hidden inputs for keyboard on mobile */}
        <div className="flex justify-center gap-3 px-8 pb-2">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={inputRefs[i]}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={e => handleDigit(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              onPaste={handlePaste}
              disabled={isLoading}
              className={`w-12 h-14 text-center text-xl font-bold rounded-2xl border-2 outline-none transition-all
                ${d ? 'border-primary' : dark ? 'border-white/10' : 'border-gray-200'}
                ${dark ? 'bg-black-100 text-white' : 'bg-gray-50 text-black-200'}
                ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
                focus:border-primary`}
            />
          ))}
        </div>

        {/* Error */}
        <div className="h-8 flex items-center justify-center px-5">
          {localError && (
            <p className="text-xs text-red-500 text-center">{localError}</p>
          )}
          {isLoading && (
            <p className={`text-xs ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Verifying...</p>
          )}
        </div>

        {/* Progress bar */}
        <div className={`h-0.5 mx-5 rounded-full mb-1 ${dark ? 'bg-black-100' : 'bg-gray-100'}`}>
          <div
            className="h-full bg-primary rounded-full transition-all duration-200"
            style={{ width: `${(filled / 4) * 100}%` }}
          />
        </div>

        {/* Forgot PIN link */}
        {!skipVerify && (
          <div className="flex justify-center pb-5 pt-3">
            <button
              onClick={() => { onCancel?.(); }}
              className="text-xs text-primary underline underline-offset-2"
            >
              Forgot PIN?
            </button>
          </div>
        )}
      </div>

      {/* Shake keyframe injected inline */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
};