import React, { useEffect, useRef, useState } from "react";
import { Button } from "@material-tailwind/react";
import Onboarding from "../common/Onboarding";
import Message from "../common/Message";
import CustomInput from "../common/CustomInput";
import { useDispatch } from "react-redux";
import { register } from "../../Redux/authSlice";

const initialMessages = [
  { id: 1, from: "them", text: "Welcome to Runner Dashboard!", time: "12:24 PM", status: "read" },
  {
    id: 2,
    from: "them",
    text: "Would you like to handle pickups or run errands?",
    time: "12:25 PM",
    status: "delivered",
  }
];

const credentialQuestions = [
  { question: "What's your name?", field: "name" },
  { question: "What's your phone number?", field: "phone" },
  { question: "What's your fleet type? (bike, car, motorcycle)", field: "fleetType" },
  { question: "Why do you want to be a runner?", field: "customAnswer" }
];

export default function RunnerDashboardScreen({ darkMode, toggleDarkMode, onClose }) {
  const [messages, setMessages] = useState(initialMessages);
  const [text, setText] = useState("");
  const [step, setStep] = useState(0);
  const [isCollectingCredentials, setIsCollectingCredentials] = useState(false);
  const [runnerData, setRunnerData] = useState({
    name: "",
    phone: "",
    fleetType: "",
  });
  const listRef = useRef(null);
  const dispatch = useDispatch();

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const handleServiceSelection = (serviceType) => {
    const userMessage = {
      id: Date.now(),
      from: "me",
      text: serviceType,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "sent",
    };

    setMessages(prev => [...prev, userMessage]);

    // Show "In progress..." message
    const progressMessage = {
      id: Date.now() + 1,
      from: "them",
      text: "In progress...",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "delivered",
    };

    setMessages(prev => [...prev, progressMessage]);

    // Start credential flow after delay
    setTimeout(() => {
      startCredentialFlow(serviceType);
    }, 1200);
  };

  const startCredentialFlow = (serviceType) => {
    // Remove the "In progress..." message and add first question
    setMessages(prev => {
      const filtered = prev.filter(msg => msg.text !== "In progress...");
      const firstQuestion = {
        id: Date.now(),
        from: "them",
        text: credentialQuestions[0].question,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "delivered",
      };
      return [...filtered, firstQuestion];
    });

    setStep(0);
    setIsCollectingCredentials(true);
    setRunnerData(prev => ({ ...prev, serviceType }));
  };

  const handleCredentialAnswer = (answer) => {
    const currentField = credentialQuestions[step].field;
    
    const newRunnerData = { ...runnerData, [currentField]: answer };
    setRunnerData(newRunnerData);

    const userMessage = {
      id: Date.now(),
      from: "me",
      text: answer,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "sent",
    };

    setMessages(prev => [...prev, userMessage]);
    setText("");

    if (step < credentialQuestions.length - 1) {
      setTimeout(() => {
        const nextStep = step + 1;
        setStep(nextStep);

        const nextQuestion = {
          id: Date.now() + 1,
          from: "them",
          text: credentialQuestions[nextStep].question,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          status: "delivered",
        };

        setMessages(prev => [...prev, nextQuestion]);
      }, 800);
    } else {
      setTimeout(() => {
        submitRunnerRegistration(newRunnerData);
      }, 800);
    }
  };

  const submitRunnerRegistration = async (runnerData) => {
    try {
      const result = await dispatch(register({
        role: "runner",
        fullName: runnerData.name,
        phone: runnerData.phone,
        fleetType: runnerData.fleetType,
      })).unwrap();

      console.log("Runner registration successful:", result);
      
      const successMessage = {
        id: Date.now(),
        from: "them",
        text: "Great! Registration successful. Our team will contact you for verification.",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "delivered",
      };

      setMessages(prev => [...prev, successMessage]);
      resetCredentialFlow();

      // Optionally close the dashboard after success
      setTimeout(() => {
        if (onClose) onClose();
      }, 2000);

    } catch (error) {
      console.error("Registration failed:", error);
      
      const errorMessage = {
        id: Date.now(),
        from: "them",
        text: `Registration failed: ${error}. Please try again.`,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "delivered",
      };

      setMessages(prev => [...prev, errorMessage]);
      resetCredentialFlow();
    }
  };

  const resetCredentialFlow = () => {
    setIsCollectingCredentials(false);
    setStep(0);
    setRunnerData({ name: "", phone: "", fleetType: "",  });
  };

  const send = () => {
    if (!text.trim()) return;

    if (isCollectingCredentials && step !== null) {
      handleCredentialAnswer(text.trim());
    }
  };

  return (
    <Onboarding darkMode={darkMode} toggleDarkMode={toggleDarkMode}>
      <div className="w-full max-w-2xl mx-auto p-4 relative">
        <div ref={listRef} className="w-full max-w-2xl mx-auto p-4 relative h-[70vh] overflow-y-auto">
          {messages.map((m) => (
            <Message key={m.id} m={m} />
          ))}
        </div>

        {!isCollectingCredentials ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
            <Button
              onClick={() => handleServiceSelection('Pick Up')}
              className="bg-secondary rounded-lg sm:text-sm flex items-center gap-3 justify-center"
            >
              <span>Pick Up</span>
            </Button>

            <Button
              onClick={() => handleServiceSelection('Run Errand')}
              className="bg-primary rounded-lg sm:text-sm flex items-center gap-3 justify-center"
            >
              <span>Run Errand</span>
            </Button>
          </div>
        ) : (
          <CustomInput
            showMic={false}
            send={send}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Your ${credentialQuestions[step]?.field}...`}
          />
        )}
      </div>
    </Onboarding>
  );
}