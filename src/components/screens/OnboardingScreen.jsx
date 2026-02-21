import React, { useEffect, useRef, useState } from "react";
import Message from "../common/Message";
import Onboarding from "../common/Onboarding";
import CustomInput from "../common/CustomInput";

import TermsAcceptanceModal from '../common/TermsAcceptanceModal';
import { USER_TERMS } from '../../constants/terms';
import api from '../../utils/api';

const QUESTIONS = [
  { question: "What's your name?", field: "name" },
  { question: "What's your phone number?", field: "phone" },
  { question: "What's your email address?", field: "email" },
];

export default function OnboardingScreen({
  onComplete,
  darkMode,
  toggleDarkMode,
  errors,
  onErrorClose,
  needsOtpVerification,
  userPhone,
  onResendOtp,
  registrationSuccess,
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


  const isProcessing = (messages.some(msg => msg.text === "In progress...") && !showOtpStep) || registrationSuccess;

  const handleAcceptTerms = async () => {
    try {
      await api.post('/terms/accept', {
        version: USER_TERMS.version,
        userType: 'user'
      });
      setShowTerms(false);

      // Call onComplete to trigger navigation in parent
      const completeData = {
        ...userData,
        termsAccepted: true
      };
      onComplete(completeData);
      console.log('Terms accepted, user data:', completeData);

    } catch (error) {
      console.error('Failed to save terms acceptance:', error);
    }
  };

  // Handle registration errors (name/phone/email step)
  useEffect(() => {
    if (errors && errors.length > 0 && !showOtpStep && !needsOtpVerification) {
      setMessages(prev => prev.filter(msg => msg.text !== "In progress..."));

      errors.forEach((errorText, index) => {
        setTimeout(() => {
          const errorMessage = {
            id: Date.now() + index,
            from: "them",
            text: errorText,
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            status: "delivered",
            isError: true
          };

          setMessages(prev => [...prev, errorMessage]);

          if (index === errors.length - 1) {
            setTimeout(() => {
              const restartMessage = {
                id: Date.now() + errors.length + 1,
                from: "them",
                text: `Let's try again, ${QUESTIONS[0].question}`,
                time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                status: "delivered",
                field: QUESTIONS[0].field
              };

              setMessages(prev => [...prev, restartMessage]);
              setStep(0);
              setUserData({ name: "", phone: "", email: "" });
              setIsRetrying(true);
            }, 800);
          }
        }, index * 600);
      });

      setText("");

      if (onErrorClose) {
        setTimeout(() => {
          onErrorClose();
        }, errors.length * 600 + 1000);
      }
    }
  }, [errors, showOtpStep, needsOtpVerification, onErrorClose]);

  // Handle OTP verification errors
  useEffect(() => {
    if (errors && errors.length > 0 && showOtpStep) {
      setMessages(prev => prev.filter(msg => msg.text !== "Verifying OTP..."));

      errors.forEach((errorText, index) => {
        setTimeout(() => {
          const errorMessage = {
            id: Date.now() + index,
            from: "them",
            text: errorText,
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            status: "delivered",
            isError: true,
            hasResendLink: index === errors.length - 1,
          };

          setMessages(prev => [...prev, errorMessage]);
        }, index * 600);
      });

      setOtp("");

      if (onErrorClose) {
        setTimeout(() => {
          onErrorClose();
        }, errors.length * 600 + 500);
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

      const successMessage = {
        id: Date.now(),
        from: "them",
        text: "Registration successful, welcome to sendrey!",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "delivered",
      };

      setMessages(prev => [...prev, successMessage]);

      setTimeout(() => {
        setShowTerms(true);
      }, 1000);
    }
  }, [registrationSuccess]);

  // Initialize conversation with first question ONLY ONCE
  useEffect(() => {
    if (!hasShownFirstQuestion.current && messages.length === 0 && !showOtpStep && !isRetrying) {
      const firstMessage = {
        id: Date.now(),
        from: "them",
        text: QUESTIONS[0].question,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "read",
        field: QUESTIONS[0].field
      };
      setMessages([firstMessage]);
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
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleAnswer = (value) => {
    const field = QUESTIONS[step].field;
    const newData = { ...userData, [field]: value };

    const userMessage = {
      id: Date.now(),
      from: "me",
      text: value,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "sent",
    };

    setMessages(prev => [...prev, userMessage]);
    setText("");
    setIsRetrying(false); // Clear retry flag after user responds

    if (step < QUESTIONS.length - 1) {
      setUserData(newData);

      timeoutRef.current = setTimeout(() => {
        const nextStep = step + 1;
        setStep(nextStep);

        const nextMessage = {
          id: Date.now() + 1,
          from: "them",
          text: QUESTIONS[nextStep].question,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          status: "delivered",
          field: QUESTIONS[nextStep].field
        };

        setMessages(prev => [...prev, nextMessage]);
      }, 800);
    } else {
      setUserData(newData);

      const progressMessage = {
        id: Date.now() + 1,
        from: "them",
        text: "In progress...",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "delivered",
      };

      setMessages(prev => [...prev, progressMessage]);

      timeoutRef.current = setTimeout(() => {
        const completeUserData = {
          ...userData,
          [field]: value
        };

        onComplete(completeUserData);
      }, 800);
    }
  };

  const showOtpVerification = (phone) => {
    setMessages(prev => prev.filter(msg => msg.text !== "In progress..."));

    const firstOtpMessage = {
      id: Date.now() + 1,
      from: "them",
      text: "We have sent you an OTP to confirm your phone number",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "delivered",
    };

    const secondOtpMessage = {
      id: Date.now() + 2,
      from: "them",
      text: `Enter the OTP we sent to ${phone || userData.phone}, \n \nDidn't receive OTP? Resend`,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "delivered",
      hasResendLink: true
    };

    setMessages(prev => [...prev, firstOtpMessage]);

    setTimeout(() => {
      setMessages(prev => [...prev, secondOtpMessage]);
      setShowOtpStep(true);
    }, 2000);

    setTimeout(() => {
      setCanResendOtp(true);
    }, 30000);
  };

  const handleOtpSubmit = () => {
    if (!otp.trim()) return;

    const otpMessage = {
      id: Date.now(),
      from: "me",
      text: otp,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "sent",
    };

    setMessages(prev => [...prev, otpMessage]);

    const verifyingMessage = {
      id: Date.now() + 1,
      from: "them",
      text: "Verifying OTP...",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "delivered",
    };

    setMessages(prev => [...prev, verifyingMessage]);

    const completeData = {
      ...userData,
      otp: otp.trim()
    };

    setOtp("");
    onComplete(completeData);
  };

  const handleResendOtp = () => {
    if (!canResendOtp) return;

    if (onResendOtp) {
      onResendOtp();
    }

    const resendMessage = {
      id: Date.now(),
      from: "them",
      text: "OTP has been resent to your phone number",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "delivered",
    };

    setMessages(prev => [...prev, resendMessage]);
    setCanResendOtp(false);

    setTimeout(() => {
      setCanResendOtp(true);
    }, 30000);
  };

  useEffect(() => {
    if (needsOtpVerification && userPhone) {
      showOtpVerification(userPhone);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsOtpVerification, userPhone]);

  const handleMessageClick = (message) => {
    if (message.hasResendLink && canResendOtp) {
      handleResendOtp();
    }
  };

  const send = (message = text) => {
    if (!message.trim()) return;

    if (showOtpStep) {
      setOtp(message.trim());
      handleOtpSubmit();
    } else {
      handleAnswer(message.trim());
    }
  };

  const handleSend = () => {
    const messageToSend = showOtpStep ? otp : text;
    if (!messageToSend.trim()) return;

    send(messageToSend.trim());
  };

  return (
    <Onboarding darkMode={darkMode} toggleDarkMode={toggleDarkMode}>
      <div className="w-full h-full flex flex-col overflow-hidden max-w-2xl mx-auto">
        <div ref={listRef} className="flex-1 overflow-y-auto p-4 pb-4">
          {messages.map((m) => (
            <Message
              key={m.id}
              m={m}
              canResendOtp={canResendOtp}
              onMessageClick={() => handleMessageClick(m)}
              showCursor={false}
            />
          ))}
        </div>

        <div className="h-3"></div>

        {!isProcessing && (
          <div className="py-10 px-3 placeholder:text-sm">
            <CustomInput
              showMic={false}
              showIcons={false}
              showEmojis={false}
              send={handleSend}
              value={showOtpStep ? otp : text}
              onChange={(e) => showOtpStep ? setOtp(e.target.value) : setText(e.target.value)}
              placeholder={showOtpStep ? "Enter OTP code" : `Your ${QUESTIONS[step]?.field || 'response'}...`}
              type={showOtpStep ? "number" : "text"}
            />
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