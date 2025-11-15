import { useState } from "react";
import { useDispatch } from "react-redux";
import { register, verifyPhone } from "../Redux/authSlice";

export const useCredentialFlow = (serviceTypeRef) => {
  const dispatch = useDispatch();

  const [isCollectingCredentials, setIsCollectingCredentials] = useState(false);
  const [credentialStep, setCredentialStep] = useState(null);
  const [needsOtpVerification, setNeedsOtpVerification] = useState(false);
  const [runnerData, setRunnerData] = useState({
    name: "",
    phone: "",
    fleetType: "",
    role: "runner",
    serviceType: ""
  });

  const credentialQuestions = [
    { question: "What's your name?", field: "name" },
    { question: "What's your phone number?", field: "phone" },
    { question: "What's your fleet type? (bike, car, motorcycle, van)", field: "fleetType" },
  ];

  const startCredentialFlow = (serviceType, setMessages) => {

    const firstQuestion = {
      id: Date.now(),
      from: "them",
      text: credentialQuestions[0].question,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "delivered",
    };

    setMessages(prev => [...prev, firstQuestion]);
    setCredentialStep(0);
    setIsCollectingCredentials(true);
  };

  const handleCredentialAnswer = async (answer, setText, setMessages) => {
    // If OTP is provided
    if (needsOtpVerification) {
      try {
        const verifyPayload = {
          phone: runnerData.phone,
          otp: answer.trim()
        };
        console.log("Verifying OTP:", verifyPayload);

        await dispatch(verifyPhone(verifyPayload)).unwrap();
        console.log("OTP verification successful");

        // Reset state
        setNeedsOtpVerification(false);
        setIsCollectingCredentials(false);
        setCredentialStep(null);
        setRunnerData({
          name: "",
          phone: "",
          fleetType: "",
          role: "runner",
        });
        serviceTypeRef.current = null;
      } catch (error) {
        console.error("OTP verification failed:", error);
      }
      return;
    }

    // Normal credential collection
    const currentField = credentialQuestions[credentialStep].field;
    const updatedRunnerData = { ...runnerData, [currentField]: answer, serviceType: runnerData.serviceType };
    setRunnerData(updatedRunnerData);

    // Add user's message
    const userMessage = {
      id: Date.now(),
      from: "me",
      text: answer,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "sent",
    };
    setMessages(prev => [...prev, userMessage]);
    setText("");

    // Proceed to next question or submit
    if (credentialStep < credentialQuestions.length - 1) {
      setTimeout(() => {
        const nextStep = credentialStep + 1;
        setCredentialStep(nextStep);

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
      // Submit data
      setTimeout(async () => {
        const nameParts = updatedRunnerData.name.trim().split(" ");
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ");

        const payload = {
          phone: updatedRunnerData.phone || "",
          fleetType: updatedRunnerData.fleetType || "",
          role: "runner",
          serviceType: serviceTypeRef.current || ""
        };

        if (firstName) {
          payload.firstName = firstName;
        }

        if (lastName) {
          payload.lastName = lastName;
        }

        console.log("Registration payload:", payload);
        // console.log("Full runnerData:", updatedRunnerData);

        try {
          await dispatch(register(payload)).unwrap();
          console.log("Registration successful");

          setNeedsOtpVerification(true);
          setCredentialStep(null);

        } catch (error) {
          console.error("Registration failed:", error);

          setIsCollectingCredentials(false);
          setCredentialStep(null);
        }
      }, 800);
    }
  };

  const showOtpVerification = (setMessages) => {
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
      text: `Enter the OTP we sent to ${runnerData.phone}`,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "delivered",
    };

    setMessages(prev => [...prev, firstOtpMessage]);

    setTimeout(() => {
      setMessages(prev => [...prev, secondOtpMessage]);
    }, 1000);
  };

  const resetCredentialFlow = () => {
    setIsCollectingCredentials(false);
    setCredentialStep(null);
    setNeedsOtpVerification(false);
    setRunnerData({
      name: "",
      phone: "",
      fleetType: "",
      role: "runner",
    });
    serviceTypeRef.current = null;
  };

  return {
    isCollectingCredentials,
    credentialStep,
    credentialQuestions,
    startCredentialFlow,
    handleCredentialAnswer,
    resetCredentialFlow,
    needsOtpVerification,
    runnerData,
    showOtpVerification,
  };
};