import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { X, MapPin, Trash2, ChevronLeft } from "lucide-react";
import { Button } from "@material-tailwind/react";
import { fetchLocations, deleteLocation } from "../../Redux/userSlice"; 

export default function SavedLocationScreen({
    isOpen,
    onClose,
    onSelectLocation, 
    isSelectingDelivery,
    onDismiss,
    darkMode,
}) {
    const dispatch = useDispatch();
    
  
    const { savedLocations, loading } = useSelector((state) => state.users);

    useEffect(() => {
        if (isOpen) {
            dispatch(fetchLocations());
        }
    }, [isOpen, dispatch]);

    if (!isOpen) return null;

    const locationType = isSelectingDelivery ? 'delivery' : 'pickup';

    const handleLocationSelect = (location) => {
        onSelectLocation(location, locationType);
        onClose();
    };

    const handleCloseScreen = () => {
        onDismiss();
        onClose();
    };

    const handleDeleteLocation = (id) => {
        dispatch(deleteLocation(id));
    };

    return (
        <div
            className={`fixed inset-0 z-50 transition-transform duration-300 ${isOpen ? 'translate-y-0' : 'translate-y-full'
                } ${darkMode ? 'dark bg-black-100' : 'bg-white'}`}
        >
            {/* Header */}
            <div className="flex border-gray-100 dark:border-gray-800 border-b p-4 w-full items-center">
                <div onClick={handleCloseScreen} className="cursor-pointer text-black-200 dark:text-gray-300">
                    <ChevronLeft size={24} />
                </div>
                <h1 className="text-xl font-semibold mr-auto ml-auto text-black-200 dark:text-gray-300">
                    Saved Locations
                </h1>
                <div className="w-6" />
            </div>

            {/* List Content */}
            <div className="justify-center flex flex-col items-center h-full overflow-y-auto pb-20">
                <div className="space-y-4 lg:w-1/3 w-full pt-4 px-4">
                    {loading && savedLocations.length === 0 ? (
                        <p className={`text-center py-10 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            Loading locations...
                        </p>
                    ) : savedLocations.length === 0 ? (
                        <p className={`text-center py-10 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            No saved locations found. Please select a location to save it here.
                        </p>
                    ) : (
                        savedLocations.map((location) => (
                            <div
                                key={location._id} // Using _id from MongoDB
                                className={`p-4 space-y-2 rounded-lg cursor-pointer transition 
                                    ${darkMode
                                        ? 'bg-gray-800 text-gray-100 hover:bg-gray-700'
                                        : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                                    }`
                                }
                                onClick={() => handleLocationSelect(location)}
                            >
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-2">
                                        <MapPin size={18} className="text-primary" />
                                        <p className="font-semibold text-lg">{location.name}</p>
                                    </div>
                                    <Button
                                        variant="text"
                                        color="red"
                                        onClick={(e) => {
                                            e.stopPropagation(); 
                                            handleDeleteLocation(location._id);
                                        }}
                                        className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20"
                                    >
                                        <Trash2 size={18} />
                                    </Button>
                                </div>
                                
                                <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                                    {location.address}
                                </p>

                                <div className="mt-2">
                                    <span
                                        className={`text-xs font-medium px-2 py-1 rounded-full 
                                            ${isSelectingDelivery 
                                                ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' 
                                                : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'}
                                        `}
                                    >
                                        Select for {locationType === 'delivery' ? 'Delivery' : 'Pickup'}
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}