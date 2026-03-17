import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { verifyPin, clearVerifyStatus, sendForgotPinOtp, verifyForgotPinOtp, forgotPin, clearOtpStatus } from '../../Redux/pinSlice';
import { X } from 'lucide-react';

export const PinPad = ({
  dark,
  title = 'Enter PIN',
  subtitle = 'Enter your 4-digit PIN to continue',
  onVerified,
  onCancel,
  skipVerify = false,
  onPin,
  confirmMode = false, // ← NEW: shows confirm step after first PIN entry
  forgotMode = false
}) => {
  const dispatch = useDispatch();
  const { verifyStatus, error, otpStatus, otpVerified } = useSelector(state => state.pin);

  const [step, setStep] = useState(forgotMode ? 'forgot_otp' : 'pin');
  const [digits, setDigits] = useState(['', '', '', '']);
  const [firstPin, setFirstPin] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [shake, setShake] = useState(false);
  const [localError, setLocalError] = useState(null);
  const [otpSent, setOtpSent] = useState(false); // eslint-disable-line no-unused-vars

  const inputRefs = [useRef(), useRef(), useRef(), useRef()];
  const otpRefs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()];
  const submittedPinRef = useRef(null);

  useEffect(() => {
    setTimeout(() => inputRefs[0].current?.focus(), 100);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  useEffect(() => {
    if (verifyStatus === 'success') {
      dispatch(clearVerifyStatus());
      onVerified?.(submittedPinRef.current);
    } else if (verifyStatus === 'failed') {
      triggerShake();
      setLocalError(error || 'Incorrect PIN');
      setDigits(['', '', '', '']);
      setTimeout(() => inputRefs[0].current?.focus(), 50);
      dispatch(clearVerifyStatus());
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verifyStatus]);

  useEffect(() => {
    if (step === 'forgot_otp' && otpVerified) {
      setStep('forgot_newpin');
      setDigits(['', '', '', '']);
      setLocalError(null);
      dispatch(clearOtpStatus());
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otpVerified, step]);

  useEffect(() => {
    if (forgotMode) {
      handleForgotPin();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    if (value && index < 3) inputRefs[index + 1].current?.focus();
    if (value && index === 3) {
      const pin = [...next.slice(0, 3), value].join('');
      if (pin.length === 4) submit(pin);
    }
  };

  const handleOtpDigit = (index, value) => {
    if (!/^\d?$/.test(value)) return;
    setLocalError(null);
    const next = [...otpDigits];
    next[index] = value;
    setOtpDigits(next);
    if (value && index < 5) otpRefs[index + 1].current?.focus();
    if (value && index === 5) {
      const otp = [...next.slice(0, 5), value].join('');
      if (otp.length === 6) submitOtp(otp);
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) inputRefs[index - 1].current?.focus();
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) otpRefs[index - 1].current?.focus();
  };

  const submit = (pin) => {
    if (confirmMode && step === 'pin') {
      setFirstPin(pin);
      setStep('confirm');
      setDigits(['', '', '', '']);
      return;
    }

    if (step === 'confirm') {
      if (pin !== firstPin) {
        triggerShake();
        setLocalError('PINs do not match');
        setDigits(['', '', '', '']);
        return;
      }
      onPin?.(pin);
      return;
    }

    if (skipVerify) { onPin?.(pin); return; }

    if (step === 'forgot_newpin') {
      setFirstPin(pin);
      setStep('forgot_confirm');
      setDigits(['', '', '', '']);
      return;
    }

    if (step === 'forgot_confirm') {
      if (pin !== firstPin) {
        triggerShake();
        setLocalError('PINs do not match');
        setDigits(['', '', '', '']);
        return;
      }
      // Submit forgot pin
      dispatch(forgotPin({ newPin: pin, confirmPin: pin })).unwrap()
        .then(() => { onVerified?.(); })
        .catch(err => { setLocalError(err || 'Failed to reset PIN'); });
      return;
    }

    submittedPinRef.current = pin;
    dispatch(verifyPin({ pin }));
  };

  const submitOtp = (otp) => {
    dispatch(verifyForgotPinOtp({ otp })).unwrap()
      .catch(err => {
        triggerShake();
        setLocalError(err || 'Invalid OTP');
        setOtpDigits(['', '', '', '', '', '']);
        setTimeout(() => otpRefs[0].current?.focus(), 50);
      });
  };

  const handleForgotPin = async () => {
    try {
      await dispatch(sendForgotPinOtp()).unwrap();
      setOtpSent(true);
      setStep('forgot_otp');
      setLocalError(null);
    } catch (err) {
      setLocalError(err || 'Failed to send OTP');
    }
  };

  const isLoading = verifyStatus === 'loading' || otpStatus === 'loading';
  const filled = digits.filter(Boolean).length;

  const titles = {
    pin: title,
    confirm: 'Confirm PIN',
    forgot_otp: 'Verify Identity',
    forgot_newpin: 'New PIN',
    forgot_confirm: 'Confirm New PIN',
  };

  const subtitles = {
    pin: subtitle,
    confirm: 'Re-enter your PIN to confirm',
    forgot_otp: 'Enter the 6-digit OTP sent to your phone',
    forgot_newpin: 'Enter your new 4-digit PIN',
    forgot_confirm: 'Re-enter your new PIN to confirm',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm px-4 pb-6">
      <div
        className={`w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl
          ${dark ? 'bg-black-200' : 'bg-white'}
          ${shake ? 'animate-[shake_0.4s_ease]' : ''}`}
        style={shake ? { animation: 'shake 0.4s ease' } : {}}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div>
            <p className={`font-bold text-base ${dark ? 'text-white' : 'text-black-200'}`}>{titles[step]}</p>
            <p className={`text-xs mt-0.5 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>{subtitles[step]}</p>
          </div>
          <button onClick={onCancel} className={`p-2 rounded-full ${dark ? 'hover:bg-black-100' : 'hover:bg-gray-100'}`}>
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* OTP step */}
        {step === 'forgot_otp' ? (
          <>
            <div className="flex justify-center gap-2 px-6 py-4">
              {otpDigits.map((d, i) => (
                <input
                  key={i}
                  ref={otpRefs[i]}
                  type="password"
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  onChange={e => handleOtpDigit(i, e.target.value)}
                  onKeyDown={e => handleOtpKeyDown(i, e)}
                  disabled={isLoading || otpDigits.filter(Boolean).length === 6}
                  className={`w-10 h-12 text-center text-lg font-bold rounded-xl border-2 outline-none transition-all
                    ${d ? 'border-primary' : dark ? 'border-white/10' : 'border-gray-200'}
                    ${dark ? 'bg-black-100 text-white' : 'bg-gray-50 text-black-200'}
                    focus:border-primary`}
                />
              ))}
            </div>
            <div className="flex justify-center pb-2">
              <button onClick={handleForgotPin} className="text-xs text-primary underline">
                Resend OTP
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Dots */}
            <div className="flex justify-center gap-3 py-4">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className={`w-3 h-3 rounded-full transition-all duration-150
                  ${digits[i] ? 'bg-primary scale-110' : dark ? 'bg-black-100 border border-white/10' : 'bg-gray-200'}`} />
              ))}
            </div>
            {/* PIN inputs */}
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
                  disabled={isLoading || filled === 4}
                  className={`w-12 h-14 text-center text-xl font-bold rounded-2xl border-2 outline-none transition-all
                    ${d ? 'border-primary' : dark ? 'border-white/10' : 'border-gray-200'}
                    ${dark ? 'bg-black-100 text-white' : 'bg-gray-50 text-black-200'}
                    ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
                    focus:border-primary`}
                />
              ))}
            </div>
          </>
        )}

        {/* Error / loading */}
        <div className="h-8 flex items-center justify-center px-5">
          {localError && <p className="text-xs text-red-500 text-center">{localError}</p>}
          {isLoading && <p className={`text-xs ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
            {step === 'forgot_otp' ? 'Verifying OTP...' : 'Verifying...'}
          </p>}
        </div>

        {/* Progress bar */}
        <div className={`h-0.5 mx-5 rounded-full mb-1 ${dark ? 'bg-black-100' : 'bg-gray-100'}`}>
          <div className="h-full bg-primary rounded-full transition-all duration-200"
            style={{ width: `${(filled / 4) * 100}%` }} />
        </div>

        {/* Forgot PIN — only on initial pin step */}
        {step === 'pin' && !skipVerify && !confirmMode && (
          <div className="flex justify-center pb-5 pt-3">
            <button onClick={handleForgotPin} disabled={isLoading || filled === 4}
              className="text-xs text-primary underline underline-offset-2">
              Forgot PIN?
            </button>
          </div>
        )}

        {step !== 'pin' && (
          <div className="flex justify-center pb-5 pt-3">
            <button onClick={() => { setStep('pin'); setDigits(['', '', '', '']); setLocalError(null); }}
              className={`text-xs ${dark ? 'text-gray-400' : 'text-gray-500'} underline underline-offset-2`}>
              Back
            </button>
          </div>
        )}
      </div>

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