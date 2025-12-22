import { useState } from "react";
import { X, Receipt, CreditCard } from "lucide-react";

export const InvoiceScreen = ({
  darkMode = false,
  invoiceData = null,
  runnerData = null,
  socket,
  chatId,
  userId,
  runnerId,
  onAcceptSuccess,
  onDeclineSuccess
}) => {
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showDeclineConfirm, setShowDeclineConfirm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);

  // Parse invoice data from socket
  const invoice = {
  id: invoiceData.invoiceId,
  products: invoiceData.items.map(item => ({
    description: item.name,
    qty: item.quantity,
    UnitPrice: item.unitPrice,
    subtotal: item.total
  })),
  items: [{ name: "Sub Total", amount: invoiceData.subTotal }],
  total: invoiceData.grandTotal
 };


  const runner = runnerData;

  const handleAccept = () => {
    if (!socket || !invoiceData?.invoiceId) {
      setError("Connection error. Please try again.");
      return;
    }

    setIsProcessing(true);
    setError(null);

    // Emit accept invoice
    socket.emit("acceptInvoice", {
      invoiceId: invoiceData.invoiceId,
      chatId,
      userId,
      runnerId
    });

    // Listen for errors
    const handleInvoiceError = (data) => {
      setError(data.error || "Failed to accept invoice");
      setIsProcessing(false);
    };

    socket.once("invoiceError", handleInvoiceError);

    // Success - wait for system message to arrive, then close modal
    setTimeout(() => {
      setIsProcessing(false);
      setShowInvoiceModal(false);

      if (typeof onAcceptSuccess === "function") {
        onAcceptSuccess();
      }
    }, 1000);

    // Cleanup timeout
    setTimeout(() => {
      socket.off("invoiceError", handleInvoiceError);
    }, 5000);
  };

  const handleDeclineClick = () => {
    setShowDeclineConfirm(true);
  };

  const handleDeclineConfirm = () => {
    if (!socket || !invoiceData?.invoiceId) {
      setError("Connection error. Please try again.");
      return;
    }

    setIsProcessing(true);
    setError(null);

    // Emit decline invoice
    socket.emit("declineInvoice", {
      invoiceId: invoiceData.invoiceId,
      chatId,
      userId,
      runnerId
    });

    // Listen for errors
    const handleInvoiceError = (data) => {
      setError(data.error || "Failed to decline invoice");
      setIsProcessing(false);
    };

    socket.once("invoiceError", handleInvoiceError);

    // Success - close modals
    setTimeout(() => {
      setIsProcessing(false);
      setShowDeclineConfirm(false);
      setShowInvoiceModal(false);

      if (typeof onDeclineSuccess === "function") {
        onDeclineSuccess();
      }
    }, 1000);


    // Cleanup timeout
    setTimeout(() => {
      socket.off("invoiceError", handleInvoiceError);
    }, 5000);
  };

  return (
    <>
      {/* Invoice Preview Card - Shows in chat */}
      <div className={`border rounded-lg p-3 w-60 ${darkMode ? "border-primary bg-gray-300/50" : "border-primary bg-white"
        }`}>
        <div className="flex items-center justify-between mb-2 gap-5">
          <div className="flex items-center gap-2">
            <p className={`font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>
              Invoice
            </p>
          </div>
          <p className={`text-sm ${darkMode ? "text-primary" : "text-gray-600"}`}>
            {invoice.id.slice(0, 10)}
          </p>
        </div>

        <div className="mb-4">
          <p className={`text-md mb-1 ${darkMode ? "text-primary" : "text-gray-600"}`}>
            Grand Total
          </p>
          <p className={`text-2xl font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>
            ₦{invoice.total.toLocaleString()}
          </p>
        </div>

        {error && (
          <div className="mb-3 p-2 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-600 rounded">
            <p className="text-red-700 dark:text-red-400 text-xs">{error}</p>
          </div>
        )}

        <button
          onClick={() => setShowInvoiceModal(true)}
          disabled={isProcessing}
          className="w-full bg-primary hover:bg-orange-800 text-white rounded-md py-2 font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          View Invoice
        </button>
      </div>

      {/* Invoice Details Modal */}
      {showInvoiceModal && (
        <>
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={() => !isProcessing && setShowInvoiceModal(false)}
          />

          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className={`relative w-full max-w-md rounded-t-2xl border-t-1 border-l-1 border-r-1 border-gray-300/50 overflow-hidden ${darkMode ? "bg-gray-300/50" : "bg-white"
              }`}>
              {/* Header */}
              <div className={`p-5 pb-4 border-b flex justify-center items-center ${darkMode ? "border-gray-800" : "border-gray-200"
                }`}>
                <h2 className={`text-xl font-bold ${darkMode ? "text-white" : "text-black"}`}>
                  You have received an invoice
                </h2>
              </div>

              {/* Invoice Details */}
              <div className="p-4">
                <div className="mb-3 flex flex-col items-center justify-center gap-1">
                  <p className={`text-sm font-semibold ${darkMode ? "text-white" : "text-primary"}`}>
                    {runner.firstName ? `${runner.firstName} ${runner.lastName || ""}`.trim() : "Runner"}
                  </p>
                  <p className={`text-xs ${darkMode ? "" : "text-primary"}`}>
                    Invoice ID: {invoice.id}
                  </p>
                </div>

                {/* Products Table */}
                <div className={`rounded-lg overflow-hidden ${darkMode ? "bg-gray-800" : "bg-gray-50"}`}>
                  <div className={`grid grid-cols-12 gap-2 p-3 text-xs font-semibold border-b ${darkMode ? "border-gray-700" : "border-gray-200 text-gray-600"
                    }`}>
                    <div className="col-span-5">DESCRIPTION</div>
                    <div className="col-span-2 text-center">QTY</div>
                    <div className="col-span-3 text-right">UNIT PRICE</div>
                    <div className="col-span-2 text-right">SUBTOTAL</div>
                  </div>

                  {invoice.products.map((product, index) => (
                    <div
                      key={index}
                      className={`grid grid-cols-12 gap-2 p-3 text-sm ${index !== invoice.products.length - 1
                        ? `border-b ${darkMode ? "border-gray-700" : "border-gray-200"}`
                        : ""
                        }`}
                    >
                      <div className={`col-span-5 ${darkMode ? "text-white" : "text-gray-900"}`}>
                        {product.description}
                      </div>
                      <div className={`col-span-2 text-center ${darkMode ? "" : "text-gray-600"}`}>
                        {product.qty}
                      </div>
                      <div className={`col-span-3 text-right ${darkMode ? "" : "text-gray-600"}`}>
                        ₦{product.UnitPrice.toLocaleString()}
                      </div>
                      <div className={`col-span-2 text-right font-medium ${darkMode ? "text-white" : "text-gray-900"}`}>
                        ₦{product.subtotal.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>

                <div className={`border-b mb-4 ${darkMode ? "border-gray-800" : "border-gray-200"}`}></div>

                {/* Line Items */}
                <div className="space-y-3 mb-6">
                  {invoice.items.map((item, index) => (
                    <div key={index} className="flex justify-between">
                      <p className={darkMode ? "text-white" : "text-gray-600"}>
                        {item.name}
                      </p>
                      <p className={`font-medium ${darkMode ? "text-white" : "text-gray-900"}`}>
                        ₦{item.amount.toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Total */}
                <div className={`pt-4 border-t ${darkMode ? "border-gray-800" : "border-gray-200"}`}>
                  <div className="flex justify-between items-center">
                    <p className={`text-lg font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>
                      Grand Total
                    </p>
                    <p className={`text-2xl font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>
                      ₦{invoice.total.toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className={`border-b mt-4 ${darkMode ? "border-gray-800" : "border-gray-200"}`}></div>
              </div>

              {/* Action Buttons */}
              <div className="p-6 pt-0 flex gap-3">
                <button
                  onClick={handleAccept}
                  disabled={isProcessing}
                  className="flex-1 bg-primary hover:bg-orange-800 text-white rounded-full py-3 font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? "Processing..." : "Accept"}
                </button>
                <button
                  onClick={handleDeclineClick}
                  disabled={isProcessing}
                  className={`flex-1 rounded-full border-2 py-3 font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${darkMode
                    ? "border-gray-700 bg-gray-800 text-white"
                    : "border-gray-300 bg-gray-100 hover:bg-gray-200 text-gray-700"
                    }`}
                >
                  Decline
                </button>
              </div>

              {/* Zigzag Bottom Design */}
              <div className="relative h-4 overflow-hidden">
                <div
                  className={`absolute bottom-0 w-full h-4 ${darkMode ? "bg-black-200" : "bg-white"
                    }`}
                  style={{
                    clipPath:
                      "polygon(0 0, 3% 50%, 6% 0, 9% 50%, 12% 0, 15% 50%, 18% 0, 21% 50%, 24% 0, 27% 50%, 30% 0, 33% 50%, 36% 0, 39% 50%, 42% 0, 45% 50%, 48% 0, 51% 50%, 54% 0, 57% 50%, 60% 0, 63% 50%, 66% 0, 69% 50%, 72% 0, 75% 50%, 78% 0, 81% 50%, 84% 0, 87% 50%, 90% 0, 93% 50%, 96% 0, 99% 50%, 100% 0, 100% 100%, 0 100%)",
                  }}
                />
              </div>
            </div>
          </div>
        </>
      )}

      {/* Decline Confirmation Modal */}
      {showDeclineConfirm && (
        <>
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70]"
            onClick={() => !isProcessing && setShowDeclineConfirm(false)}
          />

          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className={`relative w-full max-w-sm rounded-2xl p-6 ${darkMode ? "bg-gray-900/50" : "bg-white"
              }`}>
              <h3 className={`text-lg font-bold mb-3 text-center ${darkMode ? "text-white" : "text-gray-900"
                }`}>
                Decline Invoice?
              </h3>

              <p className={`text-sm mb-6 text-center ${darkMode ? "" : "text-gray-600"
                }`}>
                Are you sure you want to decline this invoice? The runner will be able to send a new one.
              </p>

              <div className={`border-b mb-4 ${darkMode ? "border-gray-800" : "border-gray-200"}`}></div>

              <div className="flex gap-3">
                <button
                  onClick={handleDeclineConfirm}
                  disabled={isProcessing}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-full py-3 font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? "Declining..." : "Yes, Decline"}
                </button>
                <button
                  onClick={() => setShowDeclineConfirm(false)}
                  disabled={isProcessing}
                  className={`flex-1 rounded-full border-2 py-3 font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${darkMode
                    ? "border-gray-700 bg-gray-800 hover:bg-gray-700 text-gray-300"
                    : "border-gray-300 bg-gray-100 hover:bg-gray-200 text-gray-700"
                    }`}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* No Payment Method Modal */}
      {showPaymentModal && (
        <>
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
            onClick={() => setShowPaymentModal(false)}
          />

          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className={`relative w-full max-w-sm rounded-2xl p-6 ${darkMode ? "bg-gray-900" : "bg-white"
              }`}>
              <button
                onClick={() => setShowPaymentModal(false)}
                className={`absolute top-4 right-4 p-2 rounded-full ${darkMode ? "text-white hover:bg-gray-800" : "text-gray-900 hover:bg-gray-100"
                  }`}
                aria-label="Close Payment Modal"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="text-center mb-6">
                <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${darkMode ? "bg-gray-800" : "bg-gray-100"
                  }`}>
                  <CreditCard className="h-8 w-8 text-primary" />
                </div>

                <h3 className={`text-lg font-bold mb-2 ${darkMode ? "text-white" : "text-gray-900"}`}>
                  Payment Method
                </h3>
                <p className={`text-md ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                  Please select a payment method. The money would be held in your Card and would be deducted when the order is delivered
                </p>
              </div>

              <div className={`border-b mb-4 ${darkMode ? "border-gray-800" : "border-gray-300"}`}></div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowPaymentModal(false);
                    console.log("Navigate to payment methods");
                  }}
                  className="flex-1 text-primary py-3 font-medium"
                >
                  Continue
                </button>
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className={`flex-1 py-3 font-medium ${darkMode ? "text-gray-300" : "text-gray-700"
                    }`}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default InvoiceScreen;