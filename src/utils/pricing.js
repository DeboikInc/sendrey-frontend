// utils/pricing.js

export const DELIVERY_FEE_PER_KM = 1000;    // ₦ per mkm — must match backend DELIVERY_FEE_PER_METER
export const PLATFORM_FEE_PERCENTAGE = 0.57;
export const RUNNER_SHARE = 1 - PLATFORM_FEE_PERCENTAGE;

// ─── Geometry ─────────────────────────────────────────────────────────────────

/**
 * Haversine distance between two { lat, lng } points.
 * @returns {number} distance in metres
 */
export const haversineDistance = (a, b) => {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6_371_000;

  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

// ─── Fee calculators ──────────────────────────────────────────────────────────

/**
 * Raw delivery fee from distance.
 * @param {number} distanceInMeters
 * @returns {number} ₦ (rounded)
 */
export const calculateDeliveryFee = (distanceInMeters) =>
  Math.round(DELIVERY_FEE_PER_KM * (distanceInMeters / 1000));

/**
 * Calculate total route distance from coordinate objects.
 *
 * run-errand:  runnerCoords → marketCoords → deliveryCoords
 * pick-up:     runnerCoords → pickupCoords → deliveryCoords
 *
 * @param {string}              serviceType
 * @param {{ lat, lng }}        runnerCoords
 * @param {{ lat, lng }}        midCoords       market or pickup coords
 * @param {{ lat, lng }}        deliveryCoords
 * @returns {{ distanceInMeters: number, legs: object, error: string|null }}
 */
export const calculateRouteDistance = (serviceType, midCoords, deliveryCoords) => {
  if (!midCoords) return { distanceInMeters: 0, legs: {}, error: `${serviceType === 'run-errand' ? 'Market' : 'Pick-up'} coordinates unavailable` };
  if (!deliveryCoords) return { distanceInMeters: 0, legs: {}, error: 'Delivery location unavailable' };

  const RUNNER_DEFAULT_METERS = 1000; // runner is always within 1km
  const leg1 = RUNNER_DEFAULT_METERS;
  const leg2 = haversineDistance(midCoords, deliveryCoords);

  return {
    distanceInMeters: leg1 + leg2,
    legs: { runnerToMid: Math.round(leg1), midToDelivery: Math.round(leg2) },
    error: null,
  };
};

/**
 * Main function — given all coords, returns fee + full breakdown.
 *
 * @param {string}       serviceType      'run-errand' | 'pick-up'
 * @param {{ lat, lng }} runnerCoords     runner's current location
 * @param {{ lat, lng }} midCoords        marketCoordinates or pickupCoordinates
 * @param {{ lat, lng }} deliveryCoords   user's delivery lat/lng
 * @returns {{
 *   distanceInMeters: number,
 *   deliveryFee: number,
 *   legs: object,
 *   error: string | null
 * }}
 */
export const computeDeliveryFee = (serviceType, runnerCoords, midCoords, deliveryCoords) => {
  const { distanceInMeters, legs, error } = calculateRouteDistance(
    serviceType, runnerCoords, midCoords, deliveryCoords
  );

  if (error) return { distanceInMeters: 0, deliveryFee: 0, legs, error };

  return {
    distanceInMeters: Math.round(distanceInMeters),
    deliveryFee: calculateDeliveryFee(distanceInMeters),
    legs,
    error: null,
  };
};

/**
 * Format a ₦ amount for display.  e.g. formatNaira(1250) → "₦1,250"
 */
export const formatNaira = (amount) =>
  `₦${Math.round(amount).toLocaleString('en-NG')}`;