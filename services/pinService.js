const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Runner = require('../models/Runner');

const getModel = (role) => (role === 'runner' ? Runner : User);
const hashPin = (pin) => bcrypt.hash(pin, 10);
const comparePin = (raw, hashed) => bcrypt.compare(raw, hashed);
const validatePinFormat = (pin) => /^\d{4}$/.test(pin);

// ── setPin ────────────────────────────────────────────────────────────────────
// One-time setup. Fails if PIN already exists (use resetPin).
const setPin = async ({ userId, role, pin }) => {
  if (!validatePinFormat(pin))
    throw Object.assign(new Error('PIN must be exactly 4 digits'), { statusCode: 400 });

  const user = await getModel(role).findById(userId).select('+pin');
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });

  if (user.pin)
    throw Object.assign(new Error('PIN already set. Use reset PIN to change it.'), { statusCode: 409 });

  user.pin = await hashPin(pin);
  await user.save();
  return { message: 'PIN set successfully' };
};

// ── verifyPin ─────────────────────────────────────────────────────────────────
// Called before any payment action. Returns { valid: true/false }.
const verifyPin = async ({ userId, role, pin }) => {
  if (!validatePinFormat(pin))
    throw Object.assign(new Error('PIN must be exactly 4 digits'), { statusCode: 400 });

  const user = await getModel(role).findById(userId).select('+pin');
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });

  if (!user.pin)
    throw Object.assign(new Error('No PIN set on this account'), { statusCode: 400 });

  const valid = await comparePin(pin, user.pin);
  return { valid };
};

// ── resetPin ──────────────────────────────────────────────────────────────────
// User remembers current PIN, wants to change it.
const resetPin = async ({ userId, role, currentPin, newPin }) => {
  if (!validatePinFormat(currentPin) || !validatePinFormat(newPin))
    throw Object.assign(new Error('PINs must be exactly 4 digits'), { statusCode: 400 });

  if (currentPin === newPin)
    throw Object.assign(new Error('New PIN must differ from current PIN'), { statusCode: 400 });

  const user = await getModel(role).findById(userId).select('+pin');
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });

  if (!user.pin)
    throw Object.assign(new Error('No PIN set. Use set PIN.'), { statusCode: 400 });

  const isMatch = await comparePin(currentPin, user.pin);
  if (!isMatch)
    throw Object.assign(new Error('Current PIN is incorrect'), { statusCode: 401 });

  user.pin = await hashPin(newPin);
  await user.save();
  return { message: 'PIN updated successfully' };
};

// ── forgotPin ─────────────────────────────────────────────────────────────────
// User forgot PIN. Identity already proven via OTP upstream (protect middleware
// should verify OTP was completed before calling this). Just sets new PIN.
const forgotPin = async ({ userId, role, newPin, confirmPin }) => {
  if (!validatePinFormat(newPin) || !validatePinFormat(confirmPin))
    throw Object.assign(new Error('PINs must be exactly 4 digits'), { statusCode: 400 });

  if (newPin !== confirmPin)
    throw Object.assign(new Error('PINs do not match'), { statusCode: 400 });

  const user = await getModel(role).findById(userId).select('+pin');
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });

  user.pin = await hashPin(newPin);
  await user.save();
  return { message: 'PIN reset successfully' };
};

module.exports = { setPin, verifyPin, resetPin, forgotPin };