import { useState, useEffect, useRef, useCallback } from "react";
import { useDispatch } from "react-redux";
import { register, verifyPhone } from "../Redux/authSlice";
import { authStorage } from '../utils/authStorage';

// ─── Geolocation config ───────────────────────────────────────────────────────
const GEO_OPTIONS = {
  enableHighAccuracy: false,
  timeout: 8000,
  maximumAge: 60000,
};
const MAX_WATCH_DURATION = 20000;

const CREDENTIAL_QUESTIONS = [
  { question: "What's your name?", field: "name" },
  { question: "What's your phone number?", field: "phone" },
  { question: "What's your email address?", field: "email" },
  { question: "What's your fleet type? (bike, car, motorcycle, van)", field: "fleetType", isFleetSelection: true },
];

// ─── Hook ─────────────────────────────────────────────────────────────────────
export const useCredentialFlow = (serviceTypeRef, onRegistrationSuccess) => {
  const dispatch = useDispatch();

  const [isCollectingCredentials, setIsCollectingCredentials] = useState(false);
  const [credentialStep, setCredentialStep] = useState(null);
  const [needsOtpVerification, setNeedsOtpVerification] = useState(false);
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const [tempUserData, setTempUserData] = useState(null);
  const [error, setError] = useState(null);
  const [isShowingOtp, setIsShowingOtp] = useState(false);
  const [lastValidatedField, setLastValidatedField] = useState(null); // eslint-disable-line no-unused-vars
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [runnerData, setRunnerData] = useState({
    name: "",
    phone: "",
    email: "",
    fleetType: "",
    role: "runner",
    serviceType: ""
  });

  // Location state
  const [runnerLocation, setRunnerLocation] = useState(null);
  const [locationResolved, setLocationResolved] = useState(false);

  const bestPositionRef = useRef(null);
  const watchIdRef = useRef(null);
  const watchTimerRef = useRef(null);
  const attemptCountRef = useRef(0);
  const resolvedRef = useRef(false);

  // ── Finalise location ────────────────────────────────────────────────────
  const finaliseLocation = useCallback(() => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (watchTimerRef.current !== null) {
      clearTimeout(watchTimerRef.current);
      watchTimerRef.current = null;
    }

    if (bestPositionRef.current) {
      setRunnerLocation({
        latitude: bestPositionRef.current.latitude,
        longitude: bestPositionRef.current.longitude,
      });
      console.log(
        `[geo] Settled on fix — accuracy: ${bestPositionRef.current.accuracy?.toFixed(1)}m`
      );
    } else {
      console.warn("[geo] No position obtained — proceeding without location");
    }

    setLocationResolved(true);
  }, []);

  // ── Start location acquisition when credential flow begins ───────────────
  useEffect(() => {
    if (!isCollectingCredentials || resolvedRef.current) return;
    if (!("geolocation" in navigator)) {
      console.warn("[geo] Geolocation not supported");
      setLocationResolved(true);
      resolvedRef.current = true;
      return;
    }

    attemptCountRef.current = 0;
    bestPositionRef.current = null;

    const onSuccess = (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;
      bestPositionRef.current = { latitude, longitude, accuracy };
      console.log(`[geo] Got fix (${accuracy.toFixed(1)}m)`);
      finaliseLocation();
    };

    const onError = (err) => {
      console.warn(`[geo] Error (code ${err.code}): ${err.message}`);
      finaliseLocation();
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      onSuccess,
      onError,
      GEO_OPTIONS
    );

    watchTimerRef.current = setTimeout(() => {
      console.log("[geo] Watch duration exceeded — settling");
      finaliseLocation();
    }, MAX_WATCH_DURATION);

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (watchTimerRef.current !== null) {
        clearTimeout(watchTimerRef.current);
        watchTimerRef.current = null;
      }
    };
  }, [isCollectingCredentials, finaliseLocation]);

  const startCredentialFlow = useCallback((serviceType, setMessages) => {
    const firstQuestion = {
      id: Date.now(),
      from: "them",
      text: CREDENTIAL_QUESTIONS[0].question,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "delivered",
      isCredential: true,
    };
    setMessages(prev => [...prev, firstQuestion]);
    setCredentialStep(0);
    setIsCollectingCredentials(true);
  }, []);

  // ── OTP ──────────────────────────────────────────────────────────────────
  const showOtpVerification = useCallback((setMessages, phone) => {
    if (isShowingOtp) return;
    setIsShowingOtp(true);
    const phoneDisplay = phone || runnerData.phone;
    setMessages(prev => [...prev, {
      id: Date.now() + 1,
      from: "them",
      text: "We have sent you an OTP to confirm your phone number",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "delivered",
    }]);
    setTimeout(() => {
      setMessages(prev => [...prev, {
        id: Date.now() + 2,
        from: "them",
        text: `Enter the OTP we sent to ${phoneDisplay}, \n \nDidn't receive OTP? Resend`,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "delivered",
        hasResendLink: true,
      }]);
    }, 1000);
  }, [isShowingOtp, runnerData.phone]);

  const handleCredentialAnswer = useCallback(async (answer, setText, setMessages) => {
    const currentField = CREDENTIAL_QUESTIONS[credentialStep].field;
    const updatedRunnerData = {
      ...runnerData,
      [currentField]: answer,
      serviceType: serviceTypeRef.current || runnerData.serviceType,
    };
    setRunnerData(updatedRunnerData);

    if (currentField === "phone") {
      if (answer.startsWith("+") && answer.length > 4) setLastValidatedField("phone");
    } else {
      setLastValidatedField(currentField);
    }

    // Echo user's answer
    setMessages(prev => [
      ...prev,
      {
        id: Date.now(),
        from: "me",
        text: answer,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "sent",
      },
    ]);
    setText("");

    // Not last question — ask the next one
    if (credentialStep < CREDENTIAL_QUESTIONS.length - 1) {
      setTimeout(() => {
        const nextStep = credentialStep + 1;
        setCredentialStep(nextStep);

        const weightWarningFleets = ["bike", "cycling"];
        if (currentField === "fleetType" && weightWarningFleets.includes(answer.toLowerCase())) {
          setMessages(prev => [
            ...prev,
            {
              id: Date.now() + 1,
              from: "them",
              text: "Note: Bikes, bicycles and pedestrians are only suitable for items weighing 5kg or less.",
              time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              status: "delivered",
            },
          ]);
        }

        setMessages(prev => [
          ...prev,
          {
            id: Date.now() + 2,
            from: "them",
            text: CREDENTIAL_QUESTIONS[nextStep].question,
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            status: "delivered",
          },
        ]);
      }, 800);
      return;
    }

    // Last question answered — show progress and wait for location
    setMessages(prev => [
      ...prev,
      {
        id: Date.now() + 1,
        from: "them",
        text: "In progress...",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "delivered",
      },
    ]);

    const submitWhenReady = async () => {
      if (!locationResolved) {
        setTimeout(submitWhenReady, 500);
        return;
      }

      setIsSubmitting(true);

      const nameParts = updatedRunnerData.name.trim().split(" ");
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ");

      const payload = {
        phone: updatedRunnerData.phone,
        email: updatedRunnerData.email,
        fleetType: updatedRunnerData.fleetType,
        role: "runner",
        serviceType: serviceTypeRef.current,
        isOnline: true,
        isAvailable: true,
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        ...(runnerLocation && {
          latitude: runnerLocation.latitude,
          longitude: runnerLocation.longitude,
        }),
      };

      try {
        await dispatch(register(payload)).unwrap();
        setTempUserData(updatedRunnerData);
        setMessages(prev => prev.filter(m => m.text !== "In progress..."));
        setNeedsOtpVerification(true);
        setIsCollectingCredentials(false);
        setCredentialStep(null);
        showOtpVerification(setMessages, updatedRunnerData.phone);
      } catch (err) {
        console.error("Registration failed:", err);
        setMessages(prev => prev.filter(m => m.text !== "In progress..."));

        const errorMessage =
          typeof err === "string" ? err : JSON.stringify(err) || "Registration failed. Please try again.";

        // Show the error so user can see what went wrong
        setMessages(prev => [
          ...prev,
          {
            id: Date.now(),
            from: "them",
            text: `Registration failed: ${errorMessage}`,
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            status: "delivered",
          },
        ]);

        // Reset data and restart from the first question
        setRunnerData({ name: "", phone: "", email: "", fleetType: "", role: "runner", serviceType: serviceTypeRef.current || "" });
        setLastValidatedField(null);

        setTimeout(() => {
          setCredentialStep(0);
          setIsCollectingCredentials(true);
          setMessages(prev => [
            ...prev,
            {
              id: Date.now() + 1,
              from: "them",
              text: `Let's start over. ${CREDENTIAL_QUESTIONS[0].question}`,
              time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              status: "delivered",
              isCredential: true,
            },
          ]);
        }, 800);

      } finally {
        setIsSubmitting(false);
      }
    };

    setTimeout(submitWhenReady, 800);
  }, [credentialStep, runnerData, locationResolved, runnerLocation, dispatch, serviceTypeRef, showOtpVerification]);


  const handleOtpVerification = useCallback(async (otp, setMessages) => {
    if (!otp || !tempUserData) return;

    setMessages(prev => [
      ...prev,
      {
        id: Date.now() + 1,
        from: "them",
        text: "Verifying OTP...",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "delivered",
      },
    ]);

    try {
      const result = await dispatch(
        verifyPhone({ phone: tempUserData.phone, otp })
      ).unwrap();


      setMessages(prev => {
        const filtered = prev.filter(m => m.text !== "Verifying OTP...");
        return [
          ...filtered,
          {
            id: Date.now(),
            from: "them",
            text: "Registration successful, welcome to sendrey!",
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            status: "delivered",
          },
        ];
      });

      setNeedsOtpVerification(false);
      setRegistrationComplete(true);
      setError(null);
      setIsCollectingCredentials(false);
      setCredentialStep(null);

      const registeredRunnerData = result.data?.user || result.user;
      const token = result.token || result.data?.token;
      const refreshToken = result.refreshToken || result.data?.refreshToken;

      if (token) await authStorage.setTokens(token, refreshToken);
      setRunnerData(prev => ({ ...prev, ...registeredRunnerData }));

      if (onRegistrationSuccess && registeredRunnerData) {
        onRegistrationSuccess(registeredRunnerData);
      }
    } catch (err) {
      console.error("OTP verification failed:", err);
      setError(err);
    }
  }, [dispatch, tempUserData, onRegistrationSuccess]);

  // ── Reset ────────────────────────────────────────────────────────────────
  const resetCredentialFlow = () => {
    setIsCollectingCredentials(false);
    setCredentialStep(null);
    setNeedsOtpVerification(false);
    setRunnerData({ name: "", phone: "", email: "", fleetType: "", role: "runner" });
    setRunnerLocation(null);
    setLocationResolved(false);
    resolvedRef.current = false;
    bestPositionRef.current = null;
    attemptCountRef.current = 0;
    serviceTypeRef.current = null;
  };

  return {
    isCollectingCredentials,
    credentialStep,
    credentialQuestions: CREDENTIAL_QUESTIONS,
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
    isSubmitting,
    runnerLocation,
  };
};