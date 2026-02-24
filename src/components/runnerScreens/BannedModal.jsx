import React from 'react';
import { XCircle } from 'lucide-react';

export default function BannedModal({ isOpen, reason, darkMode }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className={`max-w-md w-full mx-4 p-6 rounded-2xl ${darkMode ? 'bg-black-200' : 'bg-white'}`}>
                <div className="flex flex-col items-center text-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
                        <XCircle className="w-8 h-8 text-red-500" />
                    </div>

                    <h2 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-black-200'}`}>
                        Account Suspended
                    </h2>

                    <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                        {reason || 'Your account has been suspended. Please contact support for assistance.'}
                    </p>


                    <a href="mailto:support@sendrey.com"
                        className="w-full py-3 px-4 bg-primary text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
                    >
                        Contact Support
                    </a>
                </div>
            </div>
        </div>
    );
}