import React, { useEffect, useRef, useState, useMemo } from "react";
import Message from "../common/Message";
import Onboarding from "../common/Onboarding";
import CustomInput from "../common/CustomInput";

export default function OnboardingScreen({ 
  userType, 
  onComplete, 
  darkMode, 
  toggleDarkMode, 
  errors, onErrorClose, 
  needsOtpVerification, 
  userPhone, onResendOtp, 
  registrationSuccess }) {
  const [step, setStep] = useState(0);
  const [text, setText] = useState("");
  const [userData, setUserData] = useState({ name: "", phone: "" });
  const [messages, setMessages] = useState([]);
  const [showOtpStep, setShowOtpStep] = useState(false);
  const [otp, setOtp] = useState("");
  const [canResendOtp, setCanResendOtp] = useState(false);
  const [lastAttemptData, setLastAttemptData] = useState({ name: "", phone: "" });
  const listRef = useRef(null);
  const timeoutRef = useRef(null);

  const isProcessing = (messages.some(msg => msg.text === "In progress...") && !showOtpStep) || registrationSuccess;

  const questions = useMemo(() =>
    userType === 'user'
      ? [
        { question: "What's your name?", field: "name" },
        { question: "What's your phone number?", field: "phone" },
      ]
      : [
        { question: "What's your name?", field: "name" },
        { question: "What's your phone number?", field: "phone" },
      ],
    [userType]
  );

  // Handle errors for registration (name/phone step)
  useEffect(() => {
    if (errors && errors.length > 0 && !showOtpStep && !needsOtpVerification) {
      // Remove only "In progress..." - keep all user messages visible
      setMessages(prev => prev.filter(msg => msg.text !== "In progress..."));

      // Show each error as a separate message
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

          // After showing all errors, restart the flow
          if (index === errors.length - 1) {
            setTimeout(() => {
              const restartMessage = {
                id: Date.now() + errors.length + 1,
                from: "them",
                text: `Let's try again, ${questions[0].question}`,
                time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                status: "delivered",
                field: questions[0].field
              };

              setMessages(prev => [...prev, restartMessage]);
              setStep(0);
              setUserData({ name: "", phone: "" });
            }, 800);
          }
        }, index * 600); // Stagger error messages by 600ms
      });

      setText("");

      // Clear errors after displaying
      if (onErrorClose) {
        setTimeout(() => {
          onErrorClose();
        }, errors.length * 600 + 1000);
      }
    }
  }, [errors, showOtpStep, needsOtpVerification, onErrorClose, questions]);

  // Handle errors for OTP verification
  useEffect(() => {
    if (errors && errors.length > 0 && showOtpStep) {
      // Remove "Verifying OTP..." message
      setMessages(prev => prev.filter(msg => msg.text !== "Verifying OTP..."));

      // Show each error message
      errors.forEach((errorText, index) => {
        setTimeout(() => {
          const errorMessage = {
            id: Date.now() + index,
            from: "them",
            text: errorText,
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            status: "delivered",
            isError: true,
            hasResendLink: index === errors.length - 1, // Only last error gets resend link
          };

          setMessages(prev => [...prev, errorMessage]);
        }, index * 600);
      });

      setOtp("");

      // Clear errors after displaying
      if (onErrorClose) {
        setTimeout(() => {
          onErrorClose();
        }, errors.length * 600 + 500);
      }
    }
  }, [errors, showOtpStep, onErrorClose]);

  useEffect(() => {
    if (registrationSuccess) {
      // Remove "In progress..." message
      setMessages(prev => prev.filter(msg => msg.text !== "In progress..."));

      const successMessage = {
        id: Date.now(),
        from: "them",
        text: "Registration successful, welcome to sendrey!",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "delivered",
      };

      setMessages(prev => [...prev, successMessage]);
    }
  }, [registrationSuccess]);

  // Initialize conversation with first question
  useEffect(() => {
    if (step === 0 && messages.length === 0 && !showOtpStep) {
      const firstMessage = {
        id: Date.now(),
        from: "them",
        text: questions[0].question,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "read",
        field: questions[0].field
      };
      setMessages([firstMessage]);
    }
  }, [step, messages.length, questions, showOtpStep]);

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
    const field = questions[step].field;
    const newData = { ...userData, [field]: value };

    // Don't update userData yet - wait for server validation
    // setUserData(newData);

    // Add user's response to messages
    const userMessage = {
      id: Date.now(),
      from: "me",
      text: value,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "sent",
    };

    setMessages(prev => [...prev, userMessage]);
    setText("");

    if (step < questions.length - 1) {
      // Save temporarily and show next question
      setUserData(newData);

      timeoutRef.current = setTimeout(() => {
        const nextStep = step + 1;
        setStep(nextStep);

        const nextMessage = {
          id: Date.now() + 1,
          from: "them",
          text: questions[nextStep].question,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          status: "delivered",
          field: questions[nextStep].field
        };

        setMessages(prev => [...prev, nextMessage]);
      }, 800);
    } else {
      // Last step - phone collected, show in progress
      const progressMessage = {
        id: Date.now() + 1,
        from: "them",
        text: "In progress...",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "delivered",
      };

      setMessages(prev => [...prev, progressMessage]);

      // Send to backend - but don't save to userData yet
      timeoutRef.current = setTimeout(() => {
        const completeUserData = {
          ...userData,
          phone: value, // Use the new phone value directly
          name: userData.name
        };

        // Store last attempt for retry
        setLastAttemptData(completeUserData);

        onComplete(completeUserData);
      }, 800);
    }
  };

  const showOtpVerification = () => {
    // Show OTP verification messages separately
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
      text: `Enter the OTP we sent to ${userData.phone}, \n \nDidn't receive OTP? Resend`,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "delivered",
      hasResendLink: true
    };

    // Add first message
    setMessages(prev => [...prev, firstOtpMessage]);

    // Add second message after a delay
    setTimeout(() => {
      setMessages(prev => [...prev, secondOtpMessage]);
      setShowOtpStep(true);
    }, 2000);

    // Enable resend after 30 seconds
    setTimeout(() => {
      setCanResendOtp(true);
    }, 30000);
  };

  const handleOtpSubmit = () => {
    if (!otp.trim()) return;

    // Add OTP submission to messages
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
      showOtpVerification();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsOtpVerification, userPhone]);

  const handleMessageClick = (message) => {
    if (message.hasResendLink && canResendOtp) {
      handleResendOtp();
    }
  };

  const send = (type, message = text) => {
    if (!message.trim()) return;

    if (showOtpStep) {
      setOtp(message.trim());
      handleOtpSubmit();
    } else {
      handleAnswer(message.trim());
    }
  };

  const handleSend = () => {
    // Pass the current text or OTP value based on the step
    const messageToSend = showOtpStep ? otp : text;
    if (!messageToSend.trim()) return;

    send("text", messageToSend.trim());
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
              placeholder={showOtpStep ? "Enter OTP code" : `Your ${questions[step]?.field || 'response'}...`}
              type={showOtpStep ? "number" : "text"}
            />
          </div>
        )}
      </div>
    </Onboarding>
  );
}