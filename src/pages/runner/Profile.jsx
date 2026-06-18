// runner/profile
import { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
    ChevronLeft, ChevronRight, User, Trash2, Camera,
    Star, Phone, Shield, KeyRound, Clock, XCircle, CheckCircle
} from 'lucide-react';
import { getRunnerRatings } from '../../Redux/ratingSlice';
import { setPin, resetPin, setPinSet } from '../../Redux/pinSlice';
import { updateProfile, getProfile } from '../../Redux/runnerSlice';
import { PinPad } from '../../components/common/PinPad';

const ConfirmModal = ({ field, value, onConfirm, onCancel, dark }) => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className={`bg-white dark:bg-black-100 rounded-2xl shadow-xl max-w-sm w-full p-6`}>
            <h2 className="text-lg font-bold text-black-200 dark:text-gray-200 mb-2">Save changes?</h2>
            <p className="text-sm text-black-100/80 dark:text-gray-400 mb-1">
                Update <span className="font-medium capitalize">{field}</span> to:
            </p>
            <p className="text-sm font-semibold text-black-200 dark:text-white mb-6 break-all">"{value}"</p>
            <div className="flex justify-end gap-3 font-medium">
                <button onClick={onCancel} className="text-black-100/80 dark:text-gray-400">Cancel</button>
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
    const averageRating = useSelector(s => s.rating.averageRating);
    const totalRatings = useSelector(s => s.rating.totalRatings);
    const isPinSet = useSelector(s => s.pin.isPinSet);
    const profileFromStore = useSelector(s => s.runners.profile);

    const [runnerData, setRunnerData] = useState(initialRunnerData || {});
    const [editingField, setEditingField] = useState(null);
    const [editValue, setEditValue] = useState('');
    const [confirmModal, setConfirmModal] = useState(null);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState(null);
    const [avatarUploading, setAvatarUploading] = useState(false);
    const fileInputRef = useRef(null);

    const [pinMode, setPinMode] = useState(null);
    const [collectedCurrentPin, setCollectedCurrentPin] = useState('');
    const [pinSaveError, setPinSaveError] = useState(null);
    const [pinSuccess, setPinSuccess] = useState(null);

    const hasPinSet = isPinSet || runnerData?.hasPin === true;

    // Fetch fresh profile + ratings on mount
    useEffect(() => {
        if (!runnerId) return;

        const fetchData = async () => {
            try {
                const result = await dispatch(getProfile()).unwrap();
                // Handle different response structures
                const runner = result?.data?.runner || result?.runner || result?.data || result;
                if (runner) {
                    setRunnerData(runner);
                    if (runner.hasPinSet !== undefined) {
                        dispatch(setPinSet(runner.hasPinSet));
                    }
                }
            } catch (err) {
                console.error('Profile fetch error:', err);
            }
        };

        fetchData();
        dispatch(getRunnerRatings({ runnerId, page: 1 }));
    }, [runnerId, dispatch]);

    // Update local state when store profile changes
    useEffect(() => {
        if (profileFromStore) {
            setRunnerData(prev => ({ ...prev, ...profileFromStore }));
        }
    }, [profileFromStore]);

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
            const updated = await dispatch(updateProfile({ [field]: value })).unwrap();
            // Handle different response structures
            const updatedRunner = updated?.data?.runner || updated?.runner || updated?.data || updated;
            if (updatedRunner) {
                setRunnerData(updatedRunner);
            } else {
                setRunnerData(prev => ({ ...prev, [field]: value }));
            }
        } catch (err) {
            setSaveError(err?.message || 'Failed to save. Please try again.');
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
            const updated = await dispatch(updateProfile(formData)).unwrap();
            const updatedRunner = updated?.data?.runner || updated?.runner || updated?.data || updated;
            if (updatedRunner?.avatar) {
                setRunnerData(prev => ({ ...prev, avatar: updatedRunner.avatar }));
            }
        } catch (err) {
            console.error('Avatar upload error:', err);
        } finally {
            setAvatarUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const fields = [
        { key: 'firstName', label: 'First Name' },
        { key: 'lastName', label: 'Last Name' },
    ];

    if (!registrationComplete) {
        return (
            <div className={`h-full flex flex-col bg-white dark:bg-black-100 ${darkMode ? 'dark' : ''}`}>
                <div className="flex items-center border-b border-gray-100 dark:border-white/10 p-3">
                    <div onClick={onBack} className="cursor-pointer text-black-200 dark:text-gray-300">
                        <ChevronLeft />
                    </div>
                    <h1 className="text-lg font-bold mx-auto text-black-200 dark:text-gray-300">Profile</h1>
                </div>
                <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20">
                    <p className="text-black-100/80 dark:text-gray-500">Get Started to view profile</p>
                </div>
            </div>
        );
    }

    return (
        <div className={`h-screen flex flex-col bg-white dark:bg-black-100 ${darkMode ? 'dark' : ''}`}>
            {/* Header */}
            <div className="flex items-center border-b border-gray-100 dark:border-white/10 p-3">
                <div onClick={onBack} className="cursor-pointer text-black-200 dark:text-gray-300">
                    <ChevronLeft />
                </div>
                <h1 className="text-lg font-bold mx-auto text-black-200 dark:text-gray-300">Profile</h1>
            </div>

            <div className="flex-1 overflow-y-auto marketSelection">
                {/* Avatar */}
                <div className="flex flex-col items-center py-6 px-4">
                    <div className="relative">
                        <div className="w-20 h-20 rounded-full bg-gray-200 dark:bg-black-200 overflow-hidden flex items-center justify-center">
                            {runnerData.avatar ? (
                                <img src={runnerData.avatar} alt="avatar" className="w-full h-full object-cover" />
                            ) : (
                                <User className="w-8 h-8 text-black-100/80 dark:text-gray-400" />
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
                        <p className="text-xs text-black-100/80 dark:text-gray-400 mt-2">Uploading...</p>
                    )}

                    {/* Rating */}
                    {totalRatings > 0 && (
                        <div className="flex flex-col items-center mt-3 gap-1">
                            <StarDisplay rating={averageRating} />
                            <p className="text-xs text-black-100/80 dark:text-gray-500">
                                {averageRating.toFixed(1)} · {totalRatings} rating{totalRatings !== 1 ? 's' : ''}
                            </p>
                        </div>
                    )}
                    {totalRatings === 0 && (
                        <p className="text-xs text-black-100/80 dark:text-gray-500 mt-3">No ratings yet</p>
                    )}
                </div>

                {/* Editable fields */}
                <div className="px-4 pb-4 space-y-3">
                    {fields.map(({ key, label }) => (
                        <div key={key} className="border border-black-100/20 dark:border-white/10 rounded-xl px-4 py-3">
                            <p className="text-xs text-black-100/80 dark:text-gray-500 mb-1">{label}</p>
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
                                        {runnerData[key] || <span className="text-black-100/80 dark:text-gray-400">Not set</span>}
                                    </p>
                                    <ChevronRight className="w-4 h-4 text-black-100/80 dark:text-gray-400" />
                                </div>
                            )}
                        </div>
                    ))}

                    {/* Email — read only */}
                    <div className="border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3">
                        <p className="text-xs text-black-100/80 dark:text-gray-500 mb-1">Email</p>
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-black-200 dark:text-gray-200">{runnerData.email || '—'}</p>
                            <div className="flex flex-col justify-center items-center gap-1">
                                <Phone className="w-3.5 h-3.5 text-black-100/80 dark:text-gray-400" />
                                <span className="text-[10px] text-black-100/80 dark:text-gray-400">Contact support to change</span>
                            </div>
                        </div>
                    </div>

                    <div className="border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3">
                        <p className="text-xs text-black-100/80 dark:text-gray-500 mb-1">Phone</p>
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-black-200 dark:text-gray-200">{runnerData.phone || '—'}</p>
                            <div className="flex flex-col justify-center items-center gap-1">
                                <Phone className="w-3.5 h-3.5 text-black-100/80 dark:text-gray-400" />
                                <span className="text-[10px] text-black-100/80 dark:text-gray-400">Contact support to change</span>
                            </div>
                        </div>
                    </div>

                    {/* Fleet Type — read only */}
                    <div className="border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3">
                        <p className="text-xs text-black-100/80 dark:text-gray-500 mb-1">Your Fleet Type</p>
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-black-200 dark:text-gray-200 capitalize">
                                {runnerData.fleetType ?? '—'}
                            </p>
                        </div>
                    </div>

                    {/* KYC — read only */}
                    <div className="border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 space-y-3">
                        <p className="text-xs text-black-100/80 dark:text-gray-500 mb-1">KYC Status</p>

                        {(() => {
                            const isVerified = runnerData.isVerifiedKyc;
                            const isPending = ['pending_verification', 'pending_review'].includes(runnerData.kycStatus);
                            const isRejected = runnerData.kycStatus === 'rejected' || runnerData.kycStatus === 'banned';

                            const nin = runnerData.verificationDocuments?.nin;
                            const license = runnerData.verificationDocuments?.driverLicense;
                            const selfie = runnerData.biometricVerification;

                            // Docs actually submitted (not_submitted means runner didn't provide it)
                            const submittedDocs = [
                                nin?.status && nin.status !== 'not_submitted' ? 'ID (NIN)' : null,
                                license?.status && license.status !== 'not_submitted' ? 'Driver\'s License' : null,
                                selfie?.status && selfie.status !== 'not_submitted' ? 'Facial Recognition' : null,
                            ].filter(Boolean);

                            if (isVerified) {
                                return (
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                                <CheckCircle className="w-3.5 h-3.5 text-primary" />
                                            </div>
                                            <p className="text-sm font-bold text-primary">Verified</p>
                                        </div>
                                        <p className="text-xs text-black-100/80 dark:text-gray-400">{submittedDocs.join(' · ')}</p>
                                    </div>
                                );
                            }

                            if (isPending) {
                                return (
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-secondary/10 flex items-center justify-center flex-shrink-0">
                                                <Clock className="w-3.5 h-3.5 text-secondary dark:text-gray-300" />
                                            </div>
                                            <p className="text-sm font-bold text-secondary dark:text-gray-300">Pending Review</p>
                                        </div>
                                        <p className="text-xs text-black-100/80 dark:text-gray-400">
                                            {submittedDocs.length > 0 ? submittedDocs.join(' · ') : 'Under review'}
                                        </p>
                                    </div>
                                );
                            }

                            if (isRejected) {
                                return (
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-gray-1000 dark:bg-white/5 flex items-center justify-center flex-shrink-0">
                                                <XCircle className="w-3.5 h-3.5 text-gray-500" />
                                            </div>
                                            <p className="text-sm font-bold text-gray-500">Verification Failed</p>
                                        </div>
                                        <p className="text-xs text-black-100/80 dark:text-gray-400">Contact support</p>
                                    </div>
                                );
                            }

                            // not_submitted / pending_verification initial state
                            return (
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-gray-1000 dark:bg-white/5 flex items-center justify-center flex-shrink-0">
                                        <Shield className="w-3.5 h-3.5 text-black-100/80 dark:text-gray-400" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-black-100/80 dark:text-gray-400">Not Verified</p>
                                        <p className="text-xs text-black-100/80 dark:text-gray-400 mt-0.5">Complete onboarding to verify</p>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>

                    {saveError && (
                        <p className="text-xs text-red-500 text-center">{saveError}</p>
                    )}
                    {saving && (
                        <p className="text-xs text-black-100/80 dark:text-gray-400 text-center">Saving...</p>
                    )}
                </div>

                {/* PIN Management */}
                <div className="px-4 pb-4">
                    <p className={`text-xs font-semibold uppercase tracking-widest mb-3 
    ${darkMode ? 'text-gray-500' : 'text-black-100/80'}`}>
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
                                    <p className="text-xs text-black-100/80 dark:text-gray-400 mt-0.5">Required for withdrawals & transfers</p>
                                </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-black-100/80 dark:text-gray-400" />
                        </button>
                    ) : (
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
                                        <p className="text-xs text-black-100/80 dark:text-gray-400 mt-0.5">Enter current PIN then set new one</p>
                                    </div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-black-100/80 dark:text-gray-400" />
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
                                        <p className="text-xs text-black-100/80 dark:text-gray-400 mt-0.5">Reset via identity verification</p>
                                    </div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-black-100/80 dark:text-gray-400" />
                            </button>
                        </div>
                    )}
                </div>

                {/* Delete account — disabled */}
                <div className="px-4 pb-6">
                    <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-white/10 rounded-xl opacity-40 cursor-not-allowed">
                        <div className="flex items-center gap-2">
                            <Trash2 className="w-4 h-4 text-red-400" />
                            <span className="text-sm text-red-400">Delete Account</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-black-100/80 dark:text-gray-400" />
                    </div>
                    <p className="text-xs text-black-100/80 dark:text-gray-600 text-center mt-2">
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

            {/* PIN Modals */}
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

            <div className="flex justify-center p-4 text-xs text-black-100/80 dark:text-gray-700">
                Sendrey - support@sendrey.com
            </div>
        </div>
    );
};