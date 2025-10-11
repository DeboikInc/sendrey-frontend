import { useNavigate, useLocation, } from "react-router-dom";
import { ChevronLeft, MapPin, X, Search } from "lucide-react";
import { Button } from "@material-tailwind/react";
import { useState, useEffect, useRef } from "react";
import { Trash2 } from "lucide-react";

export const Location = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [showMap, setShowMap] = useState(false);
    const [selectedPlace, setSelectedPlace] = useState(null);
    const [savedLocations, setSavedLocations] = useState([
        {
            name: "Mr dare house",
            address: "Raimi no 30, 30 raimi ogundipe",
            lat: 6.5244,
            lng: 3.3792
        }
    ]);

    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const markerRef = useRef(null);

    const dark = location.state?.darkMode;
    

    useEffect(() => {
        const initializeMap = () => {
            if (!mapRef.current) return;

            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const userLocation = {
                            lat: position.coords.latitude,
                            lng: position.coords.longitude,
                        };
                        createMap(userLocation, 14);
                    },
                    () => {
                        createMap({ lat: 6.5244, lng: 3.3792 }, 12);
                    },
                    { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 }
                );
            } else {
                createMap({ lat: 6.5244, lng: 3.3792 }, 12);
            }
        };

        if (showMap && window.google) {
            initializeMap();
        }
    }, [showMap]);

    const createMap = (center, zoom) => {
    const map = new window.google.maps.Map(mapRef.current, {
      center: center,
      zoom: zoom,
    });

    mapInstanceRef.current = map;

    map.addListener("click", (e) => {
      const clickedLocation = {
        lat: e.latLng.lat(),
        lng: e.latLng.lng(),
      };

      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ location: clickedLocation }, (results, status) => {
        if (status === "OK" && results[0]) {
          const place = {
            lat: clickedLocation.lat,
            lng: clickedLocation.lng,
            address: results[0].formatted_address,
            name: results[0].formatted_address,
          };
          setSelectedPlace(place);
          if (markerRef.current) markerRef.current.setMap(null);
          markerRef.current = new window.google.maps.Marker({
            position: clickedLocation,
            map: map,
            title: "Selected Location",
          });
        } else {
          const place = {
            lat: clickedLocation.lat,
            lng: clickedLocation.lng,
            address: `Location (${clickedLocation.lat.toFixed(6)}, ${clickedLocation.lng.toFixed(6)})`,
            name: `Location (${clickedLocation.lat.toFixed(6)}, ${clickedLocation.lng.toFixed(6)})`,
          };
          setSelectedPlace(place);
          if (markerRef.current) markerRef.current.setMap(null);
          markerRef.current = new window.google.maps.Marker({
            position: clickedLocation,
            map: map,
            title: "Selected Location",
          });
        }
      });
    });

    const input = document.getElementById("map-search");
    const searchBox = new window.google.maps.places.SearchBox(input);
    map.addListener("bounds_changed", () => {
      searchBox.setBounds(map.getBounds());
    });

    searchBox.addListener("places_changed", () => {
      const places = searchBox.getPlaces();
      if (places.length === 0) return;
      const place = places[0];
      const selectedPlace = {
        name: place.name,
        address: place.formatted_address,
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
      };
      setSelectedPlace(selectedPlace);
      map.setCenter(place.geometry.location);
      map.setZoom(16);
      if (markerRef.current) markerRef.current.setMap(null);
      markerRef.current = new window.google.maps.Marker({
        position: place.geometry.location,
        map: map,
        title: place.name,
      });
    });
  };

  

    const handleSaveLocation = () => {
        if (selectedPlace) {
            const newLocation = {
                name: selectedPlace.name || "New Location",
                address: selectedPlace.address,
                lat: selectedPlace.lat,
                lng: selectedPlace.lng
            };
            setSavedLocations(prev => [...prev, newLocation]);
            setShowMap(false);
            setSelectedPlace(null);

            // Clean up map
            if (markerRef.current) markerRef.current.setMap(null);
            if (mapInstanceRef.current) {
                mapInstanceRef.current = null;
                if (mapRef.current) mapRef.current.innerHTML = "";
            }
        }
    };

    const handleDeleteLocation = (index) => {
        setSavedLocations(prev => prev.filter((_, i) => i !== index));
    };

    if (showMap) {
        return (
            <div className={`min-h-screen flex justify-center p-5 bg-white dark:bg-black-100 ${dark ? "dark" : ""}`}>
                <div className="w-full h-full flex flex-col">
                    <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border-b">
                        <Button variant="text" onClick={() => setShowMap(false)} className="flex items-center">
                            <X className="h-4 w-4 mr-2" />
                            Close
                        </Button>
                        <Button
                            onClick={handleSaveLocation}
                            disabled={!selectedPlace}
                            className={`${!selectedPlace ? "opacity-50 cursor-not-allowed" : ""}`}
                        >
                            Save Location
                        </Button>
                    </div>
                    <div className="p-4 bg-white dark:bg-gray-800 border-b">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                                id="location-map-search"
                                type="text"
                                placeholder="Search for a location..."
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-black dark:text-white"
                            />
                        </div>
                    </div>

                    <div ref={mapRef} className="flex-1 w-full h-[500px]" />

                    {selectedPlace && (
                        <div className="p-4 bg-white dark:bg-gray-800 border-t">
                            <div className="bg-blue-50 dark:bg-blue-900 p-3 rounded-lg">
                                <p className="font-semibold text-blue-800 dark:text-blue-200">Selected Location:</p>
                                <p className="text-blue-600 dark:text-blue-300">
                                    {selectedPlace.name || selectedPlace.address}
                                </p>
                                <p className="text-sm text-blue-500 dark:text-blue-400 mt-1">
                                    Coordinates: {selectedPlace.lat.toFixed(6)}, {selectedPlace.lng.toFixed(6)}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className={`min-h-screen py-4 bg-white dark:bg-black-100 ${dark ? "dark" : ""}`}>
            <div className="flex border-grey-100 border-b p-2 w-full">
                <div onClick={() => navigate('/raw')} className="cursor-pointer text-black-200 dark:text-gray-300">
                    <ChevronLeft />
                </div>
                <h1 className="text-xl mr-auto ml-auto text-black-200 dark:text-gray-300">Locations</h1>
            </div>

            <div className="justify-center flex flex-col items-center">
                <div className="space-y-5 lg:w-1/3 w-full pt-1 p-1">
                    {savedLocations.map((location, index) => (
                        <div key={index} className="bg-gray-800 text-gray-100 p-4 space-y-2 rounded-lg">
                            <p className="text-blue-300 font-semibold">{location.name}</p>
                            <div className="flex justify-between items-center">
                                <p className="text-sm">{location.address}</p>
                                <button
                                    onClick={() => handleDeleteLocation(index)}
                                    className="text-red-400 hover:text-red-600"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                    ))}

                    <div className="p-2 flex justify-center">
                        <button
                            onClick={() => setShowMap(true)}
                            className="bg-blue-600 rounded-lg w-80 text-center hover:bg-blue-400 text-white p-3 cursor-pointer flex items-center justify-center gap-2"
                        >
                            <MapPin className="h-4 w-4" />
                            Add New Location
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};