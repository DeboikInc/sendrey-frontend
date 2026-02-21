import React, { useState } from "react";
import { X, MapPin, Phone, Package, DollarSign, Truck, Edit2, DeleteIcon, Trash2 } from "lucide-react";
import { Button } from "@material-tailwind/react";
import { useSocket } from "../../hooks/useSocket";
import { useSelector } from "react-redux";
import { useDispatch } from "react-redux";
import { updateProfile } from "../../Redux/userSlice";
import BarLoader from "../common/BarLoader";

export default function ConfirmOrderScreen({
  isOpen,
  onClose,
  onContinue,
  orderData,
  onEdit,
  onServerUpdated,
  darkMode
}) {
  const { socket, isConnected, sendMessage, uploadFile } = useSocket();
  const currentUser = useSelector((state) => state.auth?.user || state.auth?.userData || state.auth);
  const dispatch = useDispatch();
  const [isConnecting, setIsConnecting] = useState(false);
  if (!isOpen) return null;

  const {
    serviceType,
    marketLocation, // For run-errand service
    pickupLocation, // For pick-up service
    deliveryLocation,
    fleetType,
    specialInstructions,
    pickupPhone,
    dropoffPhone,
    marketItems,
    budget,
    budgetFlexibility,
    estimatedPrice,
    marketCoordinates
  } = orderData || {};

  const handleEdit = (field) => {
    onEdit(field);
    onClose();
  };

  const handleContinueClick = async () => {
    try {
      setIsConnecting(true);
      console.log(' Full auth state:', currentUser);
      const userId = currentUser?._id;
      if (!userId) {
        console.error('No user found');
        setIsConnecting(false);
        alert('User not found. Please login again.');
        return;
      }

      // Update profile with current request data
      console.log('Sending currentRequest:', {
        pickupLocation: serviceType === "run-errand" ? orderData?.marketLocation : orderData?.pickupLocation,
        deliveryLocation: orderData?.deliveryLocation
      });

      const result = await dispatch(updateProfile({
        currentRequest: {
          serviceType: serviceType,
          fleetType: fleetType,
          userId: userId,
          timestamp: new Date().toISOString(),

          // common
          deliveryLocation: orderData?.deliveryLocation,
          status: "awaiting_runner_connection",

          // conditional fields based on service type
          ...(serviceType === "run-errand" ? {
            marketLocation: orderData?.marketLocation,
            marketItems: orderData?.marketItems,
            budget: orderData?.budget,
            budgetFlexibility: orderData?.budgetFlexibility || "stay within budget",
            marketCoordinates: orderData?.marketCoordinates,
          } : {
            pickupLocation: orderData?.pickupLocation,
            pickupItems: orderData?.pickupItems,
            pickupPhone: orderData?.pickupPhone,
            pickupCoordinates: orderData?.pickupCoordinates,
            dropoffPhone: orderData?.dropoffPhone,
          }),
        }
      })).unwrap();


      // 200 from server
      console.log(' Profile updated successfully');
      onServerUpdated(); // Set serverUpdated = true in Welcome

      // Upload special instructions media files if they exist
      if (orderData?.specialInstructions &&
        typeof orderData.specialInstructions === 'object' &&
        orderData.specialInstructions.media?.length > 0 &&
        socket && isConnected) {

        const chatId = `user-${userId}-runner-pending`;

        console.log('Uploading special instructions media...');

        // Upload each media file
        for (const media of orderData.specialInstructions.media) {
          if (media.file) {
            try {
              const reader = new FileReader();
              reader.readAsDataURL(media.file);

              await new Promise((resolve, reject) => {
                reader.onload = () => {
                  uploadFile({
                    chatId,
                    file: reader.result,
                    fileName: media.name,
                    fileType: media.type,
                    senderId: userId,
                    senderType: "user",
                    isSpecialInstruction: true, // Flag to identify this
                  });
                  resolve();
                };
                reader.onerror = reject;
              });
            } catch (error) {
              console.error('Error uploading media:', error);
            }
          }
        }
      }

      // Call onContinue to fetch runners
      onContinue();

    } catch (error) {
      console.error('Failed to update profile:', error);
      setIsConnecting(false);
      // Stay in modal, show error
      alert('Failed to update server. Please try again.');
    }
  };

  // Get the location to display based on service type
  const locationToDisplay = serviceType === "run-errand" ? marketLocation : pickupLocation;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className={`w-full sm:max-w-lg sm:mx-4 sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto ${darkMode ? "bg-black-100 text-white" : "bg-white text-black-200"
          }`}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 bg-inherit">
          <h2 className="text-xl font-bold">Confirm Your Order</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          {serviceType === "run-errand" && (
            <div className="p-4 bg-primary/10 rounded-lg ">
              <div className="flex items-center gap-1">
                <span className="font-medium">Note:</span><span className="text-sm">This Sevice attracts a fee of 25% of your total purchase</span>
              </div>
            </div>
          )}

          {/* Service Type */}
          <div className="flex items-start justify-between p-3 bg-gray-200 dark:bg-black-100 border-b border-t">
            <div className="flex items-start gap-1 justify-center items-center">
              <p className="text-sm font-medium opacity-70">Service Type: </p> <span className="text-md font-semibold capitalize">{serviceType?.replace("-", " ")}</span>
            </div>
          </div>

          {/* Pickup/Market Location */}
          <div className="flex items-start justify-between p-3 bg-gray-200 dark:bg-black-100 border-b">
            <div className="flex items-start gap-3 flex-1">
              <MapPin className="h-5 w-5 mt-0.5 text-green-500" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium opacity-70">
                  {serviceType === "run-errand" ? "Market Location" : "Pickup Location"}
                </p>
                <p className="font-semibold truncate">{locationToDisplay}</p>
                {/* Show coordinates if available (only for run-errand) */}
                {serviceType === "run-errand" && marketCoordinates && (
                  <p className="text-xs opacity-60 mt-1">
                    📍 {marketCoordinates.lat?.toFixed(6)}, {marketCoordinates.lng?.toFixed(6)}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={() => handleEdit(serviceType === "run-errand" ? "market-location" : "pickup-location")}
              className="p-2 border-gray-800 border rounded-lg transition-colors ml-2"
            >
              <Edit2 className="h-4 w-4 text-primary" />
            </button>
          </div>

          {/* Pickup Phone (only for pick-up service) */}
          {serviceType === "pick-up" && pickupPhone && (
            <div className="flex items-start justify-between p-3 bg-gray-200 dark:bg-black-100 border-b">
              <div className="flex items-start gap-3 flex-1">
                <Phone className="h-5 w-5 mt-0.5 text-secondary" />
                <div>
                  <p className="text-sm font-medium opacity-70">Pickup Contact</p>
                  <p className="font-semibold">{pickupPhone}</p>
                </div>
              </div>
              <button
                onClick={() => handleEdit("pickup-phone")}
                className="p-2 border-gray-800 border rounded-lg transition-colors ml-2"
              >
                <Edit2 className="h-4 w-4 text-primary" />
              </button>
            </div>
          )}

          {/* Pickup Items (only for pick-up service) */}
          {serviceType === "pick-up" && orderData?.pickupItems && (
            <div className="flex items-start justify-between p-3 bg-gray-200 dark:bg-black-100 border-b">
              <div className="flex items-start gap-3 flex-1">
                <Package className="h-5 w-5 mt-0.5 text-orange-500" />
                <div>
                  <p className="text-sm font-medium opacity-70">Item(s) to Pick Up</p>
                  <p className="font-semibold">{orderData.pickupItems}</p>
                </div>
              </div>
              <button
                onClick={() => handleEdit("pickup-items")}
                className="p-2 border-gray-800 border rounded-lg transition-colors ml-2"
              >
                <Edit2 className="h-4 w-4 text-primary" />
              </button>
            </div>
          )}

          {/* Market Items (only for run-errand) */}
          {serviceType === "run-errand" && marketItems && (
            <div className="flex items-start justify-between p-3 bg-gray-200 dark:bg-black-100 border-b">
              <div className="flex items-start gap-3 flex-1">
                <Package className="h-5 w-5 mt-0.5 text-orange-500" />
                <div>
                  <p className="text-sm font-medium opacity-70">Items to Buy</p>
                  <p className="font-semibold">{marketItems}</p>
                </div>
              </div>
              <button
                onClick={() => handleEdit("market-items")}
                className="p-2 border-gray-800 border rounded-lg transition-colors ml-2"
              >
                <Edit2 className="h-4 w-4 text-primary" />
              </button>
            </div>
          )}

          {/* Budget (only for run-errand) */}
          {serviceType === "run-errand" && budget && (
            <div className="flex items-start justify-between p-3 bg-gray-200 dark:bg-black-100 border-b">
              <div className="flex items-start gap-3 flex-1">
                <DollarSign className="h-5 w-5 mt-0.5 text-green-600" />
                <div>
                  <p className="text-sm font-medium opacity-70">Budget</p>
                  <p className="font-semibold">₦{budget}</p>
                  <p className="text-xs opacity-60 mt-1">
                    {budgetFlexibility === "stay within budget" ? "Strict budget" : "Flexible budget"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleEdit("market-budget")}
                className="p-2 border-gray-800 border rounded-lg transition-colors ml-2"
              >
                <Edit2 className="h-4 w-4 text-primary" />
              </button>
            </div>
          )}

          {/* Delivery Location */}
          <div className="flex items-start justify-between p-3 bg-gray-200 dark:bg-black-100 border-b">
            <div className="flex items-start gap-3 flex-1">
              <MapPin className="h-5 w-5 mt-0.5 text-red-500" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium opacity-70">Delivery Location</p>
                <p className="font-semibold truncate">{deliveryLocation}</p>
              </div>
            </div>
            <button
              onClick={() => handleEdit("delivery-location")}
              className="p-2 border-gray-800 border rounded-lg transition-colors ml-2"
            >
              <Edit2 className="h-4 w-4 text-primary" />
            </button>
          </div>

          {/* Dropoff Phone (only for pick-up service) */}
          {serviceType === "pick-up" && dropoffPhone && (
            <div className="flex items-start justify-between p-3 bg-gray-200 dark:bg-black-100 border-b">
              <div className="flex items-start gap-3 flex-1">
                <Phone className="h-5 w-5 mt-0.5 text-purple-500" />
                <div>
                  <p className="text-sm font-medium opacity-70">Dropoff Contact</p>
                  <p className="font-semibold">{dropoffPhone}</p>
                </div>
              </div>
              <button
                onClick={() => handleEdit("dropoff-phone")}
                className="p-2 border-gray-800 border rounded-lg transition-colors ml-2"
              >
                <Edit2 className="h-4 w-4 text-primary" />
              </button>
            </div>
          )}

          {/* Fleet Type */}
          <div className="flex items-start justify-between p-3 bg-gray-200 dark:bg-black-100 border-b">
            <div className="flex items-start gap-3 flex-1">
              <Truck className="h-5 w-5 mt-0.5 text-indigo-500" />
              <div>
                <p className="text-sm font-medium opacity-70">Vehicle Type</p>
                <p className="font-semibold capitalize">{fleetType}</p>
              </div>
            </div>
            <button
              onClick={() => handleEdit("fleet-type")}
              className="p-2 border-gray-800 border rounded-lg transition-colors ml-2"
            >
              <Edit2 className="h-4 w-4 text-primary" />
            </button>
          </div>

          {/* Special Instructions */}
          {specialInstructions && (
            // Check if there's actual text or media before showing the div
            (typeof specialInstructions === 'string' && specialInstructions.trim()) ||
            (typeof specialInstructions === 'object' && (specialInstructions.text?.trim() || specialInstructions.media?.length > 0))
          ) && (
              <div className="flex flex-col p-3 rounded-lg border border-gray-300">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    {/* <Package className="h-5 w-5 mt-0.5 text-yellow-500" /> */}
                    <div className="flex-1">
                      <p className="text-sm font-medium">Special Instructions</p>

                      {/* Text instructions */}
                      {typeof specialInstructions === 'string' && (
                        <p className="font-semibold whitespace-pre-wrap mt-1 text-sm">{specialInstructions}</p>
                      )}

                      {/* Object format with text and media */}
                      {typeof specialInstructions === 'object' && (
                        <>
                          {specialInstructions.text && (
                            <p className="font-semibold whitespace-pre-wrap mt-1">{specialInstructions.text}</p>
                          )}

                          {/* Media attachments */}
                          {/* Media attachments */}
                          {specialInstructions.media && specialInstructions.media.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-3 ">
                              {specialInstructions.media.map((media, idx) => {
                                // Create a fresh blob URL if needed
                                const getPreviewUrl = () => {
                                  if (media.preview && !media.preview.startsWith('blob:')) {
                                    return media.preview;
                                  }
                                  if (media.fileUrl) {
                                    return media.fileUrl;
                                  }
                                  if (media.file) {
                                    // Create new blob URL from file object
                                    return URL.createObjectURL(media.file);
                                  }
                                  return null;
                                };

                                const previewUrl = getPreviewUrl();

                                return (
                                  <div key={idx} className="relative flex-shrink-0 ">
                                    {media.type?.startsWith('image/') && previewUrl ? (
                                      <img
                                        src={previewUrl}
                                        alt="Attachment"
                                        className="w-20 h-20 object-cover rounded-lg border-2 border-gray-300 dark:border-gray-600"
                                        onError={(e) => {
                                          console.error('Image failed to load:', previewUrl);
                                          e.target.style.display = 'none';
                                        }}
                                      />
                                    ) : media.type?.startsWith('audio/') ? (
                                      <div className="w-full min-w-[250px] bg-primary rounded-lg p-2">
                                        <audio
                                          controls
                                          className="w-full h-10"
                                          style={{ maxWidth: '100%' }}
                                        >
                                          <source src={previewUrl} type="audio/webm" />
                                          <source src={previewUrl} type="audio/mpeg" />
                                          <source src={previewUrl} type="audio/mp3" />
                                          Your browser does not support audio playback.
                                        </audio>
                                      </div>
                                    ) : (
                                      <div className="w-20 h-20 bg-gray-200 dark:bg-gray-700 rounded-lg flex flex-col items-center justify-center">
                                        <span className="text-2xl mb-1">📎</span>
                                        <span className="text-xs truncate max-w-full px-1">
                                          {media.name?.split('.').pop()}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-3">
                    <button
                      onClick={() => handleEdit("special-instructions")}
                      className="p-2 border-gray-800 border rounded-lg transition-colors ml-2 self-start"
                    >
                      <Edit2 className="h-4 w-4 text-primary" />
                    </button>
                    <button
                      onClick={() => handleEdit("special-instructions")}
                      className="p-2 border-gray-800 border rounded-lg transition-colors ml-2 self-start"
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </button>
                  </div>
                </div>
              </div>
            )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 p-4 bg-inherit">
          <Button
            onClick={handleContinueClick}
            disabled={isConnecting} // Disable button while connecting
            className={`w-full bg-primary text-white py-3 text-lg font-semibold flex items-center justify-center gap-2 ${isConnecting ? 'cursor-not-allowed bg-gray-300' : ''
              }`}
          >
            {isConnecting ? (
              <>
                <div className="flex justify-center items-center gap-3">
                  <BarLoader size={18} />
                  Connecting...
                </div>
              </>
            ) : (
              'Continue'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}