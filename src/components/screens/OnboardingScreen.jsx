import React, { useEffect, useRef, useState } from "react";
import { Button, Input } from "@material-tailwind/react";
import Message from "../common/Message";
import Onboarding from "../common/Onboarding";
import CustomInput from "../common/CustomInput";

export default function OnboardingScreen({ userType, onComplete, darkMode, toggleDarkMode, error, onErrorClose }) {
  const [step, setStep] = useState(0);
  const [text, setText] = useState("");
  const [userData, setUserData] = useState({ name: "", phone: "" });
  const [messages, setMessages] = useState([]);
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
      // Remove last user message (the one that caused the error)
      setMessages(prev => {
        const filtered = prev.filter((msg, idx) => {
          // Keep all messages except the last "me" message
          if (idx === prev.length - 1 && msg.from === "me") {
            return false;
          }
          return true;
        });
        return filtered;
      });

      // Clear input field
      setText("");

      // DON'T auto-close - let user click "Try Again" button
      // Remove this:
      // setTimeout(() => {
      //   if (onErrorClose) onErrorClose();
      // }, 100);
    }
  }, [error]);

  // Initialize conversation with first question
  useEffect(() => {
    if (step === 0 && messages.length === 0) {
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
  }, [step, messages.length, questions]);

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
      // All questions answered
      //  console.log("✅ All questions answered:", newData);
      timeoutRef.current = setTimeout(() => {
        onComplete(newData);
      }, 800);
    }
  };

  const send = (type, message = text) => {
    if (!message.trim()) return;
    handleAnswer(message.trim());
  };

  return (
    <Onboarding darkMode={darkMode} toggleDarkMode={toggleDarkMode}>
      <div className="w-full max-w-2xl mx-auto p-4 relative">
        <div ref={listRef} className="w-full max-w-2xl mx-auto p-4 relative h-[70vh] overflow-y-auto">
          {messages.map((m) => (
            <Message key={m.id} m={m} />
          ))}
        </div>

        {step === questions.length ? (
          <div className="space-y-4 mt-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {userType === 'runner'
                ? `Great! Our team will contact you at ${userData.phone} to complete your KYC verification. Once verified, you'll need to complete training before receiving orders.`
                : "Thank you! Your information has been saved. You can now start requesting errand services."}
            </p>
            <Button onClick={() => onComplete(userData)} className="w-full">
              Continue
            </Button>
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