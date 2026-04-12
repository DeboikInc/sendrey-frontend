import React, { useState, useRef, useEffect } from 'react';
import { X, Plus, Trash2, ShoppingBag, Camera, RotateCcw, Check } from 'lucide-react';

const ItemSubmissionForm = ({
  isOpen, onClose, onSubmit, darkMode, orderBudget,
  openCamera, closeCamera, capturePhoto, retakePhoto,
  capturedImage, videoRef, cameraOpen, isPreviewOpen, closePreview,
  cameraUsedByItemFormRef
}) => {
  const [items, setItems] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cameraTargetItemId, setCameraTargetItemId] = useState(null);
  const [showInternalPreview, setShowInternalPreview] = useState(false);
  const fileInputRefs = useRef({});
  const [submitError, setSubmitError] = useState('');

  // When capturedImage arrives and we have a target item, show internal preview
  useEffect(() => {
    if (capturedImage && isPreviewOpen && cameraTargetItemId) {
      setShowInternalPreview(true);
    }
  }, [capturedImage, isPreviewOpen, cameraTargetItemId]);

  const addItem = () => {
    setItems(prev => [...prev, {
      id: Date.now(), name: '', quantity: 1, price: '',
      photoBase64: null, photoUrl: null,
    }]);
  };

  const removeItem = (itemId) => setItems(prev => prev.filter(item => item.id !== itemId));

  const updateItem = (itemId, field, value) => {
    setItems(prev => prev.map(item => item.id === itemId ? { ...item, [field]: value } : item));
  };

  const getPriceValue = (price) => {
    if (price === '' || price === null || price === undefined) return 0;
    return Math.round(Number(price)) || 0;
  };

  // ── Gallery pick ────────────────────────────────────────────────────────
  const handleGallerySelect = (itemId, event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      updateItem(itemId, 'photoBase64', e.target.result);
      updateItem(itemId, 'photoUrl', e.target.result);
    };
    reader.readAsDataURL(file);
  };

  // ── Camera ──────────────────────────────────────────────────────────────
  const handleOpenCamera = (itemId) => {
    setCameraTargetItemId(itemId);
    setShowInternalPreview(false);
    if (cameraUsedByItemFormRef) cameraUsedByItemFormRef.current = true;
    openCamera();
  };

  const handleConfirmCameraPhoto = () => {
    if (capturedImage && cameraTargetItemId) {
      updateItem(cameraTargetItemId, 'photoBase64', capturedImage);
      updateItem(cameraTargetItemId, 'photoUrl', capturedImage);
    }
    setShowInternalPreview(false);
    setCameraTargetItemId(null);
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
    setCameraTargetItemId(null);
    if (cameraUsedByItemFormRef) cameraUsedByItemFormRef.current = false;
    closePreview();
    closeCamera();
  };

  // ── Submit ──────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (items.length === 0) return alert('Please add at least one item');
    setIsSubmitting(true);
    setSubmitError('');
    try {
      await onSubmit({
        items: items.map(({ id, photoUrl, ...rest }) => ({
          ...rest,
          price: getPriceValue(rest.price),
          quantity: Math.round(Number(rest.quantity) || 1),
        })),
        receiptBase64: null,
        hasItemPhotos: items.some(i => !!i.photoBase64),
        totalAmount: items.reduce((sum, item) =>
          sum + (getPriceValue(item.price) * Math.round(Number(item.quantity) || 1)), 0),
      });
      setItems([]);
      onClose();
    } catch (error) {
      console.error('Error submitting items:', error);
      setSubmitError('Failed to submit items. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  // ── Camera live view ────────────────────────────────────────────────────
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

  // ── Internal preview after capture ──────────────────────────────────────
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

  // ── Main form ────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl ${darkMode ? 'bg-black-100 border border-black-200' : 'bg-white'}`}>

        {/* Header */}
        <div className={`sticky top-0 z-10 flex items-center justify-between p-6 border-b ${darkMode ? 'bg-black-100 border-black-200' : 'bg-white border-gray-100'}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-black-200'}`}>Submit Items for Approval</h2>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Budget: ₦{orderBudget?.toLocaleString()}</p>
            </div>
          </div>
          <button onClick={onClose} className={`p-2 rounded-full transition-colors ${darkMode ? 'hover:bg-black-200' : 'hover:bg-gray-100'}`}>
            <X className={`w-5 h-5 ${darkMode ? 'text-gray-400' : 'text-black-200'}`} />
          </button>
        </div>

        <div className="p-6">
          <div className="space-y-4 mb-6">
            {items.map((item, index) => (
              <div key={item.id} className={`p-4 rounded-xl border ${darkMode ? 'bg-black-200 border-black-200' : 'bg-gray-50 border-gray-100'}`}>
                <div className="flex items-start justify-between mb-3">
                  <span className={`font-semibold ${darkMode ? 'text-white' : 'text-black-200'}`}>Item {index + 1}</span>
                  <button onClick={() => removeItem(item.id)} className="p-1 rounded-lg hover:bg-red-500/10">
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>

                {/* Photo */}
                <div className="mb-3">
                  {item.photoUrl ? (
                    <div className="relative">
                      <img src={item.photoUrl} alt="Item" className="w-full h-32 object-cover rounded-lg" />
                      <button
                        onClick={() => { updateItem(item.id, 'photoBase64', null); updateItem(item.id, 'photoUrl', null); }}
                        className="absolute top-2 right-2 p-1.5 bg-red-500 rounded-full"
                      >
                        <X className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      {/* Camera option */}
                      <button
                        onClick={() => handleOpenCamera(item.id)}
                        className={`flex-1 h-24 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-1.5 transition-colors ${darkMode ? 'border-black-200 hover:border-primary text-gray-400 hover:text-primary' : 'border-gray-200 hover:border-primary text-gray-500 hover:text-primary'}`}
                      >
                        <Camera className="w-5 h-5" />
                        <span className="text-xs font-medium">Camera</span>
                      </button>
                      {/* Gallery option */}
                      <button
                        onClick={() => fileInputRefs.current[item.id]?.click()}
                        className={`flex-1 h-24 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-1.5 transition-colors ${darkMode ? 'border-black-200 hover:border-primary text-gray-400 hover:text-primary' : 'border-gray-200 hover:border-primary text-gray-500 hover:text-primary'}`}
                      >
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                          <circle cx="8.5" cy="8.5" r="1.5" />
                          <path d="M21 15l-5-5L5 21" />
                        </svg>
                        <span className="text-xs font-medium">Gallery</span>
                      </button>
                    </div>
                  )}
                  <input
                    ref={el => fileInputRefs.current[item.id] = el}
                    type="file" accept="image/*" capture={undefined} className="hidden"
                    onChange={(e) => handleGallerySelect(item.id, e)}
                  />
                </div>

                {/* Item details */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-3">
                    <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Item Name</label>
                    <input
                      type="text" value={item.name}
                      onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                      placeholder="e.g., Rice 50kg"
                      className={`w-full p-2 rounded-lg border outline-none ${darkMode ? 'bg-black-100 border-black-200 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-black-200 placeholder-gray-400'}`}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Qty</label>
                    <input
                      type="number" min="1" value={item.quantity}
                      onChange={(e) => updateItem(item.id, 'quantity', Math.round(parseInt(e.target.value) || 1))}
                      className={`w-full p-2 rounded-lg border outline-none ${darkMode ? 'bg-black-100 border-black-200 text-white' : 'bg-white border-gray-200 text-black-200'}`}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Price (₦)</label>
                    <input
                      type="text" inputMode="numeric" value={item.price} placeholder="0"
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^0-9]/g, '');
                        updateItem(item.id, 'price', raw === '' ? '' : parseInt(raw, 10));
                      }}
                      className={`w-full p-2 rounded-lg border outline-none ${darkMode ? 'bg-black-100 border-black-200 text-white' : 'bg-white border-gray-200 text-black-200'}`}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Subtotal</label>
                    <div className={`p-2 rounded-lg ${darkMode ? 'bg-black-100' : 'bg-gray-100'}`}>
                      <span className="font-semibold text-primary">
                        ₦{(getPriceValue(item.price) * Math.round(Number(item.quantity) || 1)).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <button
              onClick={addItem}
              className={`w-full p-4 border-2 border-dashed rounded-xl flex items-center justify-center gap-2 transition-colors ${darkMode ? 'border-black-200 hover:border-primary text-gray-400 hover:text-primary' : 'border-gray-200 hover:border-primary text-gray-500 hover:text-primary'}`}
            >
              <Plus className="w-5 h-5" />
              Add Item
            </button>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose} disabled={isSubmitting}
              className={`flex-1 py-3 rounded-xl font-semibold bg-secondary text-white hover:opacity-90 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || items.length === 0}
              className={`flex-1 py-3 rounded-xl font-semibold bg-primary text-white hover:opacity-90 ${(isSubmitting || items.length === 0) ? 'opacity-50 cursor-not-allowed' : ''}`}
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

export default ItemSubmissionForm;