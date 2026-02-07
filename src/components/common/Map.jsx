// src/components/Map.jsx 
import { Search } from "lucide-react";
import { useEffect, useRef, useCallback } from "react";

// This component encapsulates the entire map and its logic
export default function Map({
    onLocationSelect, 
}) {
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const markerRef = useRef(null);
    
    // Create a stable callback for geocoding
    const geocodeLocation = useCallback(async (latLng) => {
        return new Promise((resolve) => {
            if (!window.google) {
                resolve({
                    lat: latLng.lat,
                    lng: latLng.lng,
                    address: `Location (${latLng.lat.toFixed(6)}, ${latLng.lng.toFixed(6)})`,
                    name: `Location (${latLng.lat.toFixed(6)}, ${latLng.lng.toFixed(6)})`,
                });
                return;
            }
            
            const geocoder = new window.google.maps.Geocoder();
            geocoder.geocode({ location: latLng }, (results, status) => {
                if (status === "OK" && results[0]) {
                    resolve({
                        lat: latLng.lat,
                        lng: latLng.lng,
                        address: results[0].formatted_address,
                        name: results[0].formatted_address,
                    });
                } else {
                    resolve({
                        lat: latLng.lat,
                        lng: latLng.lng,
                        address: `Location (${latLng.lat.toFixed(6)}, ${latLng.lng.toFixed(6)})`,
                        name: `Location (${latLng.lat.toFixed(6)}, ${latLng.lng.toFixed(6)})`,
                    });
                }
            });
        });
    }, []);

    // useEffect to initialize and handle map interactions
    useEffect(() => {
        const initializeMap = () => {
            if (!mapRef.current || !window.google) {
                console.log("Map ref or Google Maps not ready yet");
                return;
            }

            // If map already exists, don't create a new one
            if (mapInstanceRef.current) {
                console.log("Map already initialized");
                return;
            }

            const createMap = (center, zoom) => {
                console.log("Creating new map instance");
                const map = new window.google.maps.Map(mapRef.current, {
                    center: center,
                    zoom: zoom,
                });

                mapInstanceRef.current = map;

                // --- 1. Map Click Listener ---
                map.addListener("click", async (e) => {
                    const clickedLocation = {
                        lat: e.latLng.lat(),
                        lng: e.latLng.lng(),
                    };

                    console.log("Map clicked at:", clickedLocation);
                    
                    try {
                        const place = await geocodeLocation(clickedLocation);
                        console.log("Geocoded place:", place);
                        
                        // Report the selected place back to the parent component
                        onLocationSelect(place);

                        if (markerRef.current) markerRef.current.setMap(null);
                        markerRef.current = new window.google.maps.Marker({
                            position: clickedLocation,
                            map: map,
                            title: "Selected Location",
                        });
                    } catch (error) {
                        console.error("Error geocoding location:", error);
                        const fallbackPlace = {
                            lat: clickedLocation.lat,
                            lng: clickedLocation.lng,
                            address: `Location (${clickedLocation.lat.toFixed(6)}, ${clickedLocation.lng.toFixed(6)})`,
                            name: `Location (${clickedLocation.lat.toFixed(6)}, ${clickedLocation.lng.toFixed(6)})`,
                        };
                        onLocationSelect(fallbackPlace);
                    }
                });

                // --- 2. Search Box Listener ---
                const input = document.getElementById("map-search");
                if (input) {
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

                        console.log("Search box selected place:", selectedPlace);
                        
                        // Report the selected place back to the parent component
                        onLocationSelect(selectedPlace);

                        map.setCenter(place.geometry.location);
                        map.setZoom(16);

                        if (markerRef.current) markerRef.current.setMap(null);
                        markerRef.current = new window.google.maps.Marker({
                            position: place.geometry.location,
                            map: map,
                            title: place.name,
                        });
                    });
                }
            };

            // Get user's current location or use a default
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
                        // Default fallback location (e.g., Lagos, Nigeria)
                        createMap({ lat: 6.5244, lng: 3.3792 }, 12);
                    },
                    { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 }
                );
            } else {
                createMap({ lat: 6.5244, lng: 3.3792 }, 12);
            }
        };

        // Initialize map when the component mounts
        initializeMap();

        // Cleanup function
        return () => {
            if (markerRef.current) markerRef.current.setMap(null);
            // Don't destroy the map instance on cleanup, just reset refs
            mapInstanceRef.current = null;
        };
    // Remove onLocationSelect from dependencies to prevent re-initialization
    }, [geocodeLocation]); // Only depends on geocodeLocation

    return (
        <>
            {/* Search Input remains here because it's closely tied to the map instance */}
            <div className="p-4 bg-white dark:bg-gray-800 border-b">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                        id="map-search" // ID is critical for the SearchBox to attach
                        type="text"
                        placeholder="Search for a location..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-black dark:text-white"
                    />
                </div>
            </div>

            {/* Map Container */}
            <div ref={mapRef} className="flex-1 h-full w-full" />
        </>
    );
}