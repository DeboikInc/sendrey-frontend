import { useState, useRef } from 'react';

export const useCameraHook = () => {
  const [cameraOpen, setCameraOpen] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const openCamera = async () => {
    try {
      console.log('🎥 Opening camera...');
      setCapturedImage(null);
      setIsPreviewOpen(false);
      
      // First set cameraOpen to true to render the video element
      setCameraOpen(true);
      
      // Wait longer for React to render the DOM
      await new Promise(resolve => setTimeout(resolve, 500));
      
      console.log('📹 videoRef.current:', videoRef.current);
      
      if (!videoRef.current) {
        console.error('❌ Video element not found after waiting!');
        setCameraOpen(false);
        alert('Camera initialization failed. Please try again.');
        return;
      }

      console.log('📱 Requesting camera access...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      console.log('✅ Camera stream obtained:', stream);
      console.log('📺 Video tracks:', stream.getVideoTracks());

      if (!videoRef.current) {
        console.error('❌ Video ref lost!');
        stream.getTracks().forEach(track => track.stop());
        setCameraOpen(false);
        return;
      }

      videoRef.current.srcObject = stream;
      streamRef.current = stream;

      // Wait for video to be ready
      await new Promise((resolve) => {
        if (!videoRef.current) {
          resolve();
          return;
        }
        
        videoRef.current.onloadedmetadata = async () => {
          console.log('📊 Metadata loaded, dimensions:', 
            videoRef.current?.videoWidth, 'x', videoRef.current?.videoHeight);
          
          if (videoRef.current) {
            try {
              await videoRef.current.play();
              console.log('▶️ Video playing');
            } catch (playError) {
              console.error('❌ Play error:', playError);
            }
          }
          resolve();
        };
      });

    } catch (error) {
      console.error('❌ Error accessing camera:', error);
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      setCameraOpen(false);
      
      if (error.name === 'NotAllowedError') {
        alert('Camera permission denied. Please allow camera access and try again.');
      } else if (error.name === 'NotFoundError') {
        alert('No camera found on this device.');
      } else {
        alert(`Camera error: ${error.message}`);
      }
    }
  };

  const closeCamera = () => {
    console.log('🛑 Closing camera');
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('Stopped track:', track.label);
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraOpen(false);
    setCapturedImage(null);
    setIsPreviewOpen(false);
  };

  const capturePhoto = () => {
    console.log('📸 Capturing photo...');
    if (!videoRef.current) {
      console.error('❌ No video ref');
      return;
    }

    console.log('Video dimensions:', videoRef.current.videoWidth, 'x', videoRef.current.videoHeight);

    if (videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0) {
      console.error('❌ Video dimensions are 0');
      alert('Camera not ready. Please wait a moment and try again.');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;

    const ctx = canvas.getContext('2d');
    // Mirror the image horizontally
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(videoRef.current, 0, 0);

    const imageData = canvas.toDataURL('image/jpeg', 0.9);
    console.log('✅ Image captured, size:', imageData.length);
    setCapturedImage(imageData);

    // Stop camera after capture
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    setIsPreviewOpen(true);
  };

  const retakePhoto = async () => {
    console.log('🔄 Retaking photo');
    setCapturedImage(null);
    setIsPreviewOpen(false);
    await openCamera();
  };

  const openPreview = () => {
    setIsPreviewOpen(true);
  };

  const closePreview = () => {
    setIsPreviewOpen(false);
  };

  const confirmPhoto = () => {
    if (capturedImage) {
      console.log('✅ Photo confirmed');

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      setCameraOpen(false);
      setIsPreviewOpen(false);

      const photo = capturedImage;
      setCapturedImage(null);

      return photo;
    }
    return null;
  };

  return {
    cameraOpen,
    capturedImage,
    videoRef,
    isPreviewOpen, 
    openCamera,
    closeCamera,
    capturePhoto,
    retakePhoto,
    confirmPhoto,
    setIsPreviewOpen,
    openPreview, 
    closePreview 
  };
};