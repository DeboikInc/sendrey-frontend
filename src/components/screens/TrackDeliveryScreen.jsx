import React, { useState } from "react";
import { ArrowLeft, MapPin } from "lucide-react";

export const TrackDeliveryScreen = ({ darkMode, trackingData, onClose }) => {
    const [isFullScreen, setIsFullScreen] = useState(false);

    const currentStage = trackingData?.currentStage || 0;
    const progressPercentage = trackingData?.progressPercentage || 0;

    const stages = [
        "Runner Completed the Order",
        "Runner drrived At delivery location",
        "Runner is on the way to delivery location",
        "Runner arrived at purchase location",
        "Runner is on the way to purchase location",
        "Runner accepted the order"
    ];

    const OpenTrackRunner = () => {
        setIsFullScreen(true);
    };

    const handleBackToChatScreen = () => {
        setIsFullScreen(false);
        if (onClose) onClose();
    };

    // Inside TrackDeliveryScreen.jsx
    if (!isFullScreen) {
        return (
            <div
                onClick={OpenTrackRunner}
                className={`w-64 p-3 rounded-2xl cursor-pointer ${darkMode ? "text-white" : " text-black-50"
                    }`}
            >
                <div className="h-24 bg-primary/30 rounded-t-xl flex items-center justify-center">
                    <MapPin className="h-8 w-8 text-primary animate-bounce" />
                </div>
                <div className="p-1 bg-primary/70">
                    <p className="font-bold text-center text-lg">Track Runner</p>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex flex-col">
            <div className={`p-4 shadow-md bg-primary`}>
                <div className="flex items-center justify-between gap-3">
                    <button onClick={handleBackToChatScreen} className="p-2">
                        <ArrowLeft className="h-6 w-6" />
                    </button>
                    <p className="text-lg font-semibold ml-auto mr-auto">Track Runner</p>
                </div>
            </div>

            <div className={`flex-1 bg-gray-200  relative`}>
                <div className="absolute text-black-200/50 inset-0 flex items-center justify-center">
                    <p>Map tracking here</p>
                </div>
            </div>

            <div className="p-6 bg-white">
                <div className="mb-6">
                    <p className="text-black-200 font-medium mb-3">% TO COMPLETE ORDER</p>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div className="bg-primary h-2 rounded-full" style={{ width: `${progressPercentage}%` }} />
                    </div>
                </div>

                <div>
                    {stages.map((stage, index) => (
                        <div key={index} className="flex items-start gap-4">
                            <div className="flex flex-col items-center">
                                <div className={`w-6 h-6 rounded-full ${currentStage >= index + 1 ? "bg-primary" : "bg-gray-300"}`} />
                                {index < stages.length - 1 && (
                                    <div className={`w-0.5 h-8 ${currentStage >= index + 1 ? "bg-primary" : "bg-gray-300"}`} />
                                )}
                            </div>
                            <div className="flex-1">
                                <p className="text-black-200 text-sm font-medium">time</p>
                                <p className="font-medium text-black-200">{stage}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};