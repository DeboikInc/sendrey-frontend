// src/components/Map.jsx 
import { Search } from "lucide-react";
import { useEffect, useRef } from "react";

// This component encapsulates the entire map and its logic
export default function Map({
    onLocationSelect, // Callback: (selectedPlace) => void
    initialLocation = null, // NEW: Initial location to display
}) {
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const markerRef = useRef(null);

    // useEffect to initialize and handle map interactions
    useEffect(() => {
        const initializeMap = () => {
            if (!mapRef.current) {
                console.log("mapRef not ready yet");
                return;
            }

            if (!window.google) {
                console.log("Google Maps not loaded yet");
                return;
            }

            const createMap = (center, zoom) => {
                const map = new window.google.maps.Map(mapRef.current, {
                    center: center,
                    zoom: zoom,
                });

                mapInstanceRef.current = map;

                // --- 1. Map Click Listener ---
                map.addListener("click", (e) => {
                    const clickedLocation = {
                        lat: e.latLng.lat(),
                        lng: e.latLng.lng(),
                    };

                    const geocoder = new window.google.maps.Geocoder();
                    geocoder.geocode({ location: clickedLocation }, (results, status) => {
                        let place;
                        if (status === "OK" && results[0]) {
                            place = {
                                lat: clickedLocation.lat,
                                lng: clickedLocation.lng,
                                address: results[0].formatted_address,
                                name: results[0].formatted_address,
                            };
                        } else {
                            place = {
                                lat: clickedLocation.lat,
                                lng: clickedLocation.lng,
                                address: `Location (${clickedLocation.lat}, ${clickedLocation.lng})`,
                                name: `Location (${clickedLocation.lat}, ${clickedLocation.lng})`,
                            };
                        }

                        // Report the selected place back to the parent component
                        onLocationSelect(place);

                        if (markerRef.current) markerRef.current.setMap(null);
                        markerRef.current = new window.google.maps.Marker({
                            position: clickedLocation,
                            map: map,
                            title: "Selected Location",
                        });
                    });
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

                // --- 3. NEW: If initialLocation is provided, show it on the map ---
                if (initialLocation) {
                    const position = {
                        lat: initialLocation.lat,
                        lng: initialLocation.lng,
                    };

                    // Center the map on this location
                    map.setCenter(position);
                    map.setZoom(16);

                    // Place a marker
                    if (markerRef.current) markerRef.current.setMap(null);
                    markerRef.current = new window.google.maps.Marker({
                        position: position,
                        map: map,
                        title: initialLocation.name || "Selected Location",
                        animation: window.google.maps.Animation.DROP, // Nice animation
                    });

                    // Call onLocationSelect to update parent state
                    onLocationSelect({
                        lat: initialLocation.lat,
                        lng: initialLocation.lng,
                        name: initialLocation.name,
                        address: initialLocation.address,
                    });
                }
            };

            // Get user's current location or use initialLocation or default
            if (initialLocation) {
                // If we have an initial location, use it directly
                createMap(
                    { lat: initialLocation.lat, lng: initialLocation.lng },
                    16
                );
            } else if (navigator.geolocation) {
                // Otherwise try to get user's location
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
            if (mapInstanceRef.current) {
                mapInstanceRef.current = null;
            }
        };
    }, [onLocationSelect, initialLocation]); // Added initialLocation to dependencies

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