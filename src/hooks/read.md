

6. Create a call service-video calls.


/ ═══════════════════════════════════════════════════════════════════════════════
// 6. HANDLE "task_completed" ON USER SIDE (RunnerChatScreen / ChatScreen)
// ═══════════════════════════════════════════════════════════════════════════════

// Recommended approach:
// - Show a "Order Completed" overlay/banner in the chat
// - Disable the chat input
// - Show a "Rate your runner" button + "Back to Home" button
// - Don't auto-redirect — let the user choose when to leave
//   (they might want to screenshot the chat, say thanks, etc.)

// In ChatScreen, listen for task_completed socket event:
useEffect(() => {
    if (!socket) return;

    const handleTaskCompleted = (data) => {
        setTaskCompleted(true); // new state
    };

    socket.on('task_completed', handleTaskCompleted);
    return () => socket.off('task_completed', handleTaskCompleted);
}, [socket]);

// Then in JSX, when taskCompleted is true:
// 1. Show a banner at the top: "✅ Order completed!"
// 2. Disable CustomInput (pass disabled={taskCompleted} prop)
// 3. Show two buttons below chat:
//    - "Rate Runner" → opens rating modal
//    - "Back to Home" → navigates to service_selection (call onBack or navigate)

// CustomInput disabled state — add to CustomInput.jsx:
// If you don't have a disabled prop, just conditionally render it:
{!taskCompleted && <CustomInput ... />}
// And replace with:
{taskCompleted && (
    <div className="p-4 flex gap-3">
        <button onClick={() => setShowRatingModal(true)} className="flex-1 bg-primary text-white py-3 rounded-xl font-semibold">
            Rate Runner ⭐
        </button>
        <button onClick={() => navigateTo('service_selection')} className="flex-1 bg-gray-100 dark:bg-black-200 text-black-200 dark:text-white py-3 rounded-xl font-semibold">
            Back to Home
        </button>
    </div>
)}