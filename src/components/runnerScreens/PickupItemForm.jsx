// components/runnerScreens/PickupItemForm.jsx
import React, { useState, useRef, useEffect } from 'react';
import { X, Camera, RotateCcw, Check, Package } from 'lucide-react';

const PickupItemForm = ({
  isOpen,
  onClose,
  onSubmit,
  darkMode,
  openCamera,
  closeCamera,
  capturePhoto,
  retakePhoto,
  capturedImage,
  videoRef,
  cameraOpen,
  isPreviewOpen,
  closePreview,
  cameraUsedByItemFormRef
}) => {
  const [itemName, setItemName] = useState('');
  const [photoBase64, setPhotoBase64] = useState(null);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showInternalPreview, setShowInternalPreview] = useState(false);
  const fileInputRef = useRef(null);
  const [submitError, setSubmitError] = useState('');

  // When capturedImage arrives, show internal preview
  useEffect(() => {
    if (capturedImage && isPreviewOpen) {
      setShowInternalPreview(true);
    }
  }, [capturedImage, isPreviewOpen]);

  // Gallery pick
  const handleGallerySelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setPhotoBase64(e.target.result);
      setPhotoUrl(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  // Camera
  const handleOpenCamera = () => {
    setShowInternalPreview(false);
    if (cameraUsedByItemFormRef) cameraUsedByItemFormRef.current = true;
    openCamera();
  };

  const handleConfirmCameraPhoto = () => {
    if (capturedImage) {
      setPhotoBase64(capturedImage);
      setPhotoUrl(capturedImage);
    }
    setShowInternalPreview(false);
    if (cameraUsedByItemFormRef) cameraUsedByItemFormRef.current = false;
    closePreview();
    closeCamera();
  };

  const handleRetakePhoto = () => {
    setShowInternalPreview(false);
    retakePhoto();
  };

  const handleDiscardPhoto = () => {
    setShowInternalPreview(false);
    if (cameraUsedByItemFormRef) cameraUsedByItemFormRef.current = false;
    closePreview();
    closeCamera();
  };

  const handleRemovePhoto = () => {
    setPhotoBase64(null);
    setPhotoUrl(null);
  };

  const handleSubmit = async () => {
    if (!itemName.trim()) return alert('Please enter the item name');
    if (!photoBase64) return alert('Please take a photo of the item');

    setIsSubmitting(true);
    setSubmitError('');
    try {
      await onSubmit({
        itemName: itemName.trim(),
        photoBase64: photoBase64,
        photoUrl: photoUrl,
      });
      resetForm();
      onClose();
    } catch (error) {
      console.error('Error submitting pickup item:', error);
      setSubmitError('Failed to submit item. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setItemName('');
    setPhotoBase64(null);
    setPhotoUrl(null);
  };

  if (!isOpen) return null;

  // Camera live view
  if (cameraOpen && !showInternalPreview) {
    return (
      <div className="fixed inset-0 bg-black z-[9999] flex flex-col" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex-shrink-0 flex justify-between items-center p-4 bg-black/80">
          <button
            onClick={handleDiscardPhoto}
            className="text-white px-4 py-2 hover:bg-white/10 rounded-lg text-sm font-medium"
          >
            Cancel
          </button>
          <h3 className="text-white text-lg font-medium">Take Photo</h3>
          <div className="w-16" />
        </div>
        <div className="relative flex-1 bg-black overflow-hidden">
          <video
            ref={videoRef}
            autoPlay playsInline muted
            className="w-full h-full object-cover"
            style={{ transform: 'scaleX(-1)' }}
          />
          <div className="absolute bottom-8 left-0 right-0 flex justify-center">
            <button
              onClick={capturePhoto}
              className="w-16 h-16 rounded-full bg-white border-4 border-gray-300 hover:bg-gray-100 shadow-2xl active:scale-95 transition-transform"
            />
          </div>
        </div>
      </div>
    );
  }

  // Internal preview after capture
  if (showInternalPreview && capturedImage) {
    return (
      <div className="fixed inset-0 bg-black z-[9999] flex flex-col">
        <div className="flex justify-between items-center p-4 bg-black/80">
          <button
            onClick={handleDiscardPhoto}
            className="text-white px-4 py-2 hover:bg-white/10 rounded-lg text-sm font-medium"
          >
            Discard
          </button>
          <h3 className="text-white text-lg font-medium">Use this photo?</h3>
          <div className="w-16" />
        </div>
        <div className="bg-black flex-1 flex items-center justify-center min-h-0 overflow-hidden">
          <img
            src={capturedImage}
            alt="Captured"
            className="max-w-full max-h-full object-contain"
          />
        </div>
        <div className="flex-shrink-0 flex gap-4 p-4 bg-black/80">
          <button
            onClick={handleRetakePhoto}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gray-700 text-white font-semibold"
          >
            <RotateCcw className="w-5 h-5" />
            Retake
          </button>
          <button
            onClick={handleConfirmCameraPhoto}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-white font-semibold"
          >
            <Check className="w-5 h-5" />
            Use Photo
          </button>
        </div>
      </div>
    );
  }

  // Main form
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={`w-full max-w-md rounded-2xl shadow-2xl ${darkMode ? 'bg-black-100 border border-black-200' : 'bg-white'}`}>

        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b ${darkMode ? 'bg-black-100 border-black-200' : 'bg-white border-gray-100'}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Package className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-black-200'}`}>Submit Pickup Item</h2>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Take a photo of the item</p>
            </div>
          </div>
          <button onClick={onClose} className={`p-2 rounded-full transition-colors ${darkMode ? 'hover:bg-black-200' : 'hover:bg-gray-100'}`}>
            <X className={`w-5 h-5 ${darkMode ? 'text-gray-400' : 'text-black-200'}`} />
          </button>
        </div>

        <div className="p-6">
          {/* Photo */}
          <div className="mb-4">
            <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Item Photo *
            </label>
            {photoUrl ? (
              <div className="relative">
                <img src={photoUrl} alt="Item" className="w-full h-48 object-cover rounded-lg" />
                <button
                  onClick={handleRemovePhoto}
                  className="absolute top-2 right-2 p-1.5 bg-red-500 rounded-full"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={handleOpenCamera}
                  className={`flex-1 h-32 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2 transition-colors ${darkMode ? 'border-black-200 hover:border-primary text-gray-400 hover:text-primary' : 'border-gray-200 hover:border-primary text-gray-500 hover:text-primary'}`}
                >
                  <Camera className="w-6 h-6" />
                  <span className="text-sm font-medium">Camera</span>
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex-1 h-32 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2 transition-colors ${darkMode ? 'border-black-200 hover:border-primary text-gray-400 hover:text-primary' : 'border-gray-200 hover:border-primary text-gray-500 hover:text-primary'}`}
                >
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="M21 15l-5-5L5 21" />
                  </svg>
                  <span className="text-sm font-medium">Gallery</span>
                </button>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleGallerySelect}
            />
          </div>

          {/* Item Name */}
          <div className="mb-6">
            <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Item Name *
            </label>
            <input
              type="text"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="e.g., iPhone 15 Pro, Laptop, Groceries..."
              className={`w-full p-3 rounded-lg border outline-none ${darkMode ? 'bg-black-100 border-black-200 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-black-200 placeholder-gray-400'}`}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className={`flex-1 py-3 rounded-xl font-semibold bg-secondary text-white hover:opacity-90 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !itemName.trim() || !photoBase64}
              className={`flex-1 py-3 rounded-xl font-semibold bg-primary text-white hover:opacity-90 ${(isSubmitting || !itemName.trim() || !photoBase64) ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isSubmitting ? 'Submitting...' : 'Send for Approval'}
            </button>
          </div>
          {submitError && (
            <p className="mt-2 text-sm text-red-500 text-center">{submitError}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default PickupItemForm;