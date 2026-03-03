const BaseController = require('./baseController');
const pinService = require('../services/pinService');

class PinController extends BaseController {
  constructor() {
    super(pinService);
    this.setPin = this.setPin.bind(this);
    this.verifyPin = this.verifyPin.bind(this);
    this.resetPin = this.resetPin.bind(this);
    this.forgotPin = this.forgotPin.bind(this);
  }

  async setPin(req, res) {
    try {
      const { pin } = req.body;
      if (!pin) return this.badRequest(res, 'PIN is required');

      const result = await pinService.setPin({
        userId: req.user._id,
        role: req.user.role,
        pin,
      });

      return this.success(res, null, result.message);
    } catch (err) {
      if (err.statusCode === 409) return this.error(res, err.message, 409);
      if (err.statusCode === 400) return this.badRequest(res, err.message);
      if (err.statusCode === 404) return this.notFound(res, err.message);
      return this.error(res, err.message);
    }
  }

  async verifyPin(req, res) {
    try {
      const { pin } = req.body;
      if (!pin) return this.badRequest(res, 'PIN is required');

      const { valid } = await pinService.verifyPin({
        userId: req.user._id,
        role: req.user.role,
        pin,
      });

      if (!valid) return this.error(res, 'Incorrect PIN', 401);

      return this.success(res, null, 'PIN verified');
    } catch (err) {
      if (err.statusCode === 400) return this.badRequest(res, err.message);
      if (err.statusCode === 404) return this.notFound(res, err.message);
      return this.error(res, err.message);
    }
  }

  async resetPin(req, res) {
    try {
      const { currentPin, newPin } = req.body;
      if (!currentPin || !newPin) return this.badRequest(res, 'currentPin and newPin are required');

      const result = await pinService.resetPin({
        userId: req.user._id,
        role: req.user.role,
        currentPin,
        newPin,
      });

      return this.success(res, null, result.message);
    } catch (err) {
      if (err.statusCode === 401) return this.error(res, err.message, 401);
      if (err.statusCode === 400) return this.badRequest(res, err.message);
      if (err.statusCode === 404) return this.notFound(res, err.message);
      return this.error(res, err.message);
    }
  }

  async forgotPin(req, res) {
    try {
      const { newPin, confirmPin } = req.body;
      if (!newPin || !confirmPin) return this.badRequest(res, 'newPin and confirmPin are required');

      const result = await pinService.forgotPin({
        userId: req.user._id,
        role: req.user.role,
        newPin,
        confirmPin,
      });

      return this.success(res, null, result.message);
    } catch (err) {
      if (err.statusCode === 400) return this.badRequest(res, err.message);
      if (err.statusCode === 404) return this.notFound(res, err.message);
      return this.error(res, err.message);
    }
  }
}

module.exports = new PinController();