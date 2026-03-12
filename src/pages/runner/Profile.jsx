// runner/profile
import { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { ChevronLeft, ChevronRight, User, Trash2, Camera, Star, Phone, Shield, KeyRound } from 'lucide-react';
import { getRunnerRatings } from '../../Redux/ratingSlice';
import api from '../../utils/api';
import { setPin, resetPin, } from '../../Redux/pinSlice';
import { PinPad } from '../../components/common/PinPad';

const ConfirmModal = ({ field, value, onConfirm, onCancel, dark }) => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className={`bg-white dark:bg-black-100 rounded-2xl shadow-xl max-w-sm w-full p-6`}>
            <h2 className="text-lg font-bold text-black-200 dark:text-gray-200 mb-2">Save changes?</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                Update <span className="font-medium capitalize">{field}</span> to:
            </p>
            <p className="text-sm font-semibold text-black-200 dark:text-white mb-6 break-all">"{value}"</p>
            <div className="flex justify-end gap-3 font-medium">
                <button onClick={onCancel} className="text-gray-500 dark:text-gray-400">Cancel</button>
                <button onClick={onConfirm} className="text-primary">Save</button>
            </div>
        </div>
    </div>
);

const StarDisplay = ({ rating }) => {
    return (
        <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map(star => (
                <Star
                    key={star}
                    className={`w-4 h-4 ${star <= Math.round(rating)
                        ? 'text-yellow-400 fill-yellow-400'
                        : 'text-gray-300 dark:text-gray-600'}`}
                />
            ))}
        </div>
    );
};

export const Profile = ({ darkMode, onBack, runnerId, registrationComplete, runnerData: initialRunnerData }) => {
    const dispatch = useDispatch();
    const { averageRating, totalRatings } = useSelector(state => state.rating);

    const [runnerData, setRunnerData] = useState(initialRunnerData || {});
    const [editingField, setEditingField] = useState(null); // 'firstName' | 'lastName' | 'email'
    const [editValue, setEditValue] = useState('');
    const [confirmModal, setConfirmModal] = useState(null); // { field, value }
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState(null);
    const [avatarUploading, setAvatarUploading] = useState(false);
    const fileInputRef = useRef(null);

    const { status: pinStatus, error: pinError, isPinSet } = useSelector(state => state.pin); // eslint-disable-line no-unused-vars

    const [pinMode, setPinMode] = useState(null); // null | 'set' | 'reset_current' | 'reset_new' | 'forgot'
    const [pinStep, setPinStep] = useState(null); // eslint-disable-line no-unused-vars
    const [collectedCurrentPin, setCollectedCurrentPin] = useState('');
    const [pinSaveError, setPinSaveError] = useState(null);
    const [pinSuccess, setPinSuccess] = useState(null);

    // check is user has pin already
    const hasPinSet = runnerData?.pin !== undefined || isPinSet;

    // Fetch fresh profile + ratings on mount
    useEffect(() => {
        if (!registrationComplete || !runnerId) return;

        api.get('/runners/profile')
            .then(res => {
                const runner = res.data?.runner || res.data?.data?.runner;
                if (runner) setRunnerData(runner);
            })
            .catch(err => console.error('Profile fetch error:', err));

        dispatch(getRunnerRatings({ runnerId, page: 1 }));
    }, [runnerId, registrationComplete, dispatch]);

    const handleEditStart = (field, currentValue) => {
        setEditingField(field);
        setEditValue(currentValue || '');
        setSaveError(null);
    };

    const handleEditKeyDown = (e) => {
        if (e.key === 'Enter') handleSaveAttempt();
        if (e.key === 'Escape') setEditingField(null);
    };

    const handleSaveAttempt = () => {
        if (!editValue.trim()) return;
        // Only show modal if value actually changed
        if (editValue.trim() === (runnerData[editingField] || '').trim()) {
            setEditingField(null);
            return;
        }
        setConfirmModal({ field: editingField, value: editValue.trim() });
    };

    const handleConfirmSave = async () => {
        const { field, value } = confirmModal;
        setConfirmModal(null);
        setEditingField(null);
        setSaving(true);
        setSaveError(null);

        try {
            const res = await api.patch(`/runners/${runnerId}`, { [field]: value });
            const updated = res.data?.runner || res.data?.data?.runner;
            if (updated) setRunnerData(updated);
            else setRunnerData(prev => ({ ...prev, [field]: value }));
        } catch (err) {
            setSaveError('Failed to save. Please try again.');
            console.error('Profile update error:', err);
        } finally {
            setSaving(false);
        }
    };

    const handleAvatarChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setAvatarUploading(true);
        try {
            const formData = new FormData();
            formData.append('avatar', file);
            const res = await api.patch(`/runners/${runnerId}/avatar`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            const updated = res.data?.runner || res.data?.data?.runner;
            if (updated) setRunnerData(updated);
        } catch (err) {
            console.error('Avatar upload error:', err);
        } finally {
            setAvatarUploading(false);
        }
    };

    const fields = [
        { key: 'firstName', label: 'First Name' },
        { key: 'lastName', label: 'Last Name' },
        // { key: 'phone', label: 'Phone' },
    ];

    if (!registrationComplete) {
        return (
            <div className={`min-h-screen flex flex-col bg-white dark:bg-black-100 ${darkMode ? 'dark' : ''}`}>
                <div className="flex items-center border-b border-gray-100 dark:border-white/10 p-3">
                    <div onClick={onBack} className="cursor-pointer text-black-200 dark:text-gray-300">
                        <ChevronLeft />
                    </div>
                    <h1 className="text-lg font-bold mx-auto text-black-200 dark:text-gray-300">Profile</h1>
                </div>
                <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20">
                    <p className="text-gray-500 dark:text-gray-400 font-medium">Nothing to see here yet</p>
                    <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Complete your registration first</p>
                </div>
            </div>
        );
    }

    return (
        <div className={`min-h-screen flex flex-col bg-white dark:bg-black-100 ${darkMode ? 'dark' : ''}`}>
            {/* Header */}
            <div className="flex items-center border-b border-gray-100 dark:border-white/10 p-3">
                <div onClick={onBack} className="cursor-pointer text-black-200 dark:text-gray-300">
                    <ChevronLeft />
                </div>
                <h1 className="text-lg font-bold mx-auto text-black-200 dark:text-gray-300">Profile</h1>
            </div>

            <div className="flex-1 overflow-y-auto">
                {/* Avatar */}
                <div className="flex flex-col items-center py-6 px-4">
                    <div className="relative">
                        <div className="w-20 h-20 rounded-full bg-gray-200 dark:bg-black-200 overflow-hidden flex items-center justify-center">
                            {runnerData.profilePicture ? (
                                <img src={runnerData.profilePicture} alt="avatar" className="w-full h-full object-cover" />
                            ) : (
                                <User className="w-8 h-8 text-gray-400" />
                            )}
                        </div>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={avatarUploading}
                            className="absolute bottom-0 right-0 w-7 h-7 bg-primary rounded-full flex items-center justify-center shadow-md disabled:opacity-50"
                        >
                            <Camera className="w-3.5 h-3.5 text-white" />
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleAvatarChange}
                        />
                    </div>
                    {avatarUploading && (
                        <p className="text-xs text-gray-400 mt-2">Uploading...</p>
                    )}

                    {/* Rating */}
                    {totalRatings > 0 && (
                        <div className="flex flex-col items-center mt-3 gap-1">
                            <StarDisplay rating={averageRating} />
                            <p className="text-xs text-gray-400 dark:text-gray-500">
                                {averageRating.toFixed(1)} · {totalRatings} rating{totalRatings !== 1 ? 's' : ''}
                            </p>
                        </div>
                    )}
                    {totalRatings === 0 && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">No ratings yet</p>
                    )}
                </div>

                {/* Editable fields */}
                <div className="px-4 pb-4 space-y-3">
                    {fields.map(({ key, label }) => (
                        <div key={key} className="border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3">
                            <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">{label}</p>
                            {editingField === key ? (
                                <input
                                    autoFocus
                                    value={editValue}
                                    onChange={e => setEditValue(e.target.value)}
                                    onKeyDown={handleEditKeyDown}
                                    onBlur={handleSaveAttempt}
                                    className="w-full text-sm text-black-200 dark:text-white bg-transparent outline-none border-b border-primary pb-0.5"
                                />
                            ) : (
                                <div
                                    className="flex items-center justify-between cursor-pointer"
                                    onClick={() => handleEditStart(key, runnerData[key])}
                                >
                                    <p className="text-sm text-black-200 dark:text-gray-200">
                                        {runnerData[key] || <span className="text-gray-400">Not set</span>}
                                    </p>
                                    <ChevronRight className="w-4 h-4 text-gray-400" />
                                </div>
                            )}
                        </div>
                    ))}

                    {/* Phone — read only */}
                    <div className="border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3">
                        <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">Email</p>
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-black-200 dark:text-gray-200">{runnerData.email || '—'}</p>
                            <div className="flex items-center gap-1">
                                <Phone className="w-3.5 h-3.5 text-gray-400" />
                                <span className="text-xs text-gray-400">Contact support to change</span>
                            </div>
                        </div>
                    </div>

                    {saveError && (
                        <p className="text-xs text-red-500 text-center">{saveError}</p>
                    )}
                    {saving && (
                        <p className="text-xs text-gray-400 text-center">Saving...</p>
                    )}
                </div>

                {/* ── PIN Management ─────────────────────────────────────────── */}
                <div className="px-4 pb-4">
                    <p className={`text-xs font-semibold uppercase tracking-widest mb-3 
    ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                        Security
                    </p>

                    {pinSuccess && (
                        <div className="mb-3 p-3 rounded-xl bg-green-500/10 text-green-500 text-xs text-center font-medium">
                            {pinSuccess}
                        </div>
                    )}
                    {pinSaveError && (
                        <div className="mb-3 p-3 rounded-xl bg-red-500/10 text-red-500 text-xs text-center">
                            {pinSaveError}
                        </div>
                    )}

                    {!hasPinSet ? (
                        // ── No PIN set yet ──────────────────────────────────────────
                        <button
                            onClick={() => { setPinMode('set'); setPinSaveError(null); setPinSuccess(null); }}
                            className="w-full flex items-center justify-between border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                    <Shield className="w-4 h-4 text-primary" />
                                </div>
                                <div className="text-left">
                                    <p className="text-sm font-medium text-black-200 dark:text-gray-200">Set Transaction PIN</p>
                                    <p className="text-xs text-gray-400 mt-0.5">Required for withdrawals & transfers</p>
                                </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                        </button>
                    ) : (
                        // ── PIN already set ─────────────────────────────────────────
                        <div className="space-y-2">
                            <button
                                onClick={() => { setPinMode('reset_current'); setPinSaveError(null); setPinSuccess(null); }}
                                className="w-full flex items-center justify-between border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                        <KeyRound className="w-4 h-4 text-primary" />
                                    </div>
                                    <div className="text-left">
                                        <p className="text-sm font-medium text-black-200 dark:text-gray-200">Change PIN</p>
                                        <p className="text-xs text-gray-400 mt-0.5">Enter current PIN then set new one</p>
                                    </div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-gray-400" />
                            </button>

                            <button
                                onClick={() => { setPinMode('forgot'); setPinSaveError(null); setPinSuccess(null); }}
                                className="w-full flex items-center justify-between border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-yellow-500/10 flex items-center justify-center">
                                        <Shield className="w-4 h-4 text-yellow-500" />
                                    </div>
                                    <div className="text-left">
                                        <p className="text-sm font-medium text-black-200 dark:text-gray-200">Forgot PIN</p>
                                        <p className="text-xs text-gray-400 mt-0.5">Reset via identity verification</p>
                                    </div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-gray-400" />
                            </button>
                        </div>
                    )}
                </div>

                {/* ── PIN Modals ──────────────────────────────────────────────── */}

                {/* Set PIN — single step, collect new PIN */}
                {pinMode === 'set' && (
                    <PinPad
                        dark={darkMode}
                        title="Set Transaction PIN"
                        subtitle="Choose a 4-digit PIN for payments"
                        skipVerify
                        confirmMode={true}
                        onPin={async (pin) => {
                            try {
                                await dispatch(setPin({ pin })).unwrap();
                                setPinMode(null);
                                setPinSuccess('PIN set successfully');
                            } catch (err) {
                                setPinSaveError(err || 'Failed to set PIN');
                                setPinMode(null);
                            }
                        }}
                        onCancel={() => setPinMode(null)}
                    />
                )}

                {/* Reset PIN — step 1: verify current PIN */}
                {pinMode === 'reset_current' && (
                    <PinPad
                        dark={darkMode}
                        title="Current PIN"
                        subtitle="Enter your current PIN to continue"
                        skipVerify
                        onPin={(pin) => {
                            setCollectedCurrentPin(pin);
                            setPinMode('reset_new');
                        }}
                        onCancel={() => setPinMode(null)}
                    />
                )}

                {/* Reset PIN — step 2: enter new PIN */}
                {pinMode === 'reset_new' && (
                    <PinPad
                        dark={darkMode}
                        title="New PIN"
                        subtitle="Choose your new 4-digit PIN"
                        skipVerify
                        confirmMode={true}
                        onPin={async (newPin) => {
                            try {
                                await dispatch(resetPin({ currentPin: collectedCurrentPin, newPin })).unwrap();
                                setPinMode(null);
                                setCollectedCurrentPin('');
                                setPinSuccess('PIN updated successfully');
                            } catch (err) {
                                setPinSaveError(err || 'Failed to update PIN. Check your current PIN.');
                                setPinMode(null);
                                setCollectedCurrentPin('');
                            }
                        }}
                        onCancel={() => { setPinMode(null); setCollectedCurrentPin(''); }}
                    />
                )}

                {/* Forgot PIN — now handles OTP inside PinPad */}
                {pinMode === 'forgot' && (
                    <PinPad
                        dark={darkMode}
                        title="Reset PIN"
                        subtitle="We'll send an OTP to verify your identity"
                        confirmMode={true}
                        forgotMode={true}
                        onVerified={() => {
                            setPinMode(null);
                            setPinSuccess('PIN reset successfully');
                        }}
                        onCancel={() => setPinMode(null)}
                    />
                )}

                {/* Delete account — disabled */}
                <div className="px-4 pb-6">
                    <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-white/10 rounded-xl opacity-40 cursor-not-allowed">
                        <div className="flex items-center gap-2">
                            <Trash2 className="w-4 h-4 text-red-400" />
                            <span className="text-sm text-red-400">Delete Account</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-600 text-center mt-2">
                        Contact support to delete your account
                    </p>
                </div>
            </div>

            {/* Confirm modal */}
            {confirmModal && (
                <ConfirmModal
                    field={confirmModal.field}
                    value={confirmModal.value}
                    onConfirm={handleConfirmSave}
                    onCancel={() => { setConfirmModal(null); setEditingField(null); }}
                    dark={darkMode}
                />
            )}

            <div className="flex justify-center p-4 text-xs text-gray-300 dark:text-gray-700">
                Sendrey
            </div>
        </div>
    );
};