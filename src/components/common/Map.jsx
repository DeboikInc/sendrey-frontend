// src/components/Map.jsx 
import { Search } from "lucide-react";
import { useEffect, useRef, useCallback } from "react";
import { useGoogleMaps } from "../../hooks/useGoogleMaps"; // eslint-disable-line no-unused-vars
export default function Map({
    onLocationSelect,
    initialCenter = { lat: 6.5244, lng: 3.3792 }, // Lagos as default center, NOT a fallback
    initialZoom = 12
}) {
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const markerRef = useRef(null);
    // const { isLoaded, error } = useGoogleMaps();

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
                        address: results[0].formatted_address,
                        name: results[0].formatted_address,
                    });
                }
            });
        });
    }, []);

    const handleLocationSelect = useCallback((place) => {
        onLocationSelect(place);
    }, [onLocationSelect]);

    useEffect(() => {
        const initializeMap = () => {
            if (!mapRef.current || !window.google) {
                console.log("Map ref or Google Maps not ready yet");
                return;
            };
            if (mapInstanceRef.current) {
                console.log("Map already initialized");
                return;
            };

            const map = new window.google.maps.Map(mapRef.current, {
                center: initialCenter,
                zoom: initialZoom,
            });

            mapInstanceRef.current = map;

            map.addListener("click", async (e) => {
                const clickedLocation = {
                    lat: e.latLng.lat(),
                    lng: e.latLng.lng(),
                };

                try {
                    const place = await geocodeLocation(clickedLocation);
                    handleLocationSelect(place);

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
                    handleLocationSelect(fallbackPlace);

                    if (markerRef.current) markerRef.current.setMap(null);
                    markerRef.current = new window.google.maps.Marker({
                        position: clickedLocation,
                        map: map,
                        title: "Selected Location",
                    });
                }
            });

            const input = document.getElementById("map-search");
            if (input) {
                const autocomplete = new window.google.maps.places.Autocomplete(input, {
                    componentRestrictions: { country: 'ng' },
                    fields: ['geometry', 'formatted_address', 'name'],
                });

                autocomplete.addListener("place_changed", () => {
                    const place = autocomplete.getPlace();
                    if (!place.geometry) return;

                    const selectedPlace = {
                        name: place.name,
                        address: place.formatted_address,
                        lat: place.geometry.location.lat(),
                        lng: place.geometry.location.lng(),
                    };

                    handleLocationSelect(selectedPlace);
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

        if (window.google && mapRef.current ) {
            initializeMap();
            return;
        }

        const interval = setInterval(() => {
            if (window.google && mapRef.current) {
                clearInterval(interval);
                initializeMap();
            }
        }, 100);

        return () => {
            clearInterval(interval);
            if (markerRef.current) markerRef.current.setMap(null);
            mapInstanceRef.current = null;
        };
    }, [geocodeLocation, handleLocationSelect, initialCenter, initialZoom]);

    return (
        <>
            <div className="p-4 bg-white dark:bg-gray-800 border-b">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                        id="map-search"
                        type="text"
                        placeholder="Search for a location..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-black dark:text-white"
                    />
                </div>
            </div>

            <div ref={mapRef} className="flex-1 h-full w-full" />
        </>
    );
}