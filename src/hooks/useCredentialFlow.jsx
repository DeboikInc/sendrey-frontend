import { useState, useEffect, useRef, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  verifyPhone, resendPhoneVerification, // eslint-disable-line no-unused-vars
  register,
  sendReturningUserEmailOTP,
  verifyEmailOTP, resendEmailVerification,
} from "../Redux/authSlice";
import { authStorage } from '../utils/authStorage';

// ─── Geolocation config ───────────────────────────────────────────────────────
const GEO_OPTIONS = {
  enableHighAccuracy: false,
  timeout: 15000,
  maximumAge: 0,
};
const MAX_WATCH_DURATION = 15000;

const CREDENTIAL_QUESTIONS = [
  { question: "What's your name?", field: "name" },
  { question: "What's your phone number?", field: "phone" },
  { question: "What's your email address?", field: "email" },
  { question: "What's your fleet type? (bike, car, motorcycle, van)", field: "fleetType", isFleetSelection: true },
];


// ─── Greeting builder ─────────────────────────────────────────────────────────
// Kept outside the hook so it's pure and testable.
// All branch logic lives here — the catch block just calls it.

const buildReturningUserGreeting = (name, kycStatus = {}) => {
  const {
    isVerified,
    ninStatus,
    driverLicenseStatus,
    selfieVerified,
  } = kycStatus;

  const ninVerified = ninStatus === 'verified';
  const licenseVerified = driverLicenseStatus === 'verified';
  const ninPending = ['pending', 'pending_review'].includes(ninStatus);
  const licensePending = ['pending', 'pending_review'].includes(driverLicenseStatus);
  const ninSubmitted = ninStatus !== 'not_submitted';
  const licenseSubmitted = driverLicenseStatus !== 'not_submitted';

  const idVerified = ninVerified || licenseVerified;
  const idPending = !idVerified && (ninPending || licensePending);
  const idSubmitted = ninSubmitted || licenseSubmitted;

  // Which specific ID is still missing (for the "one submitted" case)
  const missingId = ninSubmitted && !licenseSubmitted ? "driver's license"
    : licenseSubmitted && !ninSubmitted ? 'NIN'
      : null;

  console.log('missing id', missingId);

  // OTP??
  if (!isVerified) {
    return `Hi ${name}, looks like you started signing up before! Would you like to continue where you left off?`;
  }

  if (idVerified && selfieVerified) {
    return `Hi ${name}, would you like to continue as ${name}?`;
  }

  if (idVerified && !selfieVerified) {
    return `Hi ${name}, welcome back! You just need to take your selfie to unlock orders. Continue as ${name}?`;
  }

  if (idPending) {
    return `Hi ${name}, welcome back! Your ID is still being reviewed. Continue as ${name}?`;
  }

  if (idSubmitted && missingId) {
    return `Hi ${name}, welcome back! You still need to upload your ${missingId}. Continue as ${name}?`;
  }

  // Neither ID submitted at all
  return `Hi ${name}, welcome back! You still need to upload your ID to start taking orders. Continue as ${name}?`;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────
export const useCredentialFlow = (serviceTypeRef, onRegistrationSuccess) => {
  const dispatch = useDispatch();
  const { runner } = useSelector((s) => s.auth);
  const [registrationComplete, setRegistrationComplete] = useState(false);

  const [isCollectingCredentials, setIsCollectingCredentials] = useState(false);
  const [credentialStep, setCredentialStep] = useState(null);
  const [needsOtpVerification, setNeedsOtpVerification] = useState(false);
  const [tempUserData, setTempUserData] = useState(null);
  const [error, setError] = useState(null);
  const [isShowingOtp, setIsShowingOtp] = useState(false);
  const [lastValidatedField, setLastValidatedField] = useState(null); // eslint-disable-line no-unused-vars
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [runnerData, setRunnerData] = useState(() => runner ? {
    name: `${runner.firstName || ''} ${runner.lastName || ''}`.trim(),
    phone: runner.phone || '',
    email: runner.email || '',
    fleetType: runner.fleetType || '',
    role: 'runner',
    serviceType: runner.serviceType || '',
  } : {
    name: '', phone: '', email: '', fleetType: '', role: 'runner', serviceType: '',
  });

  // Location state
  const [runnerLocation, setRunnerLocation] = useState(null);
  const [locationResolved, setLocationResolved] = useState(false);

  const bestPositionRef = useRef(null);
  const watchIdRef = useRef(null);
  const watchTimerRef = useRef(null);
  const attemptCountRef = useRef(0);
  const resolvedRef = useRef(false);
  const isAnsweringRef = useRef(false);

  const [isReturningUser, setIsReturningUser] = useState(false);
  const [returningUserData, setReturningUserData] = useState(null);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);



  useEffect(() => {
    if (runner?._id && !registrationComplete) {
      setRegistrationComplete(true);
    }
  }, [runner?._id, registrationComplete]);

  // ── Finalise location ────────────────────────────────────────────────────
  const finaliseLocation = useCallback(() => {
    if (resolvedRef.current) return;

    // If we have no location after 15 seconds, try one more time with different options
    if (!bestPositionRef.current) {
      console.log("[geo] No location yet, trying one more time with different options...");
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude, accuracy } = pos.coords;
          bestPositionRef.current = { latitude, longitude, accuracy };
          console.log(`[geo] Retry got fix (${accuracy.toFixed(1)}m)`);
          resolvedRef.current = true;
          setRunnerLocation({ latitude, longitude });
          setLocationResolved(true);
        },
        (err) => {
          console.warn(`[geo] Retry failed: ${err.message}`);
          resolvedRef.current = true;
          setLocationResolved(true);
        },
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 30000 }
      );
      return;
    }

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
      console.log(`[geo] Settled on fix — accuracy: ${bestPositionRef.current.accuracy?.toFixed(1)}m`);
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
    };

    // Try getCurrentPosition first (faster)
    navigator.geolocation.getCurrentPosition(onSuccess, onError, GEO_OPTIONS);

    watchIdRef.current = navigator.geolocation.watchPosition(
      onSuccess,
      (err) => {
        console.warn(`[geo] Watch error (code ${err.code}): ${err.message}`);
        finaliseLocation(); // Finalise on watch error
      },
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
    console.log('[CRED] startCredentialFlow called', { serviceType });
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
  const showOtpVerification = useCallback((setMessages, phone, email) => {
    if (isShowingOtp) return;
    setIsShowingOtp(true);
    // const phoneDisplay = phone || runnerData.phone;
    const emailDisplay = email || runnerData.email;
    setMessages(prev => [...prev, {
      id: Date.now() + 1,
      from: "them",
      text: "We have sent you an OTP to confirm your email",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "delivered",
    }]);
    setTimeout(() => {
      setMessages(prev => [...prev, {
        id: Date.now() + 2,
        from: "them",
        // text: `Enter the OTP we sent to ${phoneDisplay}, \n \nDidn't receive OTP? Resend`,
        text: `Enter the OTP we sent to ${emailDisplay}, \n \nDidn't receive OTP? Resend`,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "delivered",
        hasResendLink: true,
      }]);
    }, 1000);
  }, [isShowingOtp, runnerData.email]);

  const handleCredentialAnswer = useCallback(async (answer, setText, setMessages) => {
    if (isAnsweringRef.current) return;
    isAnsweringRef.current = true;
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
        isAnsweringRef.current = false;
      }, 800);
      return;
    }

    // Last question answered — inline validation before hitting server
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

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^\+?[0-9]{7,15}$/;

    if (!emailRegex.test(updatedRunnerData.email?.trim())) {
      const emailIdx = CREDENTIAL_QUESTIONS.findIndex(q => q.field === 'email');
      setMessages(prev => prev.filter(m => m.text !== 'In progress...'));
      setMessages(prev => [...prev, {
        id: Date.now() + 2,
        from: "them",
        text: `Please provide a valid email address. ${CREDENTIAL_QUESTIONS[emailIdx].question}`,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "delivered",
        isCredential: true,
      }]);
      setRunnerData({ ...updatedRunnerData, email: '' });
      setCredentialStep(emailIdx);
      setIsCollectingCredentials(true);
      isAnsweringRef.current = false;
      return;
    }

    if (!phoneRegex.test(updatedRunnerData.phone?.trim())) {
      const phoneIdx = CREDENTIAL_QUESTIONS.findIndex(q => q.field === 'phone');
      setMessages(prev => prev.filter(m => m.text !== 'In progress...'));
      setMessages(prev => [...prev, {
        id: Date.now() + 2,
        from: "them",
        text: `Please provide a valid phone number with country code (e.g., +2348012345678). ${CREDENTIAL_QUESTIONS[phoneIdx].question}`,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "delivered",
        isCredential: true,
      }]);
      setRunnerData({ ...updatedRunnerData, phone: '' });
      setCredentialStep(phoneIdx);
      setIsCollectingCredentials(true);
      isAnsweringRef.current = false;
      return;
    }

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
        // serviceType: serviceTypeRef.current,
        isOnline: true,
        isAvailable: true,
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        ...(runnerLocation && {
          latitude: runnerLocation.latitude,
          longitude: runnerLocation.longitude,
        }),
      };

      console.log("sending runner registration payload", payload);

      try {
        await dispatch(register(payload)).unwrap();
        setTempUserData(updatedRunnerData);
        setMessages(prev => prev.filter(m => m.text !== "In progress..."));
        setNeedsOtpVerification(true);
        setIsCollectingCredentials(false);
        setCredentialStep(null);
        showOtpVerification(setMessages, updatedRunnerData.email);
      } catch (err) {
        console.error("Registration failed:", err);
        console.log('[CRED] registration error raw:', JSON.stringify(err, null, 2));
        console.log('[CRED] registration error keys:', Object.keys(err || {}));

        setMessages(prev => prev.filter(m => m.text !== "In progress..."));

        const is409 = typeof err === 'object' && err !== null
          ? (err?.status === 409 || err?.statusCode === 409)
          : false;

        const errorMessage = typeof err === 'string'
          ? err
          : err?.message || err?.data?.message || 'Registration failed. Please try again.';

        console.log('[CRED] errorMessage resolved to:', errorMessage);
        console.log('[CRED] is409:', is409);

        const isExisting = is409 ||
          errorMessage.toLowerCase().includes("already exist") ||
          errorMessage.toLowerCase().includes("already registered");

        if (isExisting) {
          const serverName = err?.data?.userName || err?.userName || updatedRunnerData.name.trim().split(" ")[0];
          const kycStatus = err?.data?.kycStatus || err?.kycStatus || {};
          const greetingText = buildReturningUserGreeting(serverName, kycStatus);

          setReturningUserData({
            ...updatedRunnerData,
            firstName: serverName,
            kycStatus: {
              isVerified: kycStatus?.isVerified ?? false,
              ninStatus: kycStatus?.ninStatus ?? 'not_submitted',
              driverLicenseStatus: kycStatus?.driverLicenseStatus ?? 'not_submitted',
              selfieVerified: kycStatus?.selfieVerified ?? false,
              selfieStatus: kycStatus?.selfieStatus ?? 'not_submitted',
              overallVerified: kycStatus?.overallVerified ?? false,
            }
          });
          setTempUserData(updatedRunnerData);
          setIsReturningUser(true);
          setIsCollectingCredentials(false);
          setCredentialStep(null);

          setMessages(prev => [...prev, {
            id: Date.now(),
            from: "them",
            text: greetingText,
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            status: "delivered",
          }]);
        } else {
          // Show the error message
          setMessages(prev => [...prev, {
            id: Date.now(),
            from: "them",
            text: errorMessage,
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            status: "delivered",
          }]);

          // Identify which field failed and only wipe that field
          const fieldHints = {
            phone: ['phone', 'number', 'mobile'],
            email: ['email', 'mail'],
            fleetType: ['fleet', 'vehicle', 'type'],
            name: ['name', 'first', 'last'],
          };

          let failedFieldIndex = CREDENTIAL_QUESTIONS.length - 1;
          const lowerError = errorMessage.toLowerCase();

          for (const [field, hints] of Object.entries(fieldHints)) {
            if (hints.some(h => lowerError.includes(h))) {
              const idx = CREDENTIAL_QUESTIONS.findIndex(q => q.field === field);
              if (idx !== -1) { failedFieldIndex = idx; break; }
            }
          }

          // Only wipe the failed field, keep all other valid answers
          const resetData = { ...updatedRunnerData };
          resetData[CREDENTIAL_QUESTIONS[failedFieldIndex].field] = '';
          setRunnerData(resetData);
          setLastValidatedField(null);

          Promise.resolve().then(() => {
            setCredentialStep(failedFieldIndex);
            setIsCollectingCredentials(true);
            setMessages(prev => [...prev, {
              id: Date.now() + 1,
              from: "them",
              text: `Let's fix that. ${CREDENTIAL_QUESTIONS[failedFieldIndex].question}`,
              time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              status: "delivered",
              isCredential: true,
            }]);
          });
        }
      } finally {
        setIsSubmitting(false);
        isAnsweringRef.current = false;
      }
    };

    setTimeout(submitWhenReady, 800);
  }, [credentialStep, runnerData, locationResolved, runnerLocation, dispatch, serviceTypeRef, showOtpVerification]);

  const handleOtpVerification = useCallback(async (otp, setMessages) => {
    if (!otp || !tempUserData) return;

    setIsVerifyingOtp(true);

    setMessages(prev => [
      ...prev,
      {
        id: Date.now() + 1,
        from: "them",
        text: "Verifying OTP...",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "delivered",
      },
      // disable input
    ]);

    try {
      // const result = await dispatch(
      //   verifyPhone({ phone: tempUserData.phone, otp })
      // ).unwrap();

      const result = await dispatch(verifyEmailOTP({ otp, userType: 'runner' })).unwrap();

      const isReturning = !!returningUserData?.kycStatus;
      const displayName = returningUserData?.firstName || tempUserData?.name?.split(' ')[0] || '';

      setMessages(prev => {
        const filtered = prev.filter(m => m.text !== "Verifying OTP...");
        return [
          ...filtered,
          {
            id: Date.now(),
            from: "them",
            text: isReturning
              ? `Welcome back ${displayName}! I'm glad to have you back onboard.`
              : "Registration successful, welcome to sendrey!",
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            status: "delivered",
          },
        ];
      });

      console.log('[otp success] isReturning:', !!returningUserData?.kycStatus);
      console.log('[otp success] returningUserData:', returningUserData);

      const registeredRunnerData = result.data?.runner || result.runner || result.data?.user || result.user;;
      const token = result.token || result.data?.token;
      const refreshToken = result.refreshToken || result.data?.refreshToken;

      setNeedsOtpVerification(false);
      if (onRegistrationSuccess && registeredRunnerData) {
        onRegistrationSuccess(registeredRunnerData);
      }

      setRegistrationComplete(true);
      console.log('[CRED] registrationComplete SET TRUE — runner in store at this moment:', runner?._id,
        'returningUserData:', returningUserData?.kycStatus,
        'isFreshRegistrationRef will be set by onRegistrationSuccess callback'
      );
      setError(null);
      setIsCollectingCredentials(false);
      setCredentialStep(null);


      const freshKycStatus = registeredRunnerData?.kycStatus ?? null;
      console.log('[CRED] OTP verified — registrationComplete=true firing now', { returningUserData, freshKycStatus });
      if (freshKycStatus && returningUserData) {
        setReturningUserData(prev => ({
          ...prev,
          kycStatus: {
            isVerified: freshKycStatus.isVerified ?? prev?.kycStatus?.isVerified ?? false,
            ninStatus: freshKycStatus.ninStatus ?? prev?.kycStatus?.ninStatus ?? 'not_submitted',
            driverLicenseStatus: freshKycStatus.driverLicenseStatus ?? prev?.kycStatus?.driverLicenseStatus ?? 'not_submitted',
            selfieVerified: freshKycStatus.selfieVerified ?? prev?.kycStatus?.selfieVerified ?? false,
            selfieStatus: freshKycStatus.selfieStatus ?? prev?.kycStatus?.selfieStatus ?? 'not_submitted',
            overallVerified: freshKycStatus.overallVerified ?? prev?.kycStatus?.overallVerified ?? false,
          }
        }));
      }

      if (token) await authStorage.setTokens(token, refreshToken);
      setRunnerData(prev => ({ ...prev, ...registeredRunnerData }));
      setIsVerifyingOtp(false);
    } catch (err) {
      console.error("OTP verification failed:", err);
      setError(err);
      setIsVerifyingOtp(false);

      setMessages(prev => {
        const filtered = prev.filter(m => m.text !== "Verifying OTP...");
        return [...filtered, {
          id: Date.now(),
          from: "them",
          text: err?.message || err?.data?.message || "Invalid OTP. Please try again.",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          status: "delivered",
          isError: true,
        }];
      });

    }
  }, [dispatch, tempUserData, onRegistrationSuccess, returningUserData, runner?._id]);

  // useCredentialFlow.js — handleResendOtp
  const handleResendOtp = useCallback(async (setMessages) => {
    if (!tempUserData?.email) return;

    try {
      if (isReturningUser || returningUserData) {
        // Returning (already-verified) runner — use the returning-user OTP endpoint
        await dispatch(sendReturningUserEmailOTP({
          email: tempUserData.email,
          userType: 'runner',
        })).unwrap();
      } else {
        // Fresh registration — standard resend
        await dispatch(resendEmailVerification({ email: tempUserData.email })).unwrap();
      }

      setMessages(prev => [...prev, {
        id: Date.now(),
        from: "them",
        text: "OTP has been resent to your email",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "delivered",
      }]);
    } catch (err) {
      console.error("Resend OTP failed:", err);
      setMessages(prev => [...prev, {
        id: Date.now(),
        from: "them",
        text: "Failed to resend OTP. Please try again.",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "delivered",
        isError: true,
      }]);
    }
  }, [dispatch, tempUserData, isReturningUser, returningUserData]);

  const handleReturningUserChoice = useCallback(async (choice, setMessages) => {
    console.log('[CRED] handleReturningUserChoice', { choice, returningUserData });

    if (choice === "no") {
      // Reset everything and start fresh
      setIsReturningUser(false);
      setReturningUserData(null);
      setTempUserData(null);
      setRunnerData({ name: "", phone: "", email: "", fleetType: "", role: "runner", serviceType: serviceTypeRef.current || "" });

      setMessages(prev => [...prev, {
        id: Date.now(), from: "me", text: "No",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "sent",
      }]);

      setMessages(prev => [...prev, {
        id: Date.now() + 1, from: "them", text: "In progress...",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "delivered",
      }]);

      setTimeout(() => {
        setMessages(prev => prev.filter(m => m.text !== "In progress..."));
        setCredentialStep(0);
        setIsCollectingCredentials(true);
        setMessages(prev => [...prev, {
          id: Date.now() + 1, from: "them",
          text: `No problem! Let's start fresh. ${CREDENTIAL_QUESTIONS[0].question}`,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          status: "delivered", isCredential: true,
        }]);
      }, 500);
      return;
    }

    // ── Yes — send OTP to their email and drop into verification ──────────
    setMessages(prev => [...prev, {
      id: Date.now(), from: "me", text: "Yes",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "sent",
    }]);

    setMessages(prev => [...prev, {
      id: Date.now() + 1, from: "them", text: "In progress...",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "delivered",
    }]);

    let latitude = null, longitude = null;

    try {
      const pos = await new Promise((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000 })
      );
      latitude = pos.coords.latitude;
      longitude = pos.coords.longitude;
    } catch (_) { }

    try {
      const result = await dispatch(sendReturningUserEmailOTP({
        email: returningUserData.email,
        userType: 'runner',
        ...(latitude !== null && { latitude, longitude }),
      })).unwrap();

      // seed fleetType from response
      if (result?.fleetType) {
        setRunnerData(prev => ({ ...prev, fleetType: result.fleetType }));
        setReturningUserData(prev => ({ ...prev, fleetType: result.fleetType }));
      }

      setMessages(prev => prev.filter(m => m.text !== "In progress..."));
      // sendReturningUserEmailOTP
      // sendReturningUserSMSOTP
      setIsReturningUser(false);
      setNeedsOtpVerification(true);
      showOtpVerification(setMessages, returningUserData.email);
    } catch (err) {
      console.error("Failed to send OTP to returning runner:", err);
      setMessages(prev => prev.filter(m => m.text !== "In progress..."));
      setMessages(prev => [...prev, {
        id: Date.now(), from: "them",
        text: err?.message || err?.data?.message || "Failed to send OTP. Please try again.",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "delivered", isError: true,
      }]);
      throw err;
    }
  }, [dispatch, returningUserData, serviceTypeRef, showOtpVerification]);

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
    handleResendOtp,
    error,
    setError,
    isSubmitting,
    runnerLocation,
    isReturningUser,
    returningUserData,
    handleReturningUserChoice,
    collectedFleetType: runnerData.fleetType || null,
    isVerifyingOtp
  };
};