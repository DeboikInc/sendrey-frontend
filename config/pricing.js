const DELIVERY_FEE_PERCENTAGE = parseFloat(process.env.DELIVERY_FEE_PERCENTAGE) || 0.20;
const PLATFORM_FEE_PERCENTAGE = parseFloat(process.env.PLATFORM_FEE_PERCENTAGE) || 0.57;
const DELIVERY_FEE_PER_KM_BIKE = parseFloat(process.env.DELIVERY_FEE_PER_KM_BIKE) || 500;
const DELIVERY_FEE_PER_KM_OTHER = parseFloat(process.env.DELIVERY_FEE_PER_KM_OTHER) || 700;
const RUNNER_SHARE = 1 - PLATFORM_FEE_PERCENTAGE;
const RUNNER_DEFAULT_METERS = 1000;

const PAYSTACK_FEE_PERCENT = 0.01;
const PAYSTACK_FEE_CAP = 300;

const haversineDistance = (a, b) => {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6_371_000;

  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

/**
 * @param {number} distanceInMeters
 * @param {string} fleetType  'bike' | 'tricycle' | 'van' | 'pedestrian' etc.
 * @returns {number} fee in ₦ (rounded)
 */
const calculateDeliveryFee = (distanceInMeters, fleetType) => {
  const ratePerKm = fleetType === 'bike' ? DELIVERY_FEE_PER_KM_BIKE : DELIVERY_FEE_PER_KM_OTHER;
  return Math.round(ratePerKm * (distanceInMeters / 1000));
};

const calculateFeeSplit = (deliveryFee) => {
  const platformFee = Math.round(deliveryFee * PLATFORM_FEE_PERCENTAGE);
  const runnerPayout = Math.round(deliveryFee * RUNNER_SHARE);
  const providerFee = Math.min(Math.round(deliveryFee * PAYSTACK_FEE_PERCENT), PAYSTACK_FEE_CAP);
  const netPlatformFee = platformFee - providerFee;

  return { deliveryFee, platformFee, runnerPayout, providerFee, netPlatformFee };
};

const calculateRouteDistance = (serviceType, user) => {
  const deliveryCoords = (() => {
    const dc = user.currentRequest?.deliveryCoordinates;
    if (dc?.lat != null && dc?.lng != null) {
      return { lat: Number(dc.lat), lng: Number(dc.lng) };
    }
    return null;
  })();

  const isErrand = serviceType === 'run-errand';
  const isPickup = serviceType === 'pick-up';

  let midCoords = null;

  if (isErrand) {
    const mc = user.currentRequest?.marketCoordinates;
    if (mc?.lat != null && mc?.lng != null) {
      midCoords = { lat: Number(mc.lat), lng: Number(mc.lng) };
    }
  } else if (isPickup) {
    const pc = user.currentRequest?.pickupCoordinates;
    if (pc?.lat != null && pc?.lng != null) {
      midCoords = { lat: Number(pc.lat), lng: Number(pc.lng) };
    }
  }

  if (!midCoords) {
    const label = isErrand ? 'market' : 'pickup';
    return { distanceInMeters: 0, legs: {}, error: `${label} coordinates unavailable on user request` };
  }
  if (!deliveryCoords) {
    return { distanceInMeters: 0, legs: {}, error: 'Delivery (user) location unavailable' };
  }

  const leg1 = RUNNER_DEFAULT_METERS;
  const leg2 = haversineDistance(midCoords, deliveryCoords);

  return {
    distanceInMeters: leg1 + leg2,
    legs: {
      runnerToMid: leg1,
      midToDelivery: Math.round(leg2),
      midCoords,
      deliveryCoords,
    },
    error: null,
  };
};

/**
 * @param {string} serviceType
 * @param {object} user        User document or lean object
 * @param {string} fleetType   'bike' | 'tricycle' | 'van' | 'pedestrian' etc.
 */
const computeDeliveryFeeFromDocs = (serviceType, user, fleetType) => {
  const { distanceInMeters, legs, error } = calculateRouteDistance(serviceType, user);

  if (error) {
    console.warn(`[pricing] computeDeliveryFeeFromDocs — ${error}. Delivery fee defaulting to 0.`);
    return { distanceInMeters: 0, deliveryFee: 0, legs: legs || {}, error };
  }

  const deliveryFee = calculateDeliveryFee(distanceInMeters, fleetType);

  return {
    distanceInMeters: Math.round(distanceInMeters),
    deliveryFee,
    legs,
    error: null,
  };
};

module.exports = {
  DELIVERY_FEE_PERCENTAGE,
  PLATFORM_FEE_PERCENTAGE,
  DELIVERY_FEE_PER_KM_BIKE,
  DELIVERY_FEE_PER_KM_OTHER,
  RUNNER_SHARE,
  PAYSTACK_FEE_PERCENT,
  PAYSTACK_FEE_CAP,

  haversineDistance,
  calculateDeliveryFee,
  calculateFeeSplit,
  calculateRouteDistance,
  computeDeliveryFeeFromDocs,
};