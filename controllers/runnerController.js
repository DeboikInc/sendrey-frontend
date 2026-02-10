// controllers/runnerController.js
const BaseController = require('./baseController');
const runnerService = require('../services/runnerService');
const logger = require('../utils/logger');

class RunnerController extends BaseController {
  constructor() {
    super(runnerService);

    // Bind all methods to maintain 'this' context
    this.getProfile = this.getProfile.bind(this);
    this.updateProfile = this.updateProfile.bind(this);
    this.getNearbyRunners = this.getNearbyRunners.bind(this);
    this.getRunners = this.getRunners.bind(this);
    this.getRunnersByServiceType = this.getRunnersByServiceType.bind(this);
    this.getOnlineRunners = this.getOnlineRunners.bind(this);
    this.updateRunnerLocation = this.updateRunnerLocation.bind(this);
    this.setRunnerOnlineStatus = this.setRunnerOnlineStatus.bind(this);
    this.getRunnerStats = this.getRunnerStats.bind(this);
    this.updateVerificationDocuments = this.updateVerificationDocuments.bind(this);
    this.updateBiometricVerification = this.updateBiometricVerification.bind(this);
    this.updateRunnerStatus = this.updateRunnerStatus.bind(this);
    this.searchRunners = this.searchRunners.bind(this);
    this.deleteRunner = this.deleteRunner.bind(this);
    this._sanitizeRunner = this._sanitizeRunner.bind(this);
  }

  /**
   * Get runner profile
   */
  async getProfile(req, res, next) {
    try {
      const runner = await this.service.getRunnerById(req.user.id);
      return this.success(res, { runner: this._sanitizeRunner(runner) });
    } catch (error) {
      logger.error('Get runner profile error:', error);
      next(error);
    }
  }

  /**
   * Update runner profile
   */
  async updateProfile(req, res, next) {
    try {
      const runnerId = req.params.runnerId || req.user.id;
      const updateData = req.body;

      const runner = await this.service.updateRunner(runnerId, updateData);
      if (!runner) {
        return this.notFound(res, 'Runner not found');
      }

      logger.info(`Profile updated for runner: ${runner.email || runner.phone || runnerId}`);

      return this.success(res, {
        runner: this._sanitizeRunner(runner)
      }, 'Profile updated successfully');
    } catch (error) {
      logger.error('Update runner profile error:', error);
      next(error);
    }
  }

  /**
   * Get nearby runners (within 2km)
   */
  async getNearbyRunners(req, res, next) {
    try {
      const { latitude, longitude, serviceType, fleetType } = req.query;

      if (!latitude || !longitude) {
        return this.badRequest(res, 'Latitude and longitude are required');
      }

      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);

      if (isNaN(lat) || isNaN(lng)) {
        return this.badRequest(res, 'Invalid latitude or longitude');
      }

      if (lat < -90 || lat > 90) {
        return this.badRequest(res, 'Latitude must be between -90 and 90');
      }
      if (lng < -180 || lng > 180) {
        return this.badRequest(res, 'Longitude must be between -180 and 180');
      }

      const validServiceTypes = ['pick-up', 'run-errand'];
      if (serviceType && !validServiceTypes.includes(serviceType)) {
        return this.badRequest(res, `Invalid service type. Must be one of: ${validServiceTypes.join(', ')}`);
      }

      const validFleetTypes = ['cycling', 'bike', 'car', 'van', 'pedestrian'];
      if (fleetType && !validFleetTypes.includes(fleetType)) {
        return this.badRequest(res, `Invalid fleet type. Must be one of: ${validFleetTypes.join(', ')}`);
      }

      const runners = await this.service.findNearbyRunners({
        latitude: lat,
        longitude: lng,
        serviceType,
        fleetType,
        maxDistance: 2000
      });

      console.log('DEBUG IN RUNNER CONTROLLER');
      console.log('Nearby runners search:');
      console.log('  Query params:', { lat, lng, serviceType, fleetType });
      console.log('Runner Results:', runners.length);

      if (runners.length === 0) {
        const allRunners = await this.service.getAllRunners();
        console.log('Total runners in DB:', allRunners.length);

        const onlineRunners = await this.service.getOnlineRunners(serviceType, fleetType);
        console.log('Online runners matching criteria:', onlineRunners.length);

        if (onlineRunners.length > 0) {
          console.log('Online runner details:', onlineRunners.map(r => ({
            id: r._id,
            name: `${r.firstName} ${r.lastName}`,
            serviceType: r.serviceType,
            fleetType: r.fleetType,
            location: r.location,
            lat: r.latitude,
            lng: r.longitude,
            isOnline: r.isOnline,
            isAvailable: r.isAvailable
          })));
        }
      }

      return this.success(res, {
        count: runners.length,
        runners
      }, `Found ${runners.length} nearby runner${runners.length !== 1 ? 's' : ''}`);
    } catch (error) {
      logger.error('Error finding nearby runners:', error);
      next(error);
    }
  }

  /**
   * Get all runners
   */
  async getRunners(req, res, next) {
    try {
      const { fleetType, serviceType, page = 1, limit = 10 } = req.query;

      const result = await this.service.listRunners({
        fleetType,
        serviceType,
        page,
        limit
      });

      return this.success(res, {
        count: result.runners.length,
        ...result
      });
    } catch (error) {
      logger.error('Error fetching runners:', error);
      next(error);
    }
  }

  /**
   * Get runners by service type
   */
  async getRunnersByServiceType(req, res, next) {
    try {
      const { serviceType } = req.params;
      const runners = await this.service.findRunnersByServiceType(serviceType);

      return this.success(res, {
        count: runners.length,
        runners
      });
    } catch (error) {
      logger.error('Error fetching runners by service type:', error);
      next(error);
    }
  }

  /**
   * Get online runners
   */
  async getOnlineRunners(req, res, next) {
    try {
      const { serviceType, fleetType } = req.query;

      const runners = await this.service.getOnlineRunners(serviceType, fleetType);

      return this.success(res, {
        count: runners.length,
        runners
      });
    } catch (error) {
      logger.error('Error fetching online runners:', error);
      next(error);
    }
  }

  /**
   * Update runner location
   */
  async updateRunnerLocation(req, res, next) {
    try {
      const { latitude, longitude } = req.body;
      const runnerId = req.user.id;

      if (!latitude || !longitude) {
        return this.badRequest(res, 'Latitude and longitude are required');
      }

      const runner = await this.service.updateRunnerLocation(runnerId, latitude, longitude);

      return this.success(res, { runner }, 'Location updated successfully');
    } catch (error) {
      logger.error('Error updating runner location:', error);
      next(error);
    }
  }

  /**
   * Set runner online status
   */
  async setRunnerOnlineStatus(req, res, next) {
    try {
      const { isOnline, isAvailable } = req.body;
      const runnerId = req.user.id;

      if (isOnline === undefined && isAvailable === undefined) {
        return this.badRequest(res, 'Either isOnline or isAvailable is required');
      }

      const runner = await this.service.setRunnerOnlineStatus(runnerId, isOnline, isAvailable);

      return this.success(res, { runner }, 'Status updated successfully');
    } catch (error) {
      logger.error('Error updating runner status:', error);
      next(error);
    }
  }

  /**
   * Get runner statistics
   */
  async getRunnerStats(req, res, next) {
    try {
      const stats = await this.service.getRunnerStats();

      return this.success(res, { stats });
    } catch (error) {
      logger.error('Error fetching runner stats:', error);
      next(error);
    }
  }

  /**
   * Update runner verification documents
   */
  async updateVerificationDocuments(req, res, next) {
    try {
      const { documentType } = req.params;
      const documentData = req.body;
      const runnerId = req.user.id;

      const runner = await this.service.updateVerificationDocuments(runnerId, documentType, documentData);

      return this.success(res, {
        runner: this._sanitizeRunner(runner)
      }, 'Verification document submitted successfully');
    } catch (error) {
      logger.error('Error updating verification documents:', error);
      next(error);
    }
  }

  /**
   * Update runner biometric verification
   */
  async updateBiometricVerification(req, res, next) {
    try {
      const biometricData = req.body;
      const runnerId = req.user.id;

      const runner = await this.service.updateBiometricVerification(runnerId, biometricData);

      return this.success(res, {
        runner: this._sanitizeRunner(runner)
      }, 'Biometric verification submitted successfully');
    } catch (error) {
      logger.error('Error updating biometric verification:', error);
      next(error);
    }
  }

  /**
   * Update runner status (admin only)
   */
  async updateRunnerStatus(req, res, next) {
    try {
      const { runnerId } = req.params;
      const { status } = req.body;
      const updatedBy = req.user.id;

      const validStatuses = ['active', 'inactive', 'suspended', 'pending'];
      if (!validStatuses.includes(status)) {
        return this.badRequest(res, `Invalid status. Must be one of: ${validStatuses.join(', ')}`);
      }

      const runner = await this.service.updateRunnerStatus(runnerId, status, updatedBy);

      logger.info(`Runner status updated: ${runnerId} to ${status} by admin ${updatedBy}`);

      return this.success(res, {
        runner: this._sanitizeRunner(runner)
      }, `Runner status updated to ${status}`);
    } catch (error) {
      logger.error('Update runner status error:', error);
      next(error);
    }
  }

  /**
   * Search runners
   */
  async searchRunners(req, res, next) {
    try {
      const filters = req.query;
      const result = await this.service.searchRunners(filters);

      return this.success(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete runner (admin only)
   */
  async deleteRunner(req, res, next) {
    try {
      const { runnerId } = req.params;
      await this.service.deleteRunner(runnerId);

      logger.info(`Runner deleted: ${runnerId}`);
      return this.success(res, null, 'Runner deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Remove sensitive data from runner object
   */
  _sanitizeRunner(runner) {
    if (!runner) return null;

    const runnerObj = runner.toObject ? runner.toObject() : { ...runner };

    const sensitiveFields = [
      'password', '__v',
      'verificationToken', 'verificationExpires',
      'resetPasswordToken', 'resetPasswordExpires',
      'phoneVerificationOTP', 'phoneVerificationExpires'
    ];

    sensitiveFields.forEach(field => delete runnerObj[field]);

    return runnerObj;
  }
}

module.exports = new RunnerController();