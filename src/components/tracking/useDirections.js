// components/tracking/useDirections.js
import { useState, useEffect, useCallback, useRef } from 'react';

export const useDirections = ({ origin, destination, darkMode }) => {
  const [route, setRoute] = useState(null); // eslint-disable-line no-unused-vars
  const [polyline, setPolyline] = useState(null);
  const [distance, setDistance] = useState(null);
  const [duration, setDuration] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const directionsCache = useRef(new Map());
  const abortControllerRef = useRef(null);

  const getCacheKey = useCallback((origin, destination) => {
    if (!origin || !destination) return null;
    return `${origin.lat},${origin.lng}|${destination.lat},${destination.lng}`;
  }, []);

  const fetchDirections = useCallback(async (origin, destination) => {
    if (!origin || !destination || !window.google) {
      return null;
    }

    const cacheKey = getCacheKey(origin, destination);
    if (cacheKey && directionsCache.current.has(cacheKey)) {
      const cached = directionsCache.current.get(cacheKey);
      setRoute(cached.route);
      setPolyline(cached.polyline);
      setDistance(cached.distance);
      setDuration(cached.duration);
      return cached;
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    setLoading(true);
    setError(null);

    try {
      const directionsService = new window.google.maps.DirectionsService();
      
      const result = await new Promise((resolve, reject) => {
        directionsService.route(
          {
            origin: new window.google.maps.LatLng(origin.lat, origin.lng),
            destination: new window.google.maps.LatLng(destination.lat, destination.lng),
            travelMode: window.google.maps.TravelMode.DRIVING,
          },
          (response, status) => {
            if (status === 'OK') {
              resolve(response);
            } else {
              reject(new Error(`Directions request failed: ${status}`));
            }
          }
        );
      });

      if (!result.routes?.[0]) {
        throw new Error('No routes found');
      }

      const route = result.routes[0];
      const leg = route.legs[0];
      
      const directionsData = {
        route,
        polyline: route.overview_polyline,
        distance: leg.distance.text,
        distanceValue: leg.distance.value,
        duration: leg.duration.text,
        durationValue: leg.duration.value,
      };

      // Cache the result
      if (cacheKey) {
        directionsCache.current.set(cacheKey, directionsData);
      }

      setRoute(route);
      setPolyline(route.overview_polyline);
      setDistance(leg.distance.text);
      setDuration(leg.duration.text);
      
      return directionsData;

    } catch (err) {
      if (err.name === 'AbortError') {
        // console.log('Directions request cancelled');
      } else {
        console.error('Directions error:', err);
        setError(err.message || 'Failed to get directions');
        
        // Fallback to straight line
        setPolyline(null); // We'll handle straight line in map component
        setDistance('Calculating...');
        setDuration('Calculating...');
      }
    } finally {
      setLoading(false);
    }
  }, [getCacheKey]);

  // Debounced fetch to avoid too many requests
  useEffect(() => {
    if (!origin || !destination) return;

    const timer = setTimeout(() => {
      fetchDirections(origin, destination);
    }, 500);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin?.lat, origin?.lng, destination?.lat, destination?.lng, fetchDirections]);

  return {
    polyline,
    distance,
    duration,
    error,
    loading,
  };
};