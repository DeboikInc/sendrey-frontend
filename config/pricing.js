const DELIVERY_FEE_PERCENTAGE = parseFloat(process.env.DELIVERY_FEE_PERCENTAGE) || 0.20;
const PLATFORM_FEE_PERCENTAGE = parseFloat(process.env.PLATFORM_FEE_PERCENTAGE) || 0.57;
const DELIVERY_FEE_PER_KM  = parseFloat(process.env.DELIVERY_FEE_PER_KM)  || 5; // ₦ per metre — set via env
const RUNNER_SHARE = 1 - PLATFORM_FEE_PERCENTAGE;

// Paystack fee: 1% capped at ₦300, deducted from platform fee only
const PAYSTACK_FEE_PERCENT = 0.01;
const PAYSTACK_FEE_CAP     = 300;

// ─────────────────────────────────────────────────────────────────────────────
// Geometry
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Haversine formula — straight-line distance between two { lat, lng } points.
 * @returns {number} distance in metres
 */
const haversineDistance = (a, b) => {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6_371_000; // Earth radius in metres

  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

// ─────────────────────────────────────────────────────────────────────────────
// Core fee calculators
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert a raw distance into a delivery fee.
 * @param {number} distanceInMeters
 * @returns {number} fee in ₦ (rounded)
 */
const calculateDeliveryFee = (distanceInMeters) =>
  Math.round(DELIVERY_FEE_PER_KM * (distanceInMeters / 1000));

/**
 * Full platform/runner/provider fee split used by escrow & ledger.
 * The provider (Paystack) fee is always absorbed by the platform — runner payout is never reduced.
 * @param {number} deliveryFee
 */
const calculateFeeSplit = (deliveryFee) => {
  const platformFee    = Math.round(deliveryFee * PLATFORM_FEE_PERCENTAGE);
  const runnerPayout   = Math.round(deliveryFee * RUNNER_SHARE);
  const providerFee    = Math.min(Math.round(deliveryFee * PAYSTACK_FEE_PERCENT), PAYSTACK_FEE_CAP);
  // remove paystack fee from net platform fee
  const netPlatformFee = platformFee - providerFee;

  return { deliveryFee, platformFee, runnerPayout, providerFee, netPlatformFee };
};

// ─────────────────────────────────────────────────────────────────────────────
// Route distance — reads directly from Runner + User model documents
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate total route distance from live Runner and User documents.
 *
 * run-errand route:
 *   runner.latitude/longitude
 *     → user.currentRequest.marketCoordinates { lat, lng }
 *     → user.latitude / user.longitude
 *
 * pick-up route:
 *   runner.latitude/longitude
 *     → user.currentRequest.pickupCoordinates { lat, lng }
 *     → user.latitude / user.longitude
 *
 * @param {string} serviceType   'run-errand' | 'pick-up' 
 * @param {object} runner        Runner document or lean object
 * @param {object} user          User document or lean object
 * @returns {{ distanceInMeters: number, legs: object, error: string|null }}
 */
const calculateRouteDistance = (serviceType, runner, user) => {
  // ── Runner location (Runner model: latitude / longitude) ──────────────────
  const runnerCoords =
    runner.latitude != null && runner.longitude != null
      ? { lat: Number(runner.latitude), lng: Number(runner.longitude) }
      : null;

  // ── Delivery / drop-off location (User model: latitude / longitude) ───────
  const deliveryCoords =
    user.latitude != null && user.longitude != null
      ? { lat: Number(user.latitude), lng: Number(user.longitude) }
      : null;

  // ── Mid-point: market (errand) or pickup location (pick-up) ───────────────
  const isErrand = serviceType === 'run-errand'
  const isPickup = serviceType === 'pick-up'

  let midCoords = null;

  if (isErrand) {
    // User model: currentRequest.marketCoordinates { lat, lng }
    const mc = user.currentRequest?.marketCoordinates;
    if (mc?.lat != null && mc?.lng != null) {
      midCoords = { lat: Number(mc.lat), lng: Number(mc.lng) };
    }
  } else if (isPickup) {
    // User model: currentRequest.pickupCoordinates { lat, lng }
    const pc = user.currentRequest?.pickupCoordinates;
    if (pc?.lat != null && pc?.lng != null) {
      midCoords = { lat: Number(pc.lat), lng: Number(pc.lng) };
    }
  }

  // ── Guard: all three points must exist ────────────────────────────────────
  if (!runnerCoords) {
    return { distanceInMeters: 0, legs: {}, error: 'Runner location unavailable' };
  }
  if (!midCoords) {
    const label = isErrand ? 'market' : 'pickup';
    return { distanceInMeters: 0, legs: {}, error: `${label} coordinates unavailable on user request` };
  }
  if (!deliveryCoords) {
    return { distanceInMeters: 0, legs: {}, error: 'Delivery (user) location unavailable' };
  }

  // ── Calculate legs ────────────────────────────────────────────────────────
  const leg1 = haversineDistance(runnerCoords, midCoords);   // runner → market/pickup
  const leg2 = haversineDistance(midCoords, deliveryCoords); // market/pickup → delivery

  return {
    distanceInMeters: leg1 + leg2,
    legs: {
      runnerToMid:   Math.round(leg1),
      midToDelivery: Math.round(leg2),
      runnerCoords,
      midCoords,
      deliveryCoords,
    },
    error: null,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Main convenience export — call this everywhere instead of assembling manually
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute distance + delivery fee from live Runner and User documents.
 * This is the single function all handlers should call.
 *
 * For run-errand the caller also needs itemBudget separately (from user.currentRequest).
 * This function only owns the delivery fee — item budget stays in the handler.
 *
 * @param {string} serviceType
 * @param {object} runner   Runner document or lean object
 * @param {object} user     User document or lean object
 * @returns {{
 *   distanceInMeters: number,
 *   deliveryFee: number,
 *   legs: object,
 *   error: string|null
 * }}
 */
const computeDeliveryFeeFromDocs = (serviceType, runner, user) => {
  const { distanceInMeters, legs, error } = calculateRouteDistance(serviceType, runner, user);

  if (error) {
    console.warn(`[pricing] computeDeliveryFeeFromDocs — ${error}. Delivery fee defaulting to 0.`);
    return { distanceInMeters: 0, deliveryFee: 0, legs: legs || {}, error };
  }

  const deliveryFee = calculateDeliveryFee(distanceInMeters);

  return {
    distanceInMeters: Math.round(distanceInMeters),
    deliveryFee,
    legs,
    error: null,
  };
};

module.exports = {
  // Constants
  DELIVERY_FEE_PERCENTAGE,
  PLATFORM_FEE_PERCENTAGE,
  DELIVERY_FEE_PER_KM,
  RUNNER_SHARE,
  PAYSTACK_FEE_PERCENT,
  PAYSTACK_FEE_CAP,

  // Helpers
  haversineDistance,
  calculateDeliveryFee,
  calculateFeeSplit,
  calculateRouteDistance,
  computeDeliveryFeeFromDocs,
};