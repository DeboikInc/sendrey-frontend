// hooks/useKycHook.js
import { useState, useCallback, useRef, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { verifyNIN, verifyDriverLicense, verifySelfie, getVerificationStatus } from '../Redux/kycSlice';

export const useKycHook = (runnerId) => {
  const dispatch = useDispatch();
  const [kycStep, setKycStep] = useState(null);
  const [kycStatus, setKycStatus] = useState({
    documentVerified: false,
    selfieVerified: false,
    overallVerified: false
  });
  const [lastCheckedStatus, setLastCheckedStatus] = useState(null);
  const [showConnectButton, setShowConnectButton] = useState(false);

  // Use refs for photos — avoids stale closures and double-invocation from setState updaters
  const capturedIdPhotoRef = useRef(null);
  const capturedSelfiePhotoRef = useRef(null);
  const kycInitiated = useRef(false);
  const verifyInProgress = useRef(false); // guard against double dispatch

  useEffect(() => {
    kycInitiated.current = false;
    verifyInProgress.current = false;
    capturedIdPhotoRef.current = null;
    capturedSelfiePhotoRef.current = null;
  }, [runnerId]);

  const startKycFlow = useCallback((setMessages) => {
    if (kycInitiated.current) {
      console.log('KYC already initiated, skipping...');
      return;
    }

    console.log('KYC STARTED');
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
        setMessages(prev => [...prev, {
          id: `kyc-${Date.now()}-2`,
          from: "them",
          text: "To get you approved, I'll need a valid government ID. preferrably NIN or a Driver's License.",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          status: "delivered",
          isKyc: true,
        }]);

        setTimeout(() => setKycStep(2), 700);
      }, 700);
    }, 500);
  }, []);

  const onIdVerified = useCallback((photo, setMessages) => {
    // Store in ref — no setState, no double invocation
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

      setTimeout(() => {
        setMessages(prev => [...prev, {
          id: `kyc-idtype-${Date.now()}`,
          from: "them",
          text: "What ID type did you provide?",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          status: "delivered",
          isKyc: true
        }]);

        setTimeout(() => setKycStep(4), 500);
      }, 700);
    }, 500);

    setKycStatus(prev => ({ ...prev, documentVerified: true }));
  }, []);

  const handleIDTypeSelection = useCallback(async (idType, setMessages) => {
    // Guard against double dispatch (Strict Mode / double click)
    if (verifyInProgress.current) {
      console.log('Verification already in progress, skipping...');
      return;
    }

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
      setKycStep(0);
      return;
    }

    verifyInProgress.current = true;
    setKycStep(1);

    setTimeout(async () => {
      setMessages(prev => [...prev, {
        id: `kyc-submitting-${Date.now()}`,
        from: "them",
        text: "Submitting your document for verification...",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "delivered",
        isKyc: true
      }]);

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
        let verifyAction;
        if (idType === 'nin') {
          verifyAction = dispatch(verifyNIN(file));
        } else if (idType === 'driverLicense') {
          verifyAction = dispatch(verifyDriverLicense(file));
        } else {
          console.error('Invalid ID type:', idType);
          verifyInProgress.current = false;
          return;
        }

        const result = await verifyAction;
        verifyInProgress.current = false;

        if (result.type.includes('fulfilled')) {
          setMessages(prev => [...prev, {
            id: `kyc-success-${Date.now()}`,
            from: "them",
            text: "Your document has been submitted successfully and is under review. kindly excercise patience, we'll get back to you soon.",
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            status: "delivered",
            isKyc: true
          }]);

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
  }, [dispatch]);

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
            setKycStatus({ documentVerified: true, selfieVerified: true, overallVerified: false });
            setKycStep(0);
          } else {
            setMessages(prev => [...prev, {
              id: `kyc-selfie-err-${Date.now()}`,
              from: "them",
              text: "Selfie submission failed. Please try again.",
              time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              status: "delivered",
              isKyc: true
            }]);
            setTimeout(() => setKycStep(3), 800);
          }
        } catch (err) {
          console.error('Selfie upload error:', err);
          setTimeout(() => setKycStep(3), 800);
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
        if (prevStatus === currentStatusKey) return prevStatus; // no change, no messages

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
          setMessages(prev => [...prev, {
            id: `kyc-nin-rejected-${Date.now()}`,
            from: "them",
            text: "❌ Oops! Your document verification was unsuccessful and your account has been banned. Please reach out to support for more details.",
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
          setMessages(prev => [...prev, {
            id: `kyc-dl-rejected-${Date.now()}`,
            from: "them",
            text: "❌ Oops! Your document verification was unsuccessful and your account has been banned. Please reach out to support for more details.",
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
          setMessages(prev => [...prev, {
            id: `kyc-selfie-rejected-${Date.now()}`,
            from: "them",
            text: "❌ Oops! Your selfie verification was unsuccessful and your account has been banned. Please reach out to support for more details.",
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
    setShowConnectButton
  };
};