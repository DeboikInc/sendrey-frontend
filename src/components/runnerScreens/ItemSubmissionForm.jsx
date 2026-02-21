import React, { useState, useRef } from 'react';
import { X, Plus, Camera, Upload, Trash2, ShoppingBag } from 'lucide-react';

const ItemSubmissionForm = ({ isOpen, onClose, onSubmit, darkMode, orderBudget }) => {
  const [items, setItems] = useState([]);
  const [receiptImage, setReceiptImage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const itemPhotoInputRef = useRef(null);
  const receiptInputRef = useRef(null);

  const addItem = () => {
    setItems([...items, {
      id: Date.now(),
      name: '',
      quantity: 1,
      price: 0,
      photoBase64: null,
      photoUrl: null
    }]);
  };

  const removeItem = (itemId) => {
    setItems(items.filter(item => item.id !== itemId));
  };

  const updateItem = (itemId, field, value) => {
    setItems(items.map(item =>
      item.id === itemId ? { ...item, [field]: value } : item
    ));
  };

  const handleItemPhotoSelect = async (itemId, event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      updateItem(itemId, 'photoBase64', e.target.result);
      updateItem(itemId, 'photoUrl', e.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleReceiptSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      setReceiptImage(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const handleSubmit = async () => {
    if (items.length === 0) {
      alert('Please add at least one item');
      return;
    }

    const invalidItems = items.filter(item => !item.name || item.price <= 0 || item.quantity <= 0);
    if (invalidItems.length > 0) {
      alert('Please fill in all item details with valid values');
      return;
    }

    const total = calculateTotal();
    if (total > orderBudget) {
      alert(`Total cost ₦${total.toLocaleString()} exceeds budget ₦${orderBudget.toLocaleString()}`);
      return;
    }

    if (!receiptImage) {
      alert('Please upload a receipt');
      return;
    }

    setIsSubmitting(true);

    try {
      await onSubmit({
        items: items.map(({ id, photoUrl, ...rest }) => rest),
        receiptBase64: receiptImage,
        totalAmount: total
      });

      setItems([]);
      setReceiptImage(null);
      onClose();
    } catch (error) {
      console.error('Error submitting items:', error);
      alert('Failed to submit items. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const total = calculateTotal();
  const isOverBudget = total > orderBudget;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl ${
        darkMode ? 'bg-black-100 border border-black-200' : 'bg-white'
      }`}>
        
        {/* Header */}
        <div className={`sticky top-0 z-10 flex items-center justify-between p-6 border-b ${
          darkMode ? 'bg-black-100 border-black-200' : 'bg-white border-gray-1001'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-black-200'}`}>
                Submit Purchased Items
              </h2>
              <p className={`text-sm ${darkMode ? 'text-gray-1002' : 'text-gray-600'}`}>
                Budget: ₦{orderBudget?.toLocaleString()}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-full transition-colors ${
              darkMode ? 'hover:bg-black-200' : 'hover:bg-gray-1001'
            }`}
          >
            <X className={`w-5 h-5 ${darkMode ? 'text-gray-1002' : 'text-black-200'}`} />
          </button>
        </div>

        <div className="p-6">
          {/* Items List */}
          <div className="space-y-4 mb-6">
            {items.map((item, index) => (
              <div key={item.id} className={`p-4 rounded-xl border ${
                darkMode ? 'bg-black-200 border-black-200' : 'bg-gray-1001 border-gray-1001'
              }`}>
                <div className="flex items-start justify-between mb-3">
                  <span className={`font-semibold ${darkMode ? 'text-white' : 'text-black-200'}`}>
                    Item {index + 1}
                  </span>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="p-1 rounded-lg hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>

                {/* Photo */}
                <div className="mb-3">
                  {item.photoUrl ? (
                    <div className="relative">
                      <img
                        src={item.photoUrl}
                        alt="Item"
                        className="w-full h-32 object-cover rounded-lg"
                      />
                      <button
                        onClick={() => {
                          updateItem(item.id, 'photoBase64', null);
                          updateItem(item.id, 'photoUrl', null);
                        }}
                        className="absolute top-2 right-2 p-1.5 bg-red-500 rounded-full"
                      >
                        <X className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => itemPhotoInputRef.current?.click()}
                      className={`w-full h-32 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2 transition-colors ${
                        darkMode
                          ? 'border-black-200 hover:border-primary text-gray-1002 hover:text-primary'
                          : 'border-gray-1001 hover:border-primary text-gray-600 hover:text-primary'
                      }`}
                    >
                      <Camera className="w-6 h-6" />
                      <span className="text-sm">Add Photo</span>
                    </button>
                  )}
                  <input
                    ref={itemPhotoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleItemPhotoSelect(item.id, e)}
                  />
                </div>

                {/* Item Details */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-3">
                    <label className={`block text-sm font-medium mb-1 ${
                      darkMode ? 'text-gray-1002' : 'text-black-200'
                    }`}>
                      Item Name
                    </label>
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                      placeholder="e.g., Rice 50kg"
                      className={`w-full p-2 rounded-lg border outline-none ${
                        darkMode
                          ? 'bg-black-100 border-black-200 text-white placeholder-gray-1002'
                          : 'bg-white border-gray-1001 text-black-200 placeholder-gray-600'
                      }`}
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-1 ${
                      darkMode ? 'text-gray-1002' : 'text-black-200'
                    }`}>
                      Quantity
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                      className={`w-full p-2 rounded-lg border outline-none ${
                        darkMode
                          ? 'bg-black-100 border-black-200 text-white'
                          : 'bg-white border-gray-1001 text-black-200'
                      }`}
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-1 ${
                      darkMode ? 'text-gray-1002' : 'text-black-200'
                    }`}>
                      Price (₦)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={item.price}
                      onChange={(e) => updateItem(item.id, 'price', parseFloat(e.target.value) || 0)}
                      className={`w-full p-2 rounded-lg border outline-none ${
                        darkMode
                          ? 'bg-black-100 border-black-200 text-white'
                          : 'bg-white border-gray-1001 text-black-200'
                      }`}
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-1 ${
                      darkMode ? 'text-gray-1002' : 'text-black-200'
                    }`}>
                      Subtotal
                    </label>
                    <div className={`p-2 rounded-lg ${
                      darkMode ? 'bg-black-100' : 'bg-gray-1001'
                    }`}>
                      <span className="font-semibold text-primary">
                        ₦{(item.quantity * item.price).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Add Item Button */}
            <button
              onClick={addItem}
              className={`w-full p-4 border-2 border-dashed rounded-xl flex items-center justify-center gap-2 transition-colors ${
                darkMode
                  ? 'border-black-200 hover:border-primary text-gray-1002 hover:text-primary'
                  : 'border-gray-1001 hover:border-primary text-black-200 hover:text-primary'
              }`}
            >
              <Plus className="w-5 h-5" />
              Add Item
            </button>
          </div>

          {/* Receipt Upload */}
          <div className="mb-6">
            <label className={`block text-sm font-medium mb-2 ${
              darkMode ? 'text-gray-1002' : 'text-black-200'
            }`}>
              Upload Receipt
            </label>
            {receiptImage ? (
              <div className="relative">
                <img
                  src={receiptImage}
                  alt="Receipt"
                  className="w-full rounded-lg"
                />
                <button
                  onClick={() => setReceiptImage(null)}
                  className="absolute top-2 right-2 p-2 bg-red-500 rounded-full"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => receiptInputRef.current?.click()}
                className={`w-full h-40 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2 transition-colors ${
                  darkMode
                    ? 'border-black-200 hover:border-primary text-gray-1002 hover:text-primary'
                    : 'border-gray-1001 hover:border-primary text-black-200 hover:text-primary'
                }`}
              >
                <Upload className="w-8 h-8" />
                <span className="text-sm font-medium">Upload Receipt Photo</span>
              </button>
            )}
            <input
              ref={receiptInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleReceiptSelect}
            />
          </div>

          {/* Total Summary */}
          <div className={`p-4 rounded-xl mb-6 ${
            darkMode ? 'bg-black-200' : 'bg-gray-1001'
          }`}>
            <div className="flex justify-between items-center mb-2">
              <span className={`font-medium ${darkMode ? 'text-gray-1002' : 'text-black-200'}`}>
                Budget
              </span>
              <span className={darkMode ? 'text-white' : 'text-black-200'}>
                ₦{orderBudget?.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className={`font-medium ${darkMode ? 'text-gray-1002' : 'text-black-200'}`}>
                Total Cost
              </span>
              <span className={`font-bold ${isOverBudget ? 'text-red-500' : 'text-primary'}`}>
                ₦{total.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t dark:border-black-100 border-gray-1001">
              <span className={`font-medium ${darkMode ? 'text-gray-1002' : 'text-black-200'}`}>
                Remaining
              </span>
              <span className={`font-bold ${
                (orderBudget - total) < 0 ? 'text-red-500' : 'text-green-500'
              }`}>
                ₦{(orderBudget - total).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
                darkMode
                  ? 'bg-secondary text-white hover:opacity-90'
                  : 'bg-secondary text-white hover:opacity-90'
              } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || items.length === 0 || !receiptImage || isOverBudget}
              className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
                darkMode
                  ? 'bg-primary text-white hover:opacity-90'
                  : 'bg-primary text-white hover:opacity-90'
              } ${(isSubmitting || items.length === 0 || !receiptImage || isOverBudget) ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Items'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ItemSubmissionForm;