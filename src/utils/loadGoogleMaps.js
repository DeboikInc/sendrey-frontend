// utils/loadGoogleMaps.js
const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

// Script loading state
let mapsLoaded = false;
let mapsLoading = false;
const mapsCallbacks = [];

export const loadGoogleMaps = () => {
    return new Promise((resolve, reject) => {
        // If already loaded, resolve immediately
        if (mapsLoaded) {
            resolve(window.google.maps);
            return;
        }

        // Add to callbacks queue
        mapsCallbacks.push({ resolve, reject });

        // If already loading, just wait
        if (mapsLoading) return;

        // Start loading
        mapsLoading = true;

        // Create script element
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=geometry,places`;
        script.async = true;
        script.defer = true;

        script.onload = () => {
            mapsLoaded = true;
            mapsLoading = false;
            // Resolve all queued callbacks
            mapsCallbacks.forEach(({ resolve }) => resolve(window.google.maps));
            mapsCallbacks.length = 0;
        };

        script.onerror = (error) => {
            mapsLoading = false;
            // Reject all queued callbacks
            mapsCallbacks.forEach(({ reject }) => reject(new Error('Failed to load Google Maps')));
            mapsCallbacks.length = 0;
            reject(error);
        };

        document.head.appendChild(script);
    });
};

// Helper to check if maps is loaded
export const isGoogleMapsLoaded = () => mapsLoaded;

// Helper to get the maps instance (only call after loadGoogleMaps resolves)
export const getGoogleMaps = () => {
    if (!mapsLoaded) {
        throw new Error('Google Maps not loaded yet. Call loadGoogleMaps() first.');
    }
    return window.google.maps;
};