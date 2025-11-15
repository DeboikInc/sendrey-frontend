import React, { useEffect, useRef, useState } from "react";
import { Button, Input } from "@material-tailwind/react";
import Message from "../common/Message";
import Onboarding from "../common/Onboarding";
import CustomInput from "../common/CustomInput";

export default function OnboardingScreen({ userType, onComplete, darkMode, toggleDarkMode, error, onErrorClose, needsOtpVerification, userPhone, onResendOtp }) {
  const [step, setStep] = useState(0);
  const [text, setText] = useState("");
  const [userData, setUserData] = useState({ name: "", phone: "" });
  const [messages, setMessages] = useState([]);
  const [showOtpStep, setShowOtpStep] = useState(false);
  const [otp, setOtp] = useState("");
  const [canResendOtp, setCanResendOtp] = useState(false);
  const listRef = useRef(null);
  const timeoutRef = useRef(null);

  const questions = userType === 'user'
    ? [
      { question: "What's your name?", field: "name" },
      { question: "What's your phone number?", field: "phone" },
    ]
    : [
      { question: "What's your name?", field: "name" },
      { question: "What's your phone number?", field: "phone" },
    ];

  useEffect(() => {
    if (error) {
      setMessages(prev => {
        const filtered = prev.filter((msg, idx) => {
          if (idx === prev.length - 1 && msg.from === "me") {
            return false;
          }
          return true;
        });
        return filtered;
      });
      setText("");
    }
  }, [error]);

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
    setUserData(newData);

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
      // Show next question after a brief delay
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
      // Phone number collected - send to backend immediately
      timeoutRef.current = setTimeout(() => {
        // Send data to backend which will trigger OTP sending
        const completeUserData = {
          ...userData,
          phone: newData.phone,  // Make sure phone is included
          name: newData.name
        };
        // Then show OTP verification UI
        onComplete(completeUserData);
      }, 800);
    }
  };

  const showOtpVerification = () => {
    // Show OTP verification messages separately
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

    // Add second message after a delay to simulate real conversation flow
    setTimeout(() => {
      setMessages(prev => [...prev, secondOtpMessage]);
      setShowOtpStep(true);
    }, 1000);

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

    // Complete onboarding with OTP
    const completeData = {
      ...userData,
      otp: otp.trim()
    };

    onComplete(completeData);
  };

  const handleResendOtp = () => {
    if (!canResendOtp) return;

    if (onResendOtp) {
      onResendOtp();
    }

    // Dispatch resend action (you'll need to pass this as prop)
    // For now, we'll just show a message and reset the timer
    const resendMessage = {
      id: Date.now(),
      from: "them",
      text: "OTP has been resent to your phone number",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "delivered",
    };

    setMessages(prev => [...prev, resendMessage]);
    setCanResendOtp(false);

    // Re-enable resend after 30 seconds
    setTimeout(() => {
      setCanResendOtp(true);
    }, 30000);
  };

  useEffect(() => {
    if (needsOtpVerification && userPhone) {
      showOtpVerification();
    }
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

  return (
    <Onboarding darkMode={darkMode} toggleDarkMode={toggleDarkMode}>
      <div className="w-full max-w-2xl mx-auto p-4 relative">
        <div ref={listRef} className="w-full max-w-2xl mx-auto p-4 relative h-[70vh] overflow-y-auto">
          {messages.map((m) => (
            <Message
              key={m.id}
              m={m}
              onMessageClick={() => handleMessageClick(m)}
            />
          ))}
        </div>

        {showOtpStep ? (
          <div className="space-y-4 mt-4 placeholder:text-sm">
            <CustomInput
              showMic={false}
              send={send}
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="OTP - 09726"
              type="number"
            />
          </div>
        ) : (
          <CustomInput
            showMic={false}
            send={send}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Your ${questions[step].field}...`}
          />
        )}
      </div>
    </Onboarding>
  );
}



// : step === questions.length ? (
//           <div className="space-y-4 mt-4">
//             <p className="text-sm text-gray-600 dark:text-gray-400">
//               {userType === 'runner'
//                 ? `Great! Our team will contact you at ${userData.phone} to complete your KYC verification. Once verified, you'll need to complete training before receiving orders.`
//                 : "Thank you! Your information has been saved. You can now start requesting errand services."}
//             </p>
//             <Button onClick={() => onComplete(userData)} className="w-full">
//               Continue
//             </Button>
//           </div>
//         )