import { useState } from "react";
import { ArrowLeft, Plus, Minus, PlusCircle, Trash2, Edit2 } from "lucide-react";

export const CreateInvoiceScreen = ({ darkMode = false, marketData }) => {
    const [showAddItemModal, setShowAddItemModal] = useState(false);
    const [items, setItems] = useState([]);
    const [itemName, setItemName] = useState("");
    const [unitPrice, setUnitPrice] = useState("");
    const [quantity, setQuantity] = useState(1);

    const calculateItemTotal = () => {
        return (parseFloat(unitPrice) || 0) * quantity;
    };

    const calculateSubTotal = () => {
        return items.reduce((sum, item) => sum + item.total, 0);
    };

    const handleAddItem = () => {
        if (!itemName || !unitPrice || quantity < 1) return;

        const newItem = {
            id: Date.now(),
            name: itemName,
            unitPrice: parseFloat(unitPrice),
            quantity: quantity,
            total: calculateItemTotal()
        };

        setItems([...items, newItem]);

        // Reset form
        setItemName("");
        setUnitPrice("");
        setQuantity(1);
        setShowAddItemModal(false);
    };

    const handleRemoveItem = (id) => {
        setItems(items.filter(item => item.id !== id));
    };

    const handleEditItem = (id) => {
        const item = items.find(i => i.id === id);
        if (item) {
            setItemName(item.name);
            setUnitPrice(item.unitPrice.toString());
            setQuantity(item.quantity);
            setItems(items.filter(i => i.id !== id));
            setShowAddItemModal(true);
        }
    };

    const increaseQuantity = () => {
        setQuantity(prev => prev + 1);
    };

    const decreaseQuantity = () => {
        setQuantity(prev => prev > 1 ? prev - 1 : 1);
    };

    return (
        <div className="h-screen flex flex-col bg-white dark:bg-gray-800">
            {/* Header */}
            <div className="bg-primary p-4 flex items-center justify-between">
                <button className="p-2">
                    <ArrowLeft className="h-6 w-6 text-white" />
                </button>
                <p className="text-white text-lg font-semibold flex-1 text-center mr-10">
                    Create Invoice
                </p>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4">
                {/* Your Invoice Section */}
                <div className="shadow rounded-lg p-4 mb-6 bg-white dark:bg-gray-900">
                    <p className={`font-semibold mb-3 ${darkMode ? "text-white" : "text-gray-900"}`}>
                        Your Invoice
                    </p>

                    <div className="rounded-lg border border-gray-300 dark:border-gray-700 p-4">
                        <p className={`text-sm mb-1 ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                            {marketData?.name || "Ikeja City Mall"}
                        </p>
                        <p className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                            {marketData?.address || "No 12 Obafemi Awolowo Way, Ikeja, Lagos"}
                        </p>
                    </div>
                </div>

                {/* Items Section */}
                <div className="mb-6">
                    <p className={`font-semibold mb-3 ${darkMode ? "text-white" : "text-gray-900"}`}>
                        Items
                    </p>

                    {/* Card */}
                    <div className="rounded-lg border border-gray-300 dark:border-gray-700 p-4 bg-white dark:bg-gray-900 flex flex-col min-h-[380px]">
                        {items.length > 0 && (
                            <div className="space-y-4 mb-4">
                                {items.map((item) => (
                                    <div key={item.id} className="pb-4 border-b border-gray-200 dark:border-gray-700 last:border-b-0">
                                        <p className={`text-md mb-1 ${darkMode ? "text-primary" : "text-black"}`}>
                                            Description
                                        </p>
                                        <p className={`font-medium mb-3 ${darkMode ? "text-white" : "text-black-200/50"}`}>
                                            {item.name}
                                        </p>
                                        
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-6">
                                                <div>
                                                    <p className={`text-xs mb-1 ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                                                        Price
                                                    </p>
                                                    <p className={`text-sm font-medium ${darkMode ? "text-white" : "text-gray-900"}`}>
                                                        ₦{item.unitPrice.toLocaleString()}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className={`text-xs mb-1 ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                                                        Quantity
                                                    </p>
                                                    <p className={`text-sm font-medium ${darkMode ? "text-white" : "text-gray-900"}`}>
                                                        {item.quantity}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <button 
                                                    onClick={() => handleRemoveItem(item.id)}
                                                    className="p-2 rounded-full border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                                <button 
                                                    onClick={() => handleEditItem(item.id)}
                                                    className="p-2 rounded-full border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
                                                >
                                                    <Edit2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="flex-1 min-h-[60px]"></div>

                        <div className="flex justify-center items-center">
                            <button
                                onClick={() => setShowAddItemModal(true)}
                                className="flex items-center gap-2 text-primary font-medium"
                            >
                                <PlusCircle className="h-5 w-5" />
                                Add item
                            </button>
                        </div>
                    </div>
                </div>

                {/* Sub Total */}
                <div className="flex justify-between items-center mb-4 px-2">
                    <p className={`${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                        Sub Total
                    </p>
                    <p className={`font-medium ${darkMode ? "text-white" : "text-gray-900"}`}>
                        ₦{calculateSubTotal().toLocaleString()}
                    </p>
                </div>

                {/* Grand Total */}
                <div className="flex justify-between items-center px-2 py-3 border-t border-gray-300 dark:border-gray-700">
                    <p className={`font-semibold text-lg ${darkMode ? "text-white" : "text-gray-900"}`}>
                        Grand Total
                    </p>
                    <p className={`font-bold text-xl ${darkMode ? "text-white" : "text-gray-900"}`}>
                        ₦{calculateSubTotal().toLocaleString()}
                    </p>
                </div>
            </div>

            {/* Send Invoice Button - Fixed at bottom */}
            <div className="p-4 border-t border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800">
                <button
                    disabled={items.length === 0}
                    className={`w-full bg-primary text-white rounded-lg py-3 font-semibold transition ${
                        items.length === 0
                            ? "opacity-50 cursor-not-allowed"
                            : "hover:bg-orange-800"
                    }`}
                >
                    Send Invoice
                </button>
            </div>

            {/* Add Item Modal */}
            {showAddItemModal && (
                <>
                    <div
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                        onClick={() => setShowAddItemModal(false)}
                    />

                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className={`relative w-full max-w-md rounded-2xl p-6 ${
                            darkMode ? "bg-gray-900" : "bg-white"
                        }`}>
                            <p className="flex justify-center text-lg font-semibold mb-6">
                                Add item
                            </p>

                            <div className={`border-b mb-6 ${darkMode ? "border-gray-800" : "border-gray-200"}`}></div>

                            {/* Item Name */}
                            <div className="mb-4">
                                <p className={`text-sm mb-2 ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                                    Item Name
                                </p>
                                <input
                                    type="text"
                                    placeholder="e.g Pizza"
                                    value={itemName}
                                    onChange={(e) => setItemName(e.target.value)}
                                    className={`w-full px-4 py-2 rounded-lg border ${
                                        darkMode
                                            ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500"
                                            : "bg-white border-gray-300 text-gray-900 placeholder-gray-400"
                                    } focus:outline-none focus:ring-2 focus:ring-primary`}
                                />
                            </div>

                            {/* Unit Price */}
                            <div className="mb-4">
                                <p className={`text-sm mb-2 ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                                    Unit Price
                                </p>
                                <input
                                    type="number"
                                    placeholder="e.g 2500"
                                    value={unitPrice}
                                    onChange={(e) => setUnitPrice(e.target.value)}
                                    className={`w-full px-4 py-2 rounded-lg border ${
                                        darkMode
                                            ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500"
                                            : "bg-white border-gray-300 text-gray-900 placeholder-gray-400"
                                    } focus:outline-none focus:ring-2 focus:ring-primary`}
                                />
                            </div>

                            {/* Quantity */}
                            <div className="mb-4">
                                <p className={`text-sm mb-2 ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                                    Quantity
                                </p>
                                <div className="flex items-center justify-start gap-2">
                                    <button
                                        onClick={decreaseQuantity}
                                        className={`p-2 rounded-md ${
                                            darkMode ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-900"
                                        } hover:bg-primary hover:text-white transition`}
                                    >
                                        <Minus className="h-5 w-5" />
                                    </button>
                                    <span className={`text-2xl font-semibold min-w-[40px] text-center ${
                                        darkMode ? "text-white" : "text-gray-900"
                                    }`}>
                                        {quantity}
                                    </span>
                                    <button
                                        onClick={increaseQuantity}
                                        className={`p-2 rounded-md ${
                                            darkMode ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-900"
                                        } hover:bg-primary hover:text-white transition`}
                                    >
                                        <Plus className="h-5 w-5" />
                                    </button>
                                </div>
                            </div>

                            {/* Total */}
                            <div className="flex justify-between items-center mb-6">
                                <p className={`font-medium ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                                    Total
                                </p>
                                <p className={`text-xl font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>
                                    ₦{calculateItemTotal().toLocaleString()}
                                </p>
                            </div>

                            <div className={`border-b mb-6 ${darkMode ? "border-gray-800" : "border-gray-200"}`}></div>

                            {/* Actions */}
                            <div className="flex">
                                <button
                                    onClick={() => {
                                        setShowAddItemModal(false);
                                        setItemName("");
                                        setUnitPrice("");
                                        setQuantity(1);
                                    }}
                                    className={`flex-1 py-3 font-medium rounded-lg transition ${
                                        darkMode
                                            ? "text-gray-300 hover:bg-gray-800"
                                            : "text-gray-700 hover:bg-gray-100"
                                    }`}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAddItem}
                                    className="flex-1 text-primary py-3 font-medium rounded-lg hover:bg-orange-50 dark:hover:bg-gray-800 transition"
                                >
                                    Add Item
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};