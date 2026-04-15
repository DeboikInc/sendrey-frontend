// hooks/useKycHook.js
import { useState, useCallback, useRef, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { verifyNIN, verifyDriverLicense, verifySelfie, getVerificationStatus } from '../Redux/kycSlice';


// ─── Maps server kycStatus → the correct step to resume from ─────────────────
// Called once after a returning user completes OTP, before startKycFlow runs.

const resolveResumeStep = (kycStatus = {}, fleetType) => {
  const {
    ninStatus,
    driverLicenseStatus,
    selfieVerified,
  } = kycStatus;

  const isPedestrian = fleetType === 'pedestrian';
  const ninDone = ['verified', 'pending', 'pending_review'].includes(ninStatus);
  const licenseDone = ['verified', 'pending', 'pending_review'].includes(driverLicenseStatus);
  const needsLicense = !isPedestrian && !licenseDone;

  // Selfie already submitted — go straight to connect (step 6)
  if (selfieVerified || kycStatus.selfieStatus === 'pending_review') return 6;

  // Both required docs done — go to selfie prompt (step 3)
  if (ninDone && (isPedestrian || licenseDone)) return 3;

  // NIN done, still needs driver's license
  if (ninDone && needsLicense) return { step: 2, nextDoc: 'driverLicense' };

  // Nothing submitted yet — start from top
  return null;
};



export const useKycHook = (runnerId, fleetType) => {
  const dispatch = useDispatch();
  const [kycStep, setKycStep] = useState(null);

  const [kycStatus, setKycStatus] = useState({
    documentVerified: false,
    selfieVerified: false,
    overallVerified: false
  });
  const lastCheckedStatusRef = useRef(null);
  const [showConnectButton, setShowConnectButton] = useState(false);

  const isAlreadyVerifiedRef = useRef(false);
  const capturedIdPhotoRef = useRef(null);
  const capturedSelfiePhotoRef = useRef(null);
  const kycInitiated = useRef(false);
  const verifyInProgress = useRef(false);
  // Track which doc is currently being collected: 'nin' | 'driverLicense'
  const currentDocTypeRef = useRef('nin');

  useEffect(() => {
    kycInitiated.current = false;
    verifyInProgress.current = false;
    capturedIdPhotoRef.current = null;
    capturedSelfiePhotoRef.current = null;
    currentDocTypeRef.current = 'nin';
  }, [runnerId]);

  useEffect(() => {
    if (!runnerId || kycStep !== null) return;
    try {
      const saved = JSON.parse(localStorage.getItem(`kyc_step_${runnerId}`));
      if (saved !== null && saved !== undefined) setKycStep(saved);
    } catch { }
  }, [runnerId, kycStep]);

  useEffect(() => {
    if (!runnerId) return;
    const saved = localStorage.getItem(`kyc_doc_type_${runnerId}`);
    if (saved) currentDocTypeRef.current = saved;
  }, [runnerId]);

  useEffect(() => {
    if (!runnerId || kycStep === null) return;
    localStorage.setItem(`kyc_step_${runnerId}`, JSON.stringify(kycStep));
  }, [kycStep, runnerId]);

  const fleetTypeRef = useRef(fleetType);
  useEffect(() => { fleetTypeRef.current = fleetType; }, [fleetType]);

  const setDocType = useCallback((type) => {
    currentDocTypeRef.current = type;
    if (runnerId) localStorage.setItem(`kyc_doc_type_${runnerId}`, type);
  }, [runnerId]);

  const startKycFlow = useCallback((setMessages) => {
    console.log('[KYC] startKycFlow called', { kycInitiated: kycInitiated.current, });
    if (kycInitiated.current) {
      console.log('[KYC] startKycFlow BLOCKED — already initiated');
      return
    };

    // block if already verified in local state
    if (kycStatus.overallVerified || kycStatus.selfieVerified) {
      console.log('[KYC] startKycFlow BLOCKED — already verified');
      kycInitiated.current = true;
      return;
    }

    kycInitiated.current = true;
    setKycStep(1);

    setTimeout(() => {
      setMessages(prev => [...prev, {
        id: `kyc-${Date.now()}-1`,
        from: "them",
        text: "Before you can start rendering services, I need to verify you.",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "delivered",
        isKyc: true
      }]);

      setTimeout(() => {
        const idMessage = fleetTypeRef.current === 'pedestrian'
          ? "To get you approved, I'll need a valid government ID, preferably NIN or a valid document."
          : "To get you approved, I'll need two valid government IDs. preferably NIN and a Driver's License.";

        setMessages(prev => [...prev, {
          id: `kyc-${Date.now()}-2`,
          from: "them",
          text: idMessage,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          status: "delivered",
          isKyc: true,
        }]);

        setTimeout(() => {
          // Ask for NIN first for everyone
          setMessages(prev => [...prev, {
            id: `kyc-${Date.now()}-3`,
            from: "them",
            text: "Kindly provide your NIN.",
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            status: "delivered",
            isKyc: true,
          }]);

          setDocType('nin');
          setTimeout(() => setKycStep(2), 700);
        }, 700);
      }, 700);
    }, 500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resumeKycFlow = useCallback((serverKycStatus, setMessages) => {
    console.log('[KYC] resumeKycFlow called', { serverKycStatus, kycInitiated: kycInitiated.current, fleetType: fleetTypeRef.current });
    if (kycInitiated.current) {
      console.log('[KYC] resumeKycFlow BLOCKED — already initiated');
      return
    };

    const isFullyVerified = serverKycStatus?.selfieVerified ||
      serverKycStatus?.selfieStatus === 'pending_review' ||
      serverKycStatus?.overallVerified;

    if (isFullyVerified) {
      kycInitiated.current = true;
      setKycStatus({ documentVerified: true, selfieVerified: true, overallVerified: true });
      setKycStep(6);
      return;
    }

    kycInitiated.current = true;

    if (!isFullyVerified) {
      // only set the ref for partial states where we want to suppress duplicate status messages
      isAlreadyVerifiedRef.current = false;
    }

    const resume = resolveResumeStep(serverKycStatus, fleetTypeRef.current);

    if (resume === null) {
      kycInitiated.current = false;
      startKycFlow(setMessages);
      return;
    }

    const step = typeof resume === 'object' ? resume.step : resume;
    const docType = typeof resume === 'object' ? resume.nextDoc : null;

    if (docType) setDocType(docType);

    // ── Fully verified: set status + step silently, one clean message ────────
    if (step === 6) {
      setKycStatus({ documentVerified: true, selfieVerified: true, overallVerified: true });
      setKycStep(6);

      setMessages(prev => [...prev, {
        id: `kyc-resume-${Date.now()}`,
        from: "them",
        text: "Welcome back! Click the button below to connect to a user.",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "delivered",
        isKyc: true,
      }]);
      return; // ← exit early, never reaches checkVerificationStatus path
    }

    // ── Partial progress 
    const promptText = step === 3
      ? "Welcome back! You just need to take your selfie to complete verification."
      : docType === 'driverLicense'
        ? "Welcome back! You still need to provide your Driver's License."
        : "Welcome back! Let's continue your verification.";

    setMessages(prev => [...prev, {
      id: `kyc-resume-${Date.now()}`,
      from: "them",
      text: promptText,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "delivered",
      isKyc: true,
    }]);

    setTimeout(() => setKycStep(step), 600);
  }, [startKycFlow, setDocType]);

  const onIdVerified = useCallback((photo, setMessages) => {
    capturedIdPhotoRef.current = photo;
    setKycStep(1);

    setTimeout(() => {
      setMessages(prev => [...prev, {
        id: `kyc-img-${Date.now()}`,
        from: "me",
        type: "image",
        fileUrl: photo,
        text: "",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "sent",
        isKyc: true
      }]);

      // Auto-submit using currentDocTypeRef — no need to ask ID type
      setTimeout(() => {
        setMessages(prev => [...prev, {
          id: `kyc-submitting-${Date.now()}`,
          from: "them",
          text: "Submitting your document for verification...",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          status: "delivered",
          isKyc: true
        }]);

        handleIDTypeSelection(currentDocTypeRef.current, setMessages);
      }, 500);
    }, 500);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleIDTypeSelection = useCallback(async (idType, setMessages) => {
    if (verifyInProgress.current) return;

    const photo = capturedIdPhotoRef.current;

    if (!photo) {
      console.error('No photo captured!');
      setMessages(prev => [...prev, {
        id: `kyc-err-${Date.now()}`,
        from: "them",
        text: "No photo found. Please try capturing again.",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "delivered",
        isKyc: true
      }]);
      setKycStep(2);
      return;
    }

    verifyInProgress.current = true;
    setKycStep(1);

    setTimeout(async () => {
      const base64ToFile = (base64, filename) => {
        try {
          const base64Data = base64.replace(/^data:image\/(jpeg|jpg|png|webp);base64,/, '');
          const byteCharacters = atob(base64Data);
          const byteArray = new Uint8Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteArray[i] = byteCharacters.charCodeAt(i);
          }
          const blob = new Blob([byteArray], { type: 'image/jpeg' });
          return new File([blob], filename, { type: 'image/jpeg' });
        } catch (error) {
          console.error('Error converting base64 to file:', error);
          return null;
        }
      };

      const file = base64ToFile(photo, 'id_document.jpg');

      if (!file) {
        setMessages(prev => [...prev, {
          id: `kyc-err-${Date.now()}`,
          from: "them",
          text: "I couldn't process the image. Please try again.",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          status: "delivered",
          isKyc: true
        }]);
        setKycStep(2);
        verifyInProgress.current = false;
        return;
      }

      try {

        const result = currentDocTypeRef.current === 'driverLicense'
          ? await dispatch(verifyDriverLicense(file))
          : await dispatch(verifyNIN(file));
        verifyInProgress.current = false;

        if (result.type.includes('fulfilled')) {
          setMessages(prev => [...prev, {
            id: `kyc-success-${Date.now()}`,
            from: "them",
            text: "Your document has been submitted successfully and is under review. Kindly exercise patience, we'll get back to you soon.",
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            status: "delivered",
            isKyc: true
          }]);

          if (fleetTypeRef.current === 'pedestrian') {
            // Pedestrian — NIN only, proceed to selfie
            setTimeout(() => {
              setMessages(prev => [...prev, {
                id: `kyc-selfie-prompt-${Date.now()}`,
                from: "them",
                text: "You need to take a quick selfie so I can confirm it's really you.",
                time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                status: "delivered",
                isKyc: true
              }]);
              setTimeout(() => setKycStep(3), 800);
            }, 1000);

          } else if (currentDocTypeRef.current === 'nin') {
            // Non-pedestrian just submitted NIN — now ask for driver's license
            setDocType('driverLicense');
            capturedIdPhotoRef.current = null;

            setTimeout(() => {
              setMessages(prev => [...prev, {
                id: `kyc-dl-prompt-${Date.now()}`,
                from: "them",
                text: "Kindly provide your Driver's License.",
                time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                status: "delivered",
                isKyc: true
              }]);
              setTimeout(() => setKycStep(2), 800);
            }, 1000);

          } else {
            // Non-pedestrian just submitted driver's license — proceed to selfie
            setTimeout(() => {
              setMessages(prev => [...prev, {
                id: `kyc-selfie-prompt-${Date.now()}`,
                from: "them",
                text: "You need to take a quick selfie so I can confirm it's really you.",
                time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                status: "delivered",
                isKyc: true
              }]);
              setTimeout(() => setKycStep(3), 800);
            }, 1000);
          }

        } else {
          setMessages(prev => [...prev, {
            id: `kyc-err-${Date.now()}`,
            from: "them",
            text: "Document submission failed. Please try again.",
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            status: "delivered",
            isKyc: true
          }]);
          setTimeout(() => setKycStep(2), 700);
        }
      } catch (error) {
        console.error('Dispatch error:', error);
        verifyInProgress.current = false;
        setMessages(prev => [...prev, {
          id: `kyc-err-${Date.now()}`,
          from: "them",
          text: "Document submission failed. Please try again.",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          status: "delivered",
          isKyc: true
        }]);
        setTimeout(() => setKycStep(2), 700);
      }
    }, 1500);
  }, [dispatch, setDocType]);

  const handleSelfieResponse = useCallback((response, setMessages) => {
    if (response === 'okay') {
      setTimeout(() => {
        setMessages(prev => [...prev, {
          id: `kyc-selfie-ok-${Date.now()}`,
          from: "them",
          text: "Please ensure your face is visible and there is enough light where you are, thanks!",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          status: "delivered",
          isKyc: true
        }]);
      }, 500);
      setTimeout(() => setKycStep(5), 600);
    }
  }, []);

  const onSelfieVerified = useCallback(async (photo, setMessages) => {
    capturedSelfiePhotoRef.current = photo;
    setKycStep(1);

    setTimeout(async () => {
      setMessages(prev => [...prev, {
        id: `kyc-selfie-img-${Date.now()}`,
        from: "me",
        type: "image",
        fileUrl: photo,
        text: "",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "sent",
        isKyc: true
      }]);

      setTimeout(async () => {
        setMessages(prev => [...prev, {
          id: `kyc-selfie-submitting-${Date.now()}`,
          from: "them",
          text: "Submitting your selfie for verification...",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          status: "delivered",
          isKyc: true
        }]);

        try {
          const res = await fetch(photo);
          const blob = await res.blob();
          const file = new File([blob], "selfie.jpg", { type: "image/jpeg" });
          const result = await dispatch(verifySelfie(file));

          if (result.type.includes('fulfilled')) {
            setMessages(prev => [...prev, {
              id: `kyc-selfie-done-${Date.now()}`,
              from: "them",
              text: "Great! Your selfie has been submitted for review. You'll be notified once verification is complete.",
              time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              status: "delivered",
              isKyc: true
            }]);

            setKycStatus({ documentVerified: true, selfieVerified: true, overallVerified: false });
            setKycStep(6);

            localStorage.removeItem(`kyc_step_${runnerId}`);
            localStorage.removeItem(`kyc_doc_type_${runnerId}`);
          } else {
            const errorMsg = result.payload?.message || "Selfie submission failed. Please try again.";
            setMessages(prev => [...prev, {
              id: `kyc-selfie-err-${Date.now()}`,
              from: "them",
              text: errorMsg,
              time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              status: "delivered",
              isKyc: true
            }]);
            setTimeout(() => setKycStep(5), 800);
          }
        } catch (err) {
          console.error('Selfie upload error:', err);
          setTimeout(() => setKycStep(5), 800);
        }
      }, 700);
    }, 500);
  }, [dispatch, runnerId]);

  const checkVerificationStatus = useCallback(async (setMessages, onBanned) => {
    console.log('[KYC] checkVerificationStatus called', { runnerId });
    if (!runnerId) {
      console.log('[KYC] checkVerificationStatus BLOCKED — no runnerId');
      return
    };
    try {
      const result = await dispatch(getVerificationStatus(runnerId));
      if (result.type.includes('rejected')) {
        // auth failure — stop polling silently
        if (result.payload?.status === 401) return;
      }
      if (!result.type.includes('fulfilled')) return;

      const { runnerStatus, documents, biometrics } = result.payload;

      if (runnerStatus === 'banned') {
        onBanned?.();
        return;
      }

      const currentStatusKey = `${documents.nin?.status}-${documents.driverLicense?.status}-${biometrics.status}-${runnerStatus}`;

      if (lastCheckedStatusRef.current === currentStatusKey) return;
      lastCheckedStatusRef.current = currentStatusKey;

      if (isAlreadyVerifiedRef.current) {
        isAlreadyVerifiedRef.current = false;
        return;
      }

      // ── If everything is approved, show ONE combined message ─────────────
      const allApproved = biometrics.status === 'approved' && biometrics.selfieVerified;

      if (allApproved) {
        setMessages(prev => {
          const alreadyShown = prev.some(m => m.text?.includes('Congratulations'));
          if (alreadyShown) return prev;
          return [...prev, {
            id: `kyc-verified-${Date.now()}`,
            from: "them",
            text: "Congratulations! Your documents have been verified.",
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            status: "delivered", isKyc: true
          }];
        });
        setKycStatus({ documentVerified: true, selfieVerified: true, overallVerified: true });
        setTimeout(() => setKycStep(6), 800);

        localStorage.removeItem(`kyc_step_${runnerId}`);
        localStorage.removeItem(`kyc_doc_type_${runnerId}`);
        return;
      }

      // ── Partial rejections/approvals ──────────────────────────────────────
      if (documents.nin?.status === 'rejected') {
        const reason = documents.nin.rejectionReason
          ? `❌ Your NIN verification was unsuccessful: ${documents.nin.rejectionReason}. Please reach out to support.`
          : "❌ Your NIN verification was unsuccessful. Please reach out to support.";
        setMessages(prev => [...prev, {
          id: `kyc-nin-rejected-${Date.now()}`,
          from: "them", text: reason,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          status: "delivered", isKyc: true
        }]);
      }
      if (documents.driverLicense?.status === 'rejected') {
        const reason = documents.driverLicense.rejectionReason
          ? `❌ Your Driver's License verification was unsuccessful: ${documents.driverLicense.rejectionReason}. Please reach out to support.`
          : "❌ Your Driver's License verification was unsuccessful. Please reach out to support.";
        setMessages(prev => [...prev, {
          id: `kyc-dl-rejected-${Date.now()}`,
          from: "them", text: reason,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          status: "delivered", isKyc: true
        }]);
      }
      if (biometrics.status === 'rejected') {
        const reason = biometrics.rejectionReason
          ? `❌ Your selfie verification was unsuccessful: ${biometrics.rejectionReason}. Please reach out to support.`
          : "❌ Your selfie verification was unsuccessful. Please reach out to support.";
        setMessages(prev => [...prev, {
          id: `kyc-selfie-rejected-${Date.now()}`,
          from: "them", text: reason,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          status: "delivered", isKyc: true
        }]);
      }
      if (runnerStatus === 'banned') {
        setMessages(prev => [...prev, {
          id: `kyc-banned-${Date.now()}`,
          from: "them",
          text: "🚫 Your account has been suspended. Please contact support at support@sendrey.com.",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          status: "delivered", isKyc: true
        }]);
      }
    } catch (error) {
      console.error('Error checking verification status:', error);
    }
  }, [dispatch, runnerId]);

  const SELFIE_TRIGGERS = ['okay', 'alright', 'sure', 'yes', 'ok'];

  const handleRunnerMessage = useCallback((text, setMessages) => {
    const normalized = text.trim().toLowerCase();
    const isTrigger = SELFIE_TRIGGERS.includes(normalized);

    if (isTrigger && kycStep === 3) {
      setMessages(prev => [...prev, {
        id: `kyc-runner-${Date.now()}`,
        from: 'me',
        text,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'sent',
        isKyc: true
      }]);
      handleSelfieResponse('okay', setMessages);
      return true;
    }

    return false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kycStep, handleSelfieResponse]);

  return {
    kycStep,
    kycStatus,
    setKycStep,
    capturedIdPhoto: capturedIdPhotoRef.current,
    startKycFlow,
    resumeKycFlow,
    onIdVerified,
    handleIDTypeSelection,
    handleSelfieResponse,
    onSelfieVerified,
    checkVerificationStatus,
    showConnectButton,
    setShowConnectButton,
    handleRunnerMessage
  };
};