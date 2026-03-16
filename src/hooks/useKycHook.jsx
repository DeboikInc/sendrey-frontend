// hooks/useKycHook.js
import { useState, useCallback, useRef, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { verifyNIN, verifyDriverLicense, verifySelfie, getVerificationStatus } from '../Redux/kycSlice';

export const useKycHook = (runnerId, fleetType) => {
  const dispatch = useDispatch();
  const [kycStep, setKycStep] = useState(null);
  const [kycStatus, setKycStatus] = useState({
    documentVerified: false,
    selfieVerified: false,
    overallVerified: false
  });
  const [lastCheckedStatus, setLastCheckedStatus] = useState(null); // eslint-disable-line no-unused-vars
  const [showConnectButton, setShowConnectButton] = useState(false);

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

  const isPedestrian = fleetType === 'pedestrian';

  const startKycFlow = useCallback((setMessages) => {
    if (kycInitiated.current) return;
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
        const idMessage = isPedestrian
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

          currentDocTypeRef.current = 'nin';
          setTimeout(() => setKycStep(2), 700);
        }, 700);
      }, 700);
    }, 500);
  }, [isPedestrian]);

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
      }, 500);
    }, 500);

    setKycStatus(prev => ({ ...prev, documentVerified: true }));
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
        // Always submit as NIN regardless of idType — per requirement
        const result = await dispatch(verifyNIN(file));
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

          if (isPedestrian) {
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
            currentDocTypeRef.current = 'driverLicense';
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
  }, [dispatch, isPedestrian]);

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

    } else if (response === 'not_now') {
      setKycStep(1);
      setTimeout(() => {
        setMessages(prev => [...prev, {
          id: `kyc-notnow-${Date.now()}`,
          from: "them",
          text: "No problem. You have limited access of 2 runs per day. Ensure to complete verification later.",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          status: "delivered",
          isKyc: true
        }]);
        setTimeout(() => {
          setMessages(prev => [...prev, {
            id: `kyc-connect-${Date.now()}`,
            from: "them",
            text: "Click the button below to connect to a user. Good luck!",
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            status: "delivered",
            isKyc: true
          }]);
          setKycStep(6);
        }, 800);
      }, 900);
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
            setMessages(prev => [...prev, {
              id: `kyc-selfie-done-${Date.now() + 1}`,
              from: "them",
              text: "You have limited access of 2 runs per day. You get full access once your identity has been confirmed",
              time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              status: "delivered",
              isKyc: true
            }]);
            setKycStatus({ documentVerified: true, selfieVerified: true, overallVerified: false });
            setKycStep(6);
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
  }, [dispatch]);

  const checkVerificationStatus = useCallback(async (setMessages) => {
    try {
      const result = await dispatch(getVerificationStatus(runnerId));
      if (!result.type.includes('fulfilled')) return;

      const { runnerStatus, documents, biometrics } = result.payload;
      const currentStatusKey = `${documents.nin?.status}-${documents.driverLicense?.status}-${biometrics.status}-${runnerStatus}`;

      setLastCheckedStatus(prevStatus => {
        if (prevStatus === currentStatusKey) return prevStatus;

        if (documents.nin?.status === 'approved') {
          setMessages(prev => [...prev, {
            id: `kyc-nin-approved-${Date.now()}`,
            from: "them",
            text: "Congratulations! Your NIN document has been verified successfully.",
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            status: "delivered", isKyc: true
          }]);
        }
        if (documents.nin?.status === 'rejected') {
          const rejectionText = documents.nin.rejectionReason
            ? `❌ Oops! Your NIN verification was unsuccessful: ${documents.nin.rejectionReason}. Please reach out to support for more details.`
            : "❌ Oops! Your document verification was unsuccessful and your account has been banned. Please reach out to support for more details.";
          setMessages(prev => [...prev, {
            id: `kyc-nin-rejected-${Date.now()}`,
            from: "them",
            text: rejectionText,
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            status: "delivered", isKyc: true
          }]);
        }
        if (documents.driverLicense?.status === 'approved') {
          setMessages(prev => [...prev, {
            id: `kyc-dl-approved-${Date.now()}`,
            from: "them",
            text: "Congratulations! Your Driver's License has been verified successfully.",
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            status: "delivered", isKyc: true
          }]);
        }
        if (documents.driverLicense?.status === 'rejected') {
          const rejectionText = documents.driverLicense.rejectionReason
            ? `❌ Oops! Your Driver's License verification was unsuccessful: ${documents.driverLicense.rejectionReason}. Please reach out to support for more details.`
            : "❌ Oops! Your document verification was unsuccessful and your account has been banned. Please reach out to support for more details.";
          setMessages(prev => [...prev, {
            id: `kyc-dl-rejected-${Date.now()}`,
            from: "them",
            text: rejectionText,
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            status: "delivered", isKyc: true
          }]);
        }
        if (biometrics.status === 'approved' && biometrics.selfieVerified) {
          setMessages(prev => [...prev, {
            id: `kyc-selfie-approved-${Date.now()}`,
            from: "them",
            text: "Amazing! Your selfie has been verified. You now have full access to all features!",
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            status: "delivered", isKyc: true
          }]);
          setTimeout(() => {
            setMessages(prev => [...prev, {
              id: `kyc-connect-${Date.now()}`,
              from: "them",
              text: "Click the button below to connect to a user. Good luck!",
              time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              status: "delivered", isKyc: true
            }]);
            setKycStep(6);
          }, 800);
          setKycStatus({ documentVerified: true, selfieVerified: true, overallVerified: true });
        }
        if (biometrics.status === 'rejected') {
          const rejectionText = biometrics.rejectionReason
            ? `❌ Oops! Your selfie verification was unsuccessful: ${biometrics.rejectionReason}. Please reach out to support for more details.`
            : "❌ Oops! Your selfie verification was unsuccessful and your account has been banned. Please reach out to support for more details.";
          setMessages(prev => [...prev, {
            id: `kyc-selfie-rejected-${Date.now()}`,
            from: "them",
            text: rejectionText,
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            status: "delivered", isKyc: true
          }]);
        }
        if (runnerStatus === 'banned') {
          setMessages(prev => [...prev, {
            id: `kyc-banned-${Date.now()}`,
            from: "them",
            text: "🚫 Your account has been suspended. Please contact support at support@sendrey.com for assistance.",
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            status: "delivered", isKyc: true
          }]);
        }

        return currentStatusKey;
      });
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