import React, { useEffect, useRef, useState } from "react";
import Message from "../common/Message";
import Onboarding from "../common/Onboarding";
import CustomInput from "../common/CustomInput";
import { Button } from "@material-tailwind/react";

import TermsAcceptanceModal from '../common/TermsAcceptanceModal';
import { USER_TERMS } from '../../constants/terms';
import api from '../../utils/api';

const QUESTIONS = [
  { question: "What's your name?", field: "name" },
  { question: "What's your phone number?", field: "phone" },
  { question: "What's your email address?", field: "email" },
];

export default function OnboardingScreen({
  onComplete, darkMode, toggleDarkMode, errors, onErrorClose,
  needsOtpVerification, userPhone, userEmail, onResendOtp,
  registrationSuccess, serviceType, onTermsAccepted, showBack, onBack,
  returningUser, onReturningUserConfirm, onReturningUserDecline, isReturningUserSuccess,
  returningUserName,
}) {
  const [step, setStep] = useState(0);
  const [text, setText] = useState("");
  const [userData, setUserData] = useState({ name: "", phone: "", email: "" });
  const [messages, setMessages] = useState([]);
  const [showOtpStep, setShowOtpStep] = useState(false);
  const [otp, setOtp] = useState("");
  const [canResendOtp, setCanResendOtp] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  const listRef = useRef(null);
  const timeoutRef = useRef(null);
  const hasShownFirstQuestion = useRef(false);
  const [activeResendId, setActiveResendId] = useState(null);
  const [returningChoiceMade, setReturningChoiceMade] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [returningInProgress, setReturningInProgress] = useState(false);
  const [inputKey, setInputKey] = useState(Date.now());

  // showOtpStep being true means server responded — OTP input must show
  // even if "In progress..." bubble is still in messages
  // const isProcessing =
  //   (messages.some(msg => msg.text === "In progress...") && !showOtpStep && !returningInProgress === false) ||
  //   registrationSuccess;

  // Cleaner: block input only when truly waiting, not after server has responded
  const shouldBlockInput =
    (returningInProgress && !showOtpStep && !isReturningUserSuccess) ||
    (messages.some(msg => msg.text === "In progress...") && !showOtpStep) ||
    registrationSuccess;

  const handleAcceptTerms = async () => {
    try {
      await api.post('/terms/accept', {
        version: USER_TERMS.version,
        userType: 'user'
      });
      setShowTerms(false);
      onTermsAccepted(serviceType);

      const completeData = {
        ...userData,
        termsAccepted: true
      };
      onComplete(completeData);
    } catch (error) {
      console.error('Failed to save terms acceptance:', error);
    }
  };

  // Returning user — success
  useEffect(() => {
    if (!isReturningUserSuccess) return;

    setReturningInProgress(false);
    setMessages(prev => prev.filter(
      msg => msg.text !== "Verifying OTP..." && msg.text !== "In progress..."
    ));
    setIsVerifyingOtp(false);

    setMessages(prev => [...prev, {
      id: Date.now(),
      from: "them",
      text: `Welcome back ${returningUserName || ''}! I'm glad to have you back onboard.`,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "delivered",
    }]);

    setTimeout(() => setShowTerms(true), 1000);
  }, [isReturningUserSuccess, returningUserName]);

  // Handle registration errors (name/phone/email step)
  useEffect(() => {
    if (errors && errors.length > 0 && !showOtpStep && !needsOtpVerification) {
      setMessages(prev => prev.filter(msg => msg.text !== "In progress..."));

      errors.forEach((errorText, index) => {
        setTimeout(() => {
          setMessages(prev => [...prev, {
            id: Date.now() + index,
            from: "them",
            text: errorText,
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            status: "delivered",
            isError: true
          }]);

          if (index === errors.length - 1) {
            const fieldHints = {
              0: ['name', 'first', 'last'],
              1: ['phone', 'number', 'mobile'],
              2: ['email', 'mail'],
            };

            const lowerError = errorText.toLowerCase();
            let failedStep = 0;
            for (const [stepIdx, hints] of Object.entries(fieldHints)) {
              if (hints.some(h => lowerError.includes(h))) {
                failedStep = parseInt(stepIdx);
                break;
              }
            }

            setTimeout(() => {
              setUserData(prev => {
                const reset = { ...prev };
                QUESTIONS.slice(failedStep).forEach(q => { reset[q.field] = ''; });
                return reset;
              });
              setStep(failedStep);
              setInputKey(Date.now());
              setIsRetrying(true);
              setMessages(prev => [...prev, {
                id: Date.now() + errors.length + 1,
                from: "them",
                text: failedStep === 0
                  ? `Let's try again. ${QUESTIONS[0].question}`
                  : `Let's fix that. ${QUESTIONS[failedStep].question}`,
                time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                status: "delivered",
                field: QUESTIONS[failedStep].field
              }]);
            }, 800);
          }
        }, index * 600);
      });

      setText("");
      if (onErrorClose) setTimeout(() => onErrorClose(), errors.length * 600 + 1000);
    }
  }, [errors, showOtpStep, needsOtpVerification, onErrorClose]);

  useEffect(() => {
    if (!returningUser) return;

    setMessages(prev => prev.filter(msg => msg.text !== "In progress..."));
    setReturningChoiceMade(false);

    const greetMsg = {
      id: Date.now(),
      from: "them",
      text: `Hello! Looks like you already have a Sendrey account${returningUser.name ? ` as ${returningUser.name}` : ""}. Would you like to continue?`,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "delivered",
      isReturningUserPrompt: true,
    };

    setMessages(prev => [...prev, greetMsg]);
  }, [returningUser]);

  // Handle OTP verification errors
  useEffect(() => {
    if (errors && errors.length > 0 && showOtpStep) {
      setMessages(prev => prev.filter(
        msg => msg.text !== "Verifying OTP..." && msg.text !== "In progress..."
      ));
      setReturningInProgress(false);

      errors.forEach((errorText, index) => {
        setTimeout(() => {
          if (index === errors.length - 1) {
            const msgId = Date.now() + index;

            setMessages(prev => [...prev, {
              id: msgId,
              from: "them",
              text: errorText,
              time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              status: "delivered",
              isError: true,
              hasResendLink: true,
            }]);

            setActiveResendId(msgId);
          }
        }, index * 600);
      });

      setOtp("");
      setIsVerifyingOtp(false);

      if (onErrorClose) {
        setTimeout(() => onErrorClose(), errors.length * 600 + 500);
      }
    }
  }, [errors, showOtpStep, onErrorClose]);

  // Handle registration success
  useEffect(() => {
    if (registrationSuccess) {
      setMessages(prev => prev.filter(msg => msg.text !== "In progress..."));

      setTimeout(() => {
        setMessages(prev => prev.filter(msg => msg.text !== "Verifying OTP..."));
      }, 400);

      setMessages(prev => [...prev, {
        id: Date.now(),
        from: "them",
        text: "Registration successful, welcome to sendrey!",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "delivered",
      }]);

      setTimeout(() => setShowTerms(true), 1000);
    }
  }, [registrationSuccess]);

  // Initialize conversation with first question ONLY ONCE
  useEffect(() => {
    if (!hasShownFirstQuestion.current && messages.length === 0 && !showOtpStep && !isRetrying) {
      setMessages([{
        id: Date.now(),
        from: "them",
        text: QUESTIONS[0].question,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "read",
        field: QUESTIONS[0].field
      }]);
      hasShownFirstQuestion.current = true;
    }
  }, [messages.length, showOtpStep, isRetrying]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleAnswer = (value) => {
    const field = QUESTIONS[step].field;
    const newData = { ...userData, [field]: value };

    setMessages(prev => [...prev, {
      id: Date.now(),
      from: "me",
      text: value,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "sent",
    }]);
    setText("");
    setIsRetrying(false);

    if (step < QUESTIONS.length - 1) {
      setUserData(newData);
      timeoutRef.current = setTimeout(() => {
        const nextStep = step + 1;
        setStep(nextStep);
        setMessages(prev => [...prev, {
          id: Date.now() + 1,
          from: "them",
          text: QUESTIONS[nextStep].question,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          status: "delivered",
          field: QUESTIONS[nextStep].field
        }]);
      }, 800);
    } else {
      setUserData(newData);
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        from: "them",
        text: "In progress...",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "delivered",
      }]);
      timeoutRef.current = setTimeout(() => {
        onComplete({ ...userData, [field]: value });
      }, 800);
    }
  };

  const showOtpVerification = (email, phone) => {
    setMessages(prev => prev.filter(msg => msg.text !== "In progress..."));
    setReturningInProgress(false);

    const secondOtpMsgId = Date.now() + 2;

    setMessages(prev => [...prev,
    {
      id: Date.now() + 1,
      from: "them",
      text: "We have sent you an OTP to confirm your email",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "delivered",
    }
    ]);

    setTimeout(() => {
      setMessages(prev => [...prev, {
        id: secondOtpMsgId,
        from: "them",
        text: `Enter the OTP we sent to ${email || userData.email}, \n \nDidn't receive OTP? `,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "delivered",
        hasResendLink: true
      }]);
      setShowOtpStep(true);
    }, 2000);

    setTimeout(() => {
      setCanResendOtp(true);
      setActiveResendId(secondOtpMsgId);
    }, 30000);
  };

  const handleOtpSubmit = () => {
    if (!otp.trim()) return;

    setMessages(prev => [...prev,
    {
      id: Date.now(),
      from: "me",
      text: otp,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "sent",
    },
    {
      id: Date.now() + 1,
      from: "them",
      text: "Verifying OTP...",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "delivered",
    }
    ]);

    setIsVerifyingOtp(true);
    const completeData = { ...userData, otp: otp.trim() };
    setOtp("");
    onComplete(completeData);
  };

  const handleResendOtp = () => {
    if (!canResendOtp) return;
    if (onResendOtp) onResendOtp();

    const resendMsgId = Date.now() + 1;

    setMessages(prev => [
      ...prev,
      {
        id: Date.now(),
        from: "them",
        text: "OTP has been resent to your email",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "delivered",
      },
      {
        id: resendMsgId,
        from: "them",
        text: `Enter the new OTP we sent to ${userData.email}, \n \nDidn't receive OTP? Resend`,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "delivered",
        hasResendLink: true,
      }
    ]);

    setCanResendOtp(false);
    setActiveResendId(null);
    setTimeout(() => {
      setCanResendOtp(true);
      setActiveResendId(resendMsgId);
    }, 30000);
  };

  useEffect(() => {
    if (needsOtpVerification && userEmail) {
      showOtpVerification(userEmail, userPhone);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsOtpVerification, userEmail, userPhone]);

  const handleMessageClick = (message) => {
    if (message.hasResendLink && canResendOtp) handleResendOtp();
  };

  const handleSend = () => {
    const messageToSend = showOtpStep ? otp : text;
    if (!messageToSend.trim()) return;

    if (showOtpStep) {
      setOtp(messageToSend.trim());
      handleOtpSubmit();
    } else {
      handleAnswer(messageToSend.trim());
    }
  };

  const handleReturningYes = () => {
    if (returningChoiceMade) return;
    setReturningChoiceMade(true);
    setReturningInProgress(true);

    setMessages(prev => [
      ...prev.map(m => ({ ...m, isReturningUserPrompt: false })),
      {
        id: Date.now(),
        from: "me",
        text: "Yes",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "sent",
      },
      {
        id: Date.now() + 1,
        from: "them",
        text: "In progress...",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "delivered",
      },
    ]);

    onReturningUserConfirm();
  };

  const handleReturningNo = () => {
    if (returningChoiceMade) return;
    setReturningChoiceMade(true);

    setMessages(prev => [
      ...prev.map(m => ({ ...m, isReturningUserPrompt: false })),
      {
        id: Date.now(),
        from: "me",
        text: "No",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "sent",
      },
      {
        id: Date.now() + 1,
        from: "them",
        text: `Alright, let's start fresh. ${QUESTIONS[0].question}`,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "delivered",
        field: QUESTIONS[0].field,
      },
    ]);

    setStep(0);
    setUserData({ name: "", phone: "", email: "" });
    setIsRetrying(true);
    setReturningChoiceMade(false);
    onReturningUserDecline();
  };

  const hasReturningPrompt = messages.some(m => m.isReturningUserPrompt);

  return (
    <Onboarding darkMode={darkMode} toggleDarkMode={toggleDarkMode} showBack={showBack} onBack={onBack}>
      <div className="w-full h-full flex flex-col overflow-hidden max-w-2xl mx-auto">
        <div ref={listRef} className="flex-1 overflow-y-auto p-4 pb-4">
          {messages.map((m) => (
            <Message
              key={m.id}
              m={m}
              canResendOtp={canResendOtp}
              onMessageClick={() => handleMessageClick(m)}
              showCursor={false}
              showStatusIcons={false}
              isActiveResend={m.id === activeResendId}
            />
          ))}
        </div>

        <div className="h-3"></div>

        {!shouldBlockInput && !isVerifyingOtp && (
          <div className="py-10 px-3 placeholder:text-sm">
            {hasReturningPrompt ? (
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={handleReturningYes}
                  disabled={returningChoiceMade}
                  className="bg-secondary rounded-lg sm:text-sm flex items-center gap-3 justify-center"
                >
                  Yes, that's me
                </Button>
                <Button
                  onClick={handleReturningNo}
                  disabled={returningChoiceMade}
                  variant="outlined"
                  className="bg-primary rounded-lg sm:text-sm text-white flex items-center gap-3 justify-center"
                >
                  No
                </Button>
              </div>
            ) : (
              <CustomInput
                key={inputKey}
                showMic={false}
                showIcons={false}
                showEmojis={false}
                send={handleSend}
                value={showOtpStep ? otp : text}
                onChange={(e) => showOtpStep ? setOtp(e.target.value) : setText(e.target.value)}
                placeholder={showOtpStep ? "Enter OTP code" : `Your ${QUESTIONS[step]?.field || 'response'}...`}
                type={showOtpStep ? "number" : "text"}
              />
            )}
          </div>
        )}
      </div>

      <TermsAcceptanceModal
        isOpen={showTerms}
        onClose={() => { }}
        onAccept={handleAcceptTerms}
        terms={USER_TERMS}
        darkMode={darkMode}
        userType="user"
      />
    </Onboarding>
  );
}