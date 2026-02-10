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
  const [capturedIdPhoto, setCapturedIdPhoto] = useState(null);
  const [capturedSelfiePhoto, setCapturedSelfiePhoto] = useState(null);
  const [lastCheckedStatus, setLastCheckedStatus] = useState(null); // Track last status to avoid duplicate messages
  const [showConnectButton, setShowConnectButton] = useState(false);

  const kycInitiated = useRef(false);

  useEffect(() => {
    kycInitiated.current = false;
  }, [runnerId]);

  console.log("🔥 KYC STARTED");


  const startKycFlow = useCallback((setMessages) => {
    if (kycInitiated.current) {
      console.log('KYC already initiated, skipping...');
      return;
    }

    kycInitiated.current = true;
    setKycStep(1);

    setTimeout(() => {
      const message1 = {
        id: Date.now() + 100,
        from: "them",
        text: "Before you can start rendering services, I need to verify you.",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "delivered",
        isKyc: true
      };
      setMessages(prev => [...prev, message1]);

      setTimeout(() => {
        const message2 = {
          id: Date.now() + 200,
          from: "them",
          text: "To get you approved, I'll need a valid government ID. preferrably NIN or a Driver's License.",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          status: "delivered",
          isKyc: true,
        };
        setMessages(prev => [...prev, message2]);

        setTimeout(() => {
          setKycStep(2);
        }, 700); // Wait a bit for the user to read the message
      }, 700);
    }, 500);
  }, []);

  const onIdVerified = useCallback((photo, setMessages) => {
    setCapturedIdPhoto(photo);
    setKycStep(1);

    setTimeout(() => {
      const imageMessage = {
        id: Date.now(),
        from: "me",
        type: "image",
        fileUrl: photo,
        text: "",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "sent",
        isKyc: true
      };
      setMessages(prev => [...prev, imageMessage]);

      setTimeout(() => {
        const idTypeMessage = {
          id: Date.now() + 100,
          from: "them",
          text: "What ID type did you provide?",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          status: "delivered",
          isKyc: true
        };
        setMessages(prev => [...prev, idTypeMessage]);

        setTimeout(() => {
          setKycStep(4);
        }, 500);
      }, 700);
    }, 500);

    setKycStatus(prev => ({ ...prev, documentVerified: true }));
  }, []);

  const handleIDTypeSelection = useCallback(async (idType, setMessages) => {
    setKycStep(1);

    setTimeout(() => {
      const verifyingMessage = {
        id: Date.now(),
        from: "them",
        text: "Submitting your document for verification...",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "delivered",
        isKyc: true
      };
      setMessages(prev => [...prev, verifyingMessage]);

      if (!capturedIdPhoto) {
        console.error('No photo captured!');
        const errorMessage = {
          id: Date.now() + 100,
          from: "them",
          text: "No photo found. Please try capturing again.",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          status: "delivered",
          isKyc: true
        };
        setMessages(prev => [...prev, errorMessage]);
        setKycStep(0);
        return;
      }

      const base64ToFile = (base64, filename) => {
        const base64Data = base64.replace(/^data:image\/(jpeg|jpg|png|webp);base64,/, '');

        try {
          const byteCharacters = atob(base64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: 'image/jpeg' });
          const file = new File([blob], filename, { type: 'image/jpeg' });
          console.log('Created file:', file.name, file.size, 'bytes', file.type);
          return file;
        } catch (error) {
          console.error('Error converting base64 to file:', error);
          return null;
        }
      };

      const file = base64ToFile(capturedIdPhoto, 'id_document.jpg');

      if (!file) {
        const errorMessage = {
          id: Date.now() + 100,
          from: "them",
          text: "I couldn't process the image. Please try again.",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          status: "delivered",
          isKyc: true
        };
        setMessages(prev => [...prev, errorMessage]);
        setKycStep(2); // here 
        return;
      }

      let verifyAction;
      if (idType === 'nin') {
        verifyAction = dispatch(verifyNIN(file));
      } else if (idType === 'driverLicense') {
        verifyAction = dispatch(verifyDriverLicense(file));
      } else {
        console.error('Invalid ID type:', idType);
        return;
      }

      verifyAction.then((result) => {
        console.log('Dispatch result:', result);
        if (result.type.includes('fulfilled')) {
          const successMessage = {
            id: Date.now() + 100,
            from: "them",
            text: "Your document has been submitted successfully and is under review. kindly excercise patience, we'll get back to you soon.",
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            status: "delivered",
            isKyc: true
          };
          setMessages(prev => [...prev, successMessage]);

          setTimeout(() => {
            const selfieMessage = {
              id: Date.now() + 200,
              from: "them",
              text: "You need to take a quick selfie so I can confirm it's really you.",
              time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              status: "delivered",
              isKyc: true
            };
            setMessages(prev => [...prev, selfieMessage]);

            setTimeout(() => {
              setKycStep(3);
            }, 800);
          }, 1000);
        } else {
          const errorMessage = {
            id: Date.now() + 100,
            from: "them",
            text: "Document submission failed. Please try again.",
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            status: "delivered",
            isKyc: true
          };
          setMessages(prev => [...prev, errorMessage]);

          setTimeout(() => {
            setKycStep(2);
          }, 700);
        }
      }).catch(error => {
        console.error('Dispatch error:', error);
        const errorMessage = {
          id: Date.now() + 100,
          from: "them",
          text: "Document submission failed. Please try again.",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          status: "delivered",
          isKyc: true
        };
        setMessages(prev => [...prev, errorMessage]);

        setTimeout(() => {
          setKycStep(2);
        }, 700);

      });
    }, 1500);
  }, [capturedIdPhoto, dispatch,]);

  const handleSelfieResponse = useCallback((response, setMessages) => {
    if (response === 'okay') {
      setTimeout(() => {
        const message = {
          id: Date.now() + 400,
          from: "them",
          text: "Please ensure your face is visible and there is enough light where you are, thanks!",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          status: "delivered",
          isKyc: true
        };

        setMessages(prev => [...prev, message]);
      }, 500)

      setTimeout(() => { setKycStep(5) }, 600)

    } else if (response === 'not_now') {
      setKycStep(1);
      setTimeout(() => {
        const message = {
          id: Date.now() + 400,
          from: "them",
          text: "No problem. You have limited access of 2 runs per day. Ensure to complete verification later.",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          status: "delivered",
          isKyc: true
        };
        setMessages(prev => [...prev, message]);
        setTimeout(() => {
          const instructionMessage = {
            id: Date.now() + 500,
            from: "them",
            text: "Click the button below to connect to a user. Good luck!",
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            status: "delivered",
            isKyc: true
          };
          setMessages(prev => [...prev, instructionMessage]);

          // Show connect buttons
          setKycStep(6);
        }, 800);
      }, 900);
    }
  }, []);

  const onSelfieVerified = useCallback((photo, setMessages) => {
    setCapturedSelfiePhoto(photo);
    setKycStep(1);

    setTimeout(() => {
      const imageMessage = {
        id: Date.now(),
        from: "me",
        type: "image",
        fileUrl: photo,
        text: "",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "sent",
        isKyc: true
      };
      setMessages(prev => [...prev, imageMessage]);

      setTimeout(() => {
        const verifyingMessage = {
          id: Date.now() + 100,
          from: "them",
          text: "Submitting your selfie for verification...",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          status: "delivered",
          isKyc: true
        };
        setMessages(prev => [...prev, verifyingMessage]);

        fetch(photo)
          .then(res => res.blob())
          .then(blob => {
            const file = new File([blob], "selfie.jpg", { type: "image/jpeg" });

            dispatch(verifySelfie(file)).then((result) => {
              if (result.type.includes('fulfilled')) {
                const finalMessage = {
                  id: Date.now() + 500,
                  from: "them",
                  text: "Great! Your selfie has been submitted for review. You'll be notified once verification is complete.",
                  time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                  status: "delivered",
                  isKyc: true
                };
                setMessages(prev => [...prev, finalMessage]);
                setKycStatus({ documentVerified: true, selfieVerified: true, overallVerified: false });
                setKycStep(0);
              } else {
                const errorMessage = {
                  id: Date.now() + 500,
                  from: "them",
                  text: "Selfie submission failed. Please try again.",
                  time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                  status: "delivered",
                  isKyc: true
                };
                setMessages(prev => [...prev, errorMessage]);
                setTimeout(() => { setKycStep(3); }, 800);
              }
            });
          });
      }, 700);
    }, 500);
  }, [dispatch]);

  // FIXED: Proper Redux dispatch handling
  const checkVerificationStatus = useCallback(async (setMessages) => {
    try {
      const result = await dispatch(getVerificationStatus(runnerId));

      console.log('Verification status check:', result);

      // Check if the action was fulfilled
      if (result.type.includes('fulfilled')) {
        const data = result.payload;
        const { runnerStatus, documents, biometrics } = data;

        // Create a status key to track what we've already notified
        const currentStatusKey = `${documents.nin?.status}-${documents.driverLicense?.status}-${biometrics.status}-${runnerStatus}`;

        // Only show messages if status has changed
        if (lastCheckedStatus !== currentStatusKey) {
          setLastCheckedStatus(currentStatusKey);

          // Check if NIN was approved
          if (documents.nin?.status === 'approved') {
            const approvalMessage = {
              id: Date.now(),
              from: "them",
              text: "Congratulations! Your NIN document has been verified successfully.",
              time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              status: "delivered",
              isKyc: true
            };
            setMessages(prev => [...prev, approvalMessage]);
          }

          // Check if NIN was rejected
          if (documents.nin?.status === 'rejected') {
            const rejectionMessage = {
              id: Date.now(),
              from: "them",
              text: "❌ Oops! Your document verification was unsuccessful and your account has been banned. Please reach out to support for more details.",
              time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              status: "delivered",
              isKyc: true
            };
            setMessages(prev => [...prev, rejectionMessage]);
          }

          // Check if Driver License was approved
          if (documents.driverLicense?.status === 'approved') {
            const approvalMessage = {
              id: Date.now(),
              from: "them",
              text: "Congratulations! Your Driver's License has been verified successfully.",
              time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              status: "delivered",
              isKyc: true
            };
            setMessages(prev => [...prev, approvalMessage]);
          }

          // Check if Driver License was rejected
          if (documents.driverLicense?.status === 'rejected') {
            const rejectionMessage = {
              id: Date.now(),
              from: "them",
              text: "❌ Oops! Your document verification was unsuccessful and your account has been banned. Please reach out to support for more details.",
              time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              status: "delivered",
              isKyc: true
            };
            setMessages(prev => [...prev, rejectionMessage]);
          }

          // Check if selfie was approved
          if (biometrics.status === 'approved' && biometrics.selfieVerified) {
            const approvalMessage = {
              id: Date.now(),
              from: "them",
              text: "Amazing! Your selfie has been verified. You now have full access to all features!",
              time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              status: "delivered",
              isKyc: true
            };
            setMessages(prev => [...prev, approvalMessage]);

            setTimeout(() => {
              const instructionMessage = {
                id: Date.now() + 100,
                from: "them",
                text: "Click the button below to connect to a user. Good luck!",
                time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                status: "delivered",
                isKyc: true
              };
              setMessages(prev => [...prev, instructionMessage]);

              // Show connect buttons
              setKycStep(6);
            }, 800);

            setKycStatus({ documentVerified: true, selfieVerified: true, overallVerified: true });
          }

          // Check if selfie was rejected
          if (biometrics.status === 'rejected') {
            const rejectionMessage = {
              id: Date.now(),
              from: "them",
              text: "❌ Oops! Your selfie verification was unsuccessful and your account has been banned. Please reach out to support for more details.",
              time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              status: "delivered",
              isKyc: true
            };
            setMessages(prev => [...prev, rejectionMessage]);
          }

          // Check if account is banned
          if (runnerStatus === 'banned') {
            const banMessage = {
              id: Date.now(),
              from: "them",
              text: "🚫 Your account has been suspended. Please contact support at support@sendrey.com for assistance.",
              time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              status: "delivered",
              isKyc: true
            };
            setMessages(prev => [...prev, banMessage]);
          }
        }
      }
    } catch (error) {
      console.error('Error checking verification status:', error);
    }
  }, [dispatch, lastCheckedStatus, runnerId]);

  return {
    kycStep,
    kycStatus,
    setKycStep,
    capturedIdPhoto,
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