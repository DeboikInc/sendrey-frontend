const logger = require('../utils/logger');

/**
 * requireOtpVerified
 * Checks that the authenticated user has verified their phone via OTP.
 * Must be used after authenticate middleware (req.user must exist).
 *
 * Used to gate forgotPin — user proves identity via OTP first,
 * then this middleware confirms it before allowing PIN reset.
 */
const requireOtpVerified = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
  }

  if (!req.user.isPhoneVerified) {
    logger.warn(
      `OTP gate failed: ${req.user.email || req.user.phone || req.user._id} attempted access without phone verification`
    );

    return res.status(403).json({
      success: false,
      message: 'Phone verification required. Please verify your phone number via OTP first.',
    });
  }

  logger.debug(
    `OTP verified: ${req.user.email || req.user.phone || req.user._id} passed OTP gate`
  );

  next();
};

module.exports = { requireOtpVerified };