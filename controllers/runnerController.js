// controllers/runnerController.js
const BaseController = require('./baseController');
const runnerService = require('../services/runnerService');
const logger = require('../utils/logger');
const Runner = require('../models/Runner');

const { MAX_DISTANCE } = require('../config/constants');
const cloudinary = require('../config/cloudinary');

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
    this.updateAvatar = this.updateAvatar.bind(this);
    this.resetStrikes = this.resetStrikes.bind(this);
    this.deleteRunner = this.deleteRunner.bind(this);
    this._sanitizeRunner = this._sanitizeRunner.bind(this);
  }

  /**
   * Get runner profile
   */
  async getProfile(req, res, next) {
    try {
      const runner = await this.service.getRunnerById(req.user.id);
      const sanitized = this._sanitizeRunner(runner);
      console.log('sanitized avatar:', sanitized.avatar);
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
      console.log("Incoming data", updateData)

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
   * Get nearby runners 
   */
  async getNearbyRunners(req, res, next) {
    try {
      const {
        pickupLat, pickupLng, latitude,
        longitude, fleetType, sortBy,
        // serviceType,
      } = req.query;

      const lat = parseFloat(pickupLat || latitude);
      const lng = parseFloat(pickupLng || longitude);


      if (!lat || !lng) {  // guard 
        return this.badRequest(res, 'Location coordinates are required');
      }

      if (isNaN(lat) || isNaN(lng)) {
        return this.badRequest(res, 'Invalid pickupLat or pickupLng');
      }

      if (lat < -90 || lat > 90) {
        return this.badRequest(res, 'pickupLat must be between -90 and 90');
      }
      if (lng < -180 || lng > 180) {
        return this.badRequest(res, 'pickupLng must be between -180 and 180');
      }

      // const validServiceTypes = ['pick-up', 'run-errand'];
      // if (serviceType && !validServiceTypes.includes(serviceType)) {
      //   return this.badRequest(res, `Invalid service type. Must be one of: ${validServiceTypes.join(', ')}`);
      // }

      const validFleetTypes = ['cycling', 'bike', 'car', 'van', 'pedestrian'];
      if (fleetType && !validFleetTypes.includes(fleetType)) {
        return this.badRequest(res, `Invalid fleet type. Must be one of: ${validFleetTypes.join(', ')}`);
      }

      const runners = await this.service.findNearbyRunners({
        pickupLat: lat,
        pickupLng: lng,
        // serviceType,
        fleetType,
      });


      const eligibleRunners = runners.filter(runner => {
        console.log('Runner KYC check:', {
          id: runner._id,
          runnerStatus: runner.runnerStatus,
          isOnline: runner.isOnline,
          isAvailable: runner.isAvailable,
          // isPhoneVerified: runner.isPhoneVerified,
          isEmailVerified: runner.isEmailVerified,
          selfieStatus: runner.verificationDocuments?.selfie?.status,
          ninStatus: runner.verificationDocuments?.nin?.status,
          licenseStatus: runner.verificationDocuments?.driverLicense?.status,
        })
        if (runner.runnerStatus === 'suspended' || runner.runnerStatus === 'banned') {
          return false;
        }

        const allowedStatuses = [
          'pending_verification',
          'approved_limited',
          'approved_full',
          'pending_review',
          'submitted'
        ];

        if (!allowedStatuses.includes(runner.runnerStatus)) {
          return false;
        }

        // Check ID doc — must have at least one approved/pending (not rejected/not_submitted)
        const blockedDocStatuses = ['not_submitted', 'rejected'];
        const ninBlocked = blockedDocStatuses.includes(runner.verificationDocuments?.nin?.status);
        const licenseBlocked = blockedDocStatuses.includes(runner.verificationDocuments?.driverLicense?.status);
        const hasValidIdDoc = !ninBlocked || !licenseBlocked;

        if (!hasValidIdDoc) return false;

        // Check selfie — must be submitted or approved
        const selfieStatus = runner.biometricVerification?.status;
        const validSelfieStatuses = ['submitted', 'approved', 'pending_review'];
        if (!validSelfieStatuses.includes(selfieStatus)) return false;

        // Check phone verified
        // if (!runner.isPhoneVerified) return false;

        if (!runner.isEmailVerified) return false;

        return runner.isOnline && runner.isAvailable;
      });

      if (sortBy === 'rating') {
        eligibleRunners.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      }

      return this.success(res, {
        count: eligibleRunners.length,
        runners: eligibleRunners
      }, `Found ${eligibleRunners.length} nearby runner${eligibleRunners.length !== 1 ? 's' : ''}`);
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

      const validStatuses = ['active', 'inactive', 'suspended', 'pending', 'banned'];
      if (!validStatuses.includes(status)) {
        return this.badRequest(res, `Invalid status. Must be one of: ${validStatuses.join(', ')}`);
      }

      const runner = await this.service.updateRunnerStatus(runnerId, status, updatedBy);

      // emit unban event via socket
      // const io = req.app.get('io');
      // if (io && status !== 'banned') {
      //   io.to(`runner-${runnerId}`).emit('verificationStatus', {
      //     isBanned: false,
      //     isUnbanned: true,
      //     reason: null,
      //   });
      // }

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

  async updateAvatar(req, res, next) {
    try {
      const runnerId = req.params.runnerId;

      if (!req.file) {
        return this.badRequest(res, 'No image file provided');
      }

      // Upload buffer to cloudinary as a stream
      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: 'sendrey/runner-avatars',
            public_id: `runner-${runnerId}`,
            overwrite: true,
            transformation: [
              { width: 400, height: 400, crop: 'fill', gravity: 'face' },
              { quality: 'auto', fetch_format: 'auto' }
            ]
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        stream.end(req.file.buffer);
      });

      const runner = await this.service.updateRunner(runnerId, {
        avatar: uploadResult.secure_url
      });

      if (!runner) {
        return this.notFound(res, 'Runner not found');
      }

      logger.info(`Avatar updated for runner: ${runnerId}`);

      return this.success(res, {
        runner: this._sanitizeRunner(runner),
        avatarUrl: uploadResult.secure_url
      }, 'Profile picture updated successfully');

    } catch (error) {
      logger.error('Update avatar error:', error);
      next(error);
    }
  }

  async resetStrikes(req, res, next) {
    try {
      const { runnerId } = req.params;
      const runner = await Runner.findByIdAndUpdate(
        runnerId,
        { $set: { itemRejectionCount: 0 } },
        { new: true }
      );
      if (!runner) return this.notFound(res, 'Runner not found');
      logger.info(`Strike count reset for runner: ${runnerId}`);
      return this.success(res, { runner: this._sanitizeRunner(runner) }, 'Strike count reset');
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