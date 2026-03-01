import { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { ChevronLeft, ChevronRight, User, Trash2, Camera, Star, Phone } from 'lucide-react';
import { getRunnerRatings } from '../../Redux/ratingSlice';
import api from '../../utils/api';

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
        { key: 'email', label: 'Email' },
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
                        <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">Phone Number</p>
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-black-200 dark:text-gray-200">{runnerData.phone || '—'}</p>
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