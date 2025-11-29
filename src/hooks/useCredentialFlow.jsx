import { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import { register, verifyPhone } from "../Redux/authSlice";

export const useCredentialFlow = (serviceTypeRef, onRegistrationSuccess) => {
  const dispatch = useDispatch();

  const [isCollectingCredentials, setIsCollectingCredentials] = useState(false);
  const [credentialStep, setCredentialStep] = useState(null);
  const [needsOtpVerification, setNeedsOtpVerification] = useState(false);
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const [tempUserData, setTempUserData] = useState(null);
  const [error, setError] = useState(null);
  const [isShowingOtp, setIsShowingOtp] = useState(false);
  const [lastValidatedField, setLastValidatedField] = useState(null);
  const [runnerData, setRunnerData] = useState({
    name: "",
    phone: "",
    fleetType: "",
    role: "runner",
    serviceType: ""
  });
  const [runnerLocation, setRunnerLocation] = useState(null);

  // Get runner's location when credential flow starts
  useEffect(() => {
    if (isCollectingCredentials && !runnerLocation) {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setRunnerLocation({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            });
          },
          (error) => {
            console.warn('Location access denied for runner:', error);
            // Set default coordinates as fallback
            setRunnerLocation({
              latitude: 6.5244,
              longitude: 3.3792
            });
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 600000
          }
        );
      } else {
        // Set default coordinates if geolocation not supported
        setRunnerLocation({
          latitude: 6.5244,
          longitude: 3.3792
        });
      }
    }
  }, [isCollectingCredentials, runnerLocation]);

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
      isCredential: true
    };

    setMessages(prev => [...prev, firstQuestion]);
    setCredentialStep(0);
    setIsCollectingCredentials(true);
  };

  const handleCredentialAnswer = async (answer, setText, setMessages, data) => {
    // Normal credential collection
    const currentField = credentialQuestions[credentialStep].field;
    const updatedRunnerData = {
      ...runnerData,
      [currentField]: answer,
      serviceType: serviceTypeRef.current || runnerData.serviceType
    };
    setRunnerData(updatedRunnerData);

    // Update last validated field
    if (currentField === "phone") {
      if (answer.startsWith("+") && answer.length > 4) {
        setLastValidatedField("phone");
      }
    } else {
      setLastValidatedField(currentField);
    }

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


      const progressMessage = {
        id: Date.now() + 1,
        from: "them",
        text: "In progress...",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "delivered",
      };
      setMessages(prev => [...prev, progressMessage]);

      // Save temp data and trigger registration
      setTimeout(async () => {
        const nameParts = updatedRunnerData.name.trim().split(" ");
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ");

        const payload = {
          phone: updatedRunnerData.phone || "",
          fleetType: updatedRunnerData.fleetType || "",
          role: "runner",
          serviceType: serviceTypeRef.current || "",
          isOnline: true,
          isAvailable: true
        };

        if (runnerLocation) {
          payload.latitude = runnerLocation.latitude;
          payload.longitude = runnerLocation.longitude;
        }

        if (firstName) {
          payload.firstName = firstName;
        }

        if (lastName) {
          payload.lastName = lastName;
        }

        console.log("Registration payload with location:", payload);

        try {
          const result = await dispatch(register(payload)).unwrap();
          console.log("Registration successful, needs OTP verification");
          setTempUserData(updatedRunnerData);


          setMessages(prev => prev.filter(msg => msg.text !== "In progress..."));
          setNeedsOtpVerification(true);

          showOtpVerification(setMessages);

        } catch (error) {
          console.error("Registration failed:", error);


          setMessages(prev => prev.filter(msg => msg.text !== "In progress..."));

          const errorMessage = typeof error === 'string'
            ? error
            : JSON.stringify(error) || "Registration failed. Please try again.";

          setMessages(prev => [
            ...prev,
            {
              id: Date.now(),
              from: "them",
              text: `Registration failed: ${errorMessage}`,
              time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              status: "delivered",
            }
          ]);

          // dont move to next step
          setIsCollectingCredentials(true);

          // resumed exactly at the failed question
          const lastIndex = credentialQuestions.findIndex(
            (q) => q.field === lastValidatedField
          );

          const failedIndex = lastIndex + 1;

          if (failedIndex < credentialQuestions.length) {
            setCredentialStep(failedIndex);

            const retryQuestion = credentialQuestions[failedIndex].question;

            setMessages(prev => [
              ...prev,
              {
                id: Date.now() + 1,
                from: "them",
                text: `Let's try again.\n${retryQuestion}`,
                time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                status: "delivered",
                isCredential: true
              }
            ]);
          }
        }
      }, 800);


    }
  };

  const showOtpVerification = (setMessages) => {
    if (isShowingOtp) return;
    setIsShowingOtp(true);

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
      text: `Enter the OTP we sent to ${runnerData.phone}, \n \nDidn't receive OTP? Resend`,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "delivered",
      hasResendLink: true
    };

    setMessages(prev => [...prev, firstOtpMessage]);

    setTimeout(() => {
      setMessages(prev => [...prev, secondOtpMessage]);
    }, 1000);
  };

  const handleOtpVerification = async (otp, setMessages) => {
    if (!otp || !tempUserData) return;

    // Add verifying message
    const verifyingMessage = {
      id: Date.now() + 1,
      from: "them",
      text: "Verifying OTP...",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "delivered",
    };
    setMessages(prev => [...prev, verifyingMessage]);

    try {
      const verifyPayload = {
        phone: tempUserData.phone,
        otp: otp
      };

      const result = await dispatch(verifyPhone(verifyPayload)).unwrap();

      // Remove "Verifying OTP..." and show success
      setMessages(prev => {
        const filtered = prev.filter(msg => msg.text !== "Verifying OTP...");
        return [...filtered, {
          id: Date.now(),
          from: "them",
          text: "Registration successful, welcome to sendrey!",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          status: "delivered",
        }];
      });

      setNeedsOtpVerification(false);
      setRegistrationComplete(true);
      setError(null);
      setIsCollectingCredentials(false);
      setCredentialStep(null);

      if (onRegistrationSuccess) {
        onRegistrationSuccess(result.user);
      }

    } catch (error) {
      console.error("OTP verification failed:", error);

      setError(error);
    }
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
    setRunnerLocation(null);
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
    registrationComplete,
    setRegistrationComplete,
    onRegistrationSuccess,
    handleOtpVerification,
    error,
    setError,
  };
};