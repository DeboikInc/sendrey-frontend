const DELIVERY_FEE_PERCENTAGE = parseFloat(process.env.DELIVERY_FEE_PERCENTAGE) || 0.20;
const PLATFORM_FEE_PERCENTAGE = parseFloat(process.env.PLATFORM_FEE_PERCENTAGE) || 0.57;
const BASE_DELIVERY_FEE = parseFloat(process.env.BASE_DELIVERY_FEE) || 1500;
const RUNNER_SHARE = 1 - PLATFORM_FEE_PERCENTAGE;

// Paystack fee: 1% capped at ₦300, deducted from platform fee only
const PAYSTACK_FEE_PERCENT = 0.01;
const PAYSTACK_FEE_CAP = 300;

/**
 * Calculate all fee splits for a delivery fee amount
 * Provider fee always comes out of platform fee — runner is never touched
 */
const calculateFeeSplit = (deliveryFee) => {
  const platformFee = Math.round(deliveryFee * PLATFORM_FEE_PERCENTAGE);
  const runnerPayout = Math.round(deliveryFee * RUNNER_SHARE);
  const providerFee = Math.min(Math.round(deliveryFee * PAYSTACK_FEE_PERCENT), PAYSTACK_FEE_CAP);
  const netPlatformFee = platformFee - providerFee;

  return { deliveryFee, platformFee, runnerPayout, providerFee, netPlatformFee };
};

module.exports = {
  DELIVERY_FEE_PERCENTAGE,
  PLATFORM_FEE_PERCENTAGE,
  BASE_DELIVERY_FEE,
  RUNNER_SHARE,
  PAYSTACK_FEE_PERCENT,
  PAYSTACK_FEE_CAP,
  calculateFeeSplit,
};