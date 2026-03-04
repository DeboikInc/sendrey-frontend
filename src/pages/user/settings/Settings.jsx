import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { ChevronLeft, Building2, ChevronRight, Moon, Sun } from "lucide-react";
import { getSuggestionStatus, hydrateFromUser } from "../../../Redux/businessSlice";
import Profile from "./Profile";
import UpgradeBanner from "./UpgradeBanner";
import BusinessSettings from "./BusinessSettings";

export default function Settings({ darkMode, onBack, onToggleDarkMode }) {
    const dispatch = useDispatch();
    const { user } = useSelector((s) => s.auth);
    const { suggestion, businessName } = useSelector((s) => s.business);

    const [view, setView] = useState("settings"); // "settings" | "business"

    const isBusiness = user?.accountType === "business";
    const page = darkMode ? "bg-black-100" : "bg-gray-300";
    const card = darkMode ? "bg-black-100 border-white/10" : "bg-white border-gray-100";
    const inner = darkMode ? "bg-black-200 border-white/10" : "bg-gray-50 border-gray-100";
    const heading = darkMode ? "text-white" : "text-black-200";

    useEffect(() => {
        dispatch(hydrateFromUser(user));
        if (!isBusiness) dispatch(getSuggestionStatus());

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className={`h-screen flex flex-col relative transition-colors duration-300 ${page}`}>

            {view === "business" && (
                <div className="absolute inset-0 z-10">
                    <BusinessSettings darkMode={darkMode} onBack={() => setView("settings")} />
                </div>
            )}

            {/* Header */}
            <div className={`flex items-center gap-3 px-4 py-4 border-b flex-shrink-0 ${darkMode ? "border-white/10" : "border-gray-100"}`}>
                <button
                    onClick={onBack}
                    className={`p-2 rounded-full transition-colors ${darkMode ? "hover:bg-black-200" : "hover:bg-gray-100"}`}
                >
                    <ChevronLeft className={`w-5 h-5 ${heading}`} />
                </button>
                <h1 className={`text-lg font-bold ${heading}`}>Settings</h1>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                <div className="w-full max-w-2xl mx-auto px-4 py-6 space-y-4">

                    {/* Profile */}
                    <div className={`rounded-3xl p-6 border ${card}`}>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2">
                            Profile
                        </p>
                        <Profile darkMode={darkMode} />
                    </div>

                    {/* Preferences */}
                    <div className={`rounded-3xl p-6 border ${card}`}>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-4">
                            Preferences
                        </p>
                        <button
                            onClick={onToggleDarkMode}
                            className={`w-full flex items-center justify-between p-4 rounded-2xl border ${inner}`}
                        >
                            <div className="flex items-center gap-3">
                                {darkMode
                                    ? <Moon className="h-4 w-4 text-gray-400" />
                                    : <Sun className="h-4 w-4 text-gray-400" />
                                }
                                <p className={`text-sm font-semibold ${heading}`}>
                                    {darkMode ? "Dark Mode" : "Light Mode"}
                                </p>
                            </div>
                            <div className={`w-11 h-6 rounded-full transition-colors duration-300 relative ${darkMode ? "bg-primary" : "bg-gray-200"}`}>
                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-300 ${darkMode ? "left-6" : "left-1"}`} />
                            </div>
                        </button>
                    </div>

                    {/* Business — visible only after conversion */}
                    {isBusiness && (
                        <div className={`rounded-3xl p-6 border ${card}`}>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-4">
                                Business
                            </p>
                            <button
                                onClick={() => setView("business")}
                                className={`w-full flex items-center justify-between p-4 rounded-2xl border ${inner}`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                                        <Building2 className="h-4 w-4 text-primary" />
                                    </div>
                                    <div className="text-left">
                                        <p className={`text-sm font-bold ${heading}`}>
                                            {businessName || user?.businessProfile?.businessName}
                                        </p>
                                        <p className="text-[10px] text-gray-400 font-medium">
                                            Team · Reports · Schedules
                                        </p>
                                    </div>
                                </div>
                                <ChevronRight className="h-4 w-4 text-gray-400" />
                            </button>
                        </div>
                    )}

                    {/* Upgrade banner — only for non-business users who qualify */}
                    {!isBusiness && suggestion?.shouldSuggest && (
                        <UpgradeBanner darkMode={darkMode} />
                    )}

                </div>
            </div>
        </div>
    );
}