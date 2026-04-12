// components/tracking/useDirections.js
import { useState, useEffect, useCallback, useRef } from 'react';

export const useDirections = ({ origin, destination }) => {
  const [polyline, setPolyline] = useState(null);
  const [distance, setDistance] = useState(null);
  const [duration, setDuration] = useState(null);
  const [error, setError]       = useState(null);
  const [loading, setLoading]   = useState(false);

  const cacheRef = useRef(new Map());

  const getCacheKey = useCallback((o, d) => {
    if (!o || !d) return null;
    return `${o.lat},${o.lng}|${d.lat},${d.lng}`;
  }, []);

  const fetchDirections = useCallback(async (origin, destination) => {
    if (!origin || !destination || !window.google) return;

    const key = getCacheKey(origin, destination);
    if (key && cacheRef.current.has(key)) {
      const c = cacheRef.current.get(key);
      setPolyline(c.polyline);
      setDistance(c.distance);
      setDuration(c.duration);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const service = new window.google.maps.DirectionsService();

      const result = await new Promise((resolve, reject) => {
        service.route(
          {
            origin:      new window.google.maps.LatLng(origin.lat, origin.lng),
            destination: new window.google.maps.LatLng(destination.lat, destination.lng),
            travelMode:  window.google.maps.TravelMode.DRIVING,
          },
          (response, status) => {
            if (status === 'OK') resolve(response);
            else reject(new Error(`Directions failed: ${status}`));
          }
        );
      });

      const route = result.routes[0];
      const leg   = route.legs[0];

      const data = {
        polyline: route.overview_polyline, // encoded polyline object {points: '...'}
        distance: leg.distance.text,
        duration: leg.duration.text,
      };

      if (key) cacheRef.current.set(key, data);

      setPolyline(data.polyline);
      setDistance(data.distance);
      setDuration(data.duration);

    } catch (err) {
      console.error('Directions error:', err);
      setError(err.message);
      setPolyline(null); // LiveTrackingMap falls back to straight line
      setDistance('Calculating...');
      setDuration('Calculating...');
    } finally {
      setLoading(false);
    }
  }, [getCacheKey]);

  useEffect(() => {
    if (!origin || !destination) return;
    const t = setTimeout(() => fetchDirections(origin, destination), 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin?.lat, origin?.lng, destination?.lat, destination?.lng]);

  return { polyline, distance, duration, error, loading };
};