// components/tracking/LiveTrackingMap.jsx
import React, { useState, useEffect, useRef } from 'react';
import { createHtmlMarker, destroyHtmlMarker } from '../../utils/htmlMarker';
import { FleetTypeIcon } from './FleetTypeIcon';
import { useDirections } from './useDirections';
import { loadGoogleMaps } from '../../utils/loadGoogleMaps';

const PRIMARY = '#F47C20';

const lightMapStyles = [
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9e9e9e' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c9d8f0' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#f9f9f9' }] },
];

const darkMapStyles = [
  { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2d3561' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#212a37' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0d2137' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

// Primary-colored teardrop pin SVG path (standard map pin shape)
const PIN_PATH = 'M12 0C7.58 0 4 3.58 4 8c0 5.25 8 13 8 13s8-7.75 8-13c0-4.42-3.58-8-8-8zm0 11c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z';

export const LiveTrackingMap = ({
  runnerLocation,
  deliveryLocation,
  runnerFleetType = 'car',
  runnerHeading = 0,
  darkMode = false,
  onMapReady,
  className = '',
  showPath = true,
}) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const runnerMarkerRef = useRef(null);       // created ONCE, never destroyed on update
  const deliveryMarkerRef = useRef(null);
  const polylineRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);

  const { polyline } = useDirections({
    origin: runnerLocation,
    destination: deliveryLocation,
    darkMode,
  });

  // ── Initialize map once ──────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const initMap = async () => {
      await loadGoogleMaps();

      const defaultCenter = runnerLocation || deliveryLocation || { lat: 6.5244, lng: 3.3792 };

      const map = new window.google.maps.Map(mapRef.current, {
        center: defaultCenter,
        zoom: 15,
        disableDefaultUI: true,
        zoomControl: true,
        styles: darkMode ? darkMapStyles : lightMapStyles,
      });

      mapInstanceRef.current = map;
      setMapReady(true);
      onMapReady?.(map);
    };

    initMap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Runner marker — CREATE once, UPDATE position/heading on every change ─
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !runnerLocation) return;

    const position = new window.google.maps.LatLng(runnerLocation.lat, runnerLocation.lng);

    if (!runnerMarkerRef.current) {
      // First time: create the marker
      runnerMarkerRef.current = createHtmlMarker(
        mapInstanceRef.current,
        position,
        <FleetTypeIcon
          fleetType={runnerFleetType}
          heading={runnerHeading}
          darkMode={darkMode}
          size={44}
        />
      );
    } else {
      // Subsequent updates: just move + rotate, no destroy/recreate
      if (runnerMarkerRef.current.position !== undefined) {
        runnerMarkerRef.current.position = position;
      } else if (typeof runnerMarkerRef.current.setPosition === 'function') {
        runnerMarkerRef.current.setPosition(position);
      }

      // Update heading rotation on the DOM element
      if (runnerMarkerRef.current.content) {
        const inner = runnerMarkerRef.current.content.querySelector('.vehicle-icon-inner');
        if (inner) {
          inner.style.transform = `rotate(${runnerHeading}deg)`;
        } else {
          runnerMarkerRef.current.content.style.transform = `rotate(${runnerHeading}deg)`;
        }
      }
    }

    // Smooth pan to follow runner
    mapInstanceRef.current.panTo(position);
  }, [runnerLocation, runnerHeading, runnerFleetType, mapReady, darkMode]);

  // Cleanup runner marker only on unmount
  useEffect(() => {
    return () => {
      if (runnerMarkerRef.current) {
        destroyHtmlMarker(runnerMarkerRef.current);
        runnerMarkerRef.current = null;
      }
    };
  }, []);

  // ── Destination marker ────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !deliveryLocation) return;

    const position = new window.google.maps.LatLng(deliveryLocation.lat, deliveryLocation.lng);

    if (!deliveryMarkerRef.current) {
      deliveryMarkerRef.current = new window.google.maps.Marker({
        position,
        map: mapInstanceRef.current,
        icon: {
          path: PIN_PATH,
          fillColor: PRIMARY,
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 1.5,
          scale: 2,
          anchor: new window.google.maps.Point(12, 21),
        },
        title: 'Destination',
      });
    } else {
      deliveryMarkerRef.current.setPosition(position);
    }

    return () => {
      if (deliveryMarkerRef.current) {
        deliveryMarkerRef.current.setMap(null);
        deliveryMarkerRef.current = null;
      }
    };
  }, [deliveryLocation, mapReady]);

  // ── Path polyline ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !showPath) return;

    // Clear old polyline
    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }

    let decodedPath = null;

    if (polyline) {
      // polyline is an encoded string from overview_polyline — decode it
      try {
        if (typeof polyline === 'string') {
          decodedPath = window.google.maps.geometry.encoding.decodePath(polyline);
        } else if (polyline?.points) {
          // overview_polyline object shape
          decodedPath = window.google.maps.geometry.encoding.decodePath(polyline.points);
        } else {
          // Already an array of LatLng
          decodedPath = polyline;
        }
      } catch (e) {
        console.warn('Polyline decode failed, falling back to straight line:', e);
      }
    }

    if (decodedPath && decodedPath.length > 0) {
      polylineRef.current = new window.google.maps.Polyline({
        path: decodedPath,
        geodesic: true,
        strokeColor: PRIMARY,
        strokeOpacity: 0,
        strokeWeight: 0,
        icons: [{
          icon: {
            path: 'M 0,-1 0,1',
            strokeOpacity: 1,
            strokeColor: PRIMARY,
            scale: 3,
          },
          offset: '0',
          repeat: '16px',
        }],
      });
    } else if (runnerLocation && deliveryLocation) {
      // Fallback: straight dashed line
      polylineRef.current = new window.google.maps.Polyline({
        path: [runnerLocation, deliveryLocation],
        geodesic: true,
        strokeColor: PRIMARY,
        strokeOpacity: 0,
        strokeWeight: 0,
        icons: [{
          icon: {
            path: 'M 0,-1 0,1',
            strokeOpacity: 1,
            strokeColor: PRIMARY,
            scale: 3,
          },
          offset: '0',
          repeat: '16px',
        }],
      });
    }

    if (polylineRef.current) {
      polylineRef.current.setMap(mapInstanceRef.current);
    }

    return () => {
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
        polylineRef.current = null;
      }
    };
  }, [polyline, runnerLocation, deliveryLocation, mapReady, showPath]);

  return (
    <div
      ref={mapRef}
      className={`w-full h-full ${className}`}
      style={{ minHeight: '300px' }}
    />
  );
};