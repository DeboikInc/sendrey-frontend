const Runner = require('../models/Runner');
const logger = require('../utils/logger');

class RunnerService {
  /**
   * Update last login for runner
   */
  async updateLastLogin(id) {
    const runner = await Runner.findById(id);

    if (!runner) {
      throw new Error('Runner does not exist');
    }

    runner.lastLogin = Date.now();
    await runner.save();
  }

  /**
   * Get runner by email or phone
   */
  async getRunnerByEmail(email, phone) {
    const runner = await Runner.findOne({
      $or: [
        { email: email || '' },
        { phone: phone || '' }
      ]
    });

    if (!runner) {
      throw new Error('Invalid credentials or runner does not exist');
    }

    return runner;
  }

  /**
   * Find nearby runners within specified distance
   */
  async findNearbyRunners({ latitude, longitude, serviceType, fleetType, maxDistance = 2000 }) {
    return await Runner.findNearbyRunners({
      latitude,
      longitude,
      serviceType,
      fleetType,
      maxDistance
    });
  }

  /**
   * Get all runners with optional filters
   */
  async getAllRunners(serviceType, fleetType) {
    const query = {};

    if (serviceType) query.serviceType = serviceType;
    if (fleetType) query.fleetType = fleetType;

    return await Runner.find(query)
      .select('firstName lastName phone fleetType serviceType location latitude longitude isOnline isAvailable avatar')
      .lean();
  }

  /**
   * Find runners by service type
   */
  async findRunnersByServiceType(serviceType) {
    return await Runner.find({ 
      serviceType 
    })
      .select('firstName lastName phone fleetType serviceType location latitude longitude isOnline isAvailable avatar')
      .lean();
  }

  /**
   * Get online runners with optional filters
   */
  async getOnlineRunners(serviceType, fleetType) {
    const query = {
      isOnline: true,
      isAvailable: true,
      runnerStatus: 'verified' // Only verified runners
    };

    if (serviceType) query.serviceType = serviceType;
    if (fleetType) query.fleetType = fleetType;

    return await Runner.find(query)
      .select('firstName lastName phone fleetType serviceType location latitude longitude isOnline avatar')
      .lean();
  }

  /**
   * Update runner location
   */
  async updateRunnerLocation(userId, latitude, longitude) {
    const runner = await Runner.findByIdAndUpdate(
      userId,
      {
        latitude,
        longitude,
        lastLocationUpdate: new Date()
      },
      { new: true }
    ).select('firstName lastName location latitude longitude lastLocationUpdate');

    if (!runner) {
      throw new Error('Runner not found');
    }

    return runner;
  }

  /**
   * Set runner online status
   */
  async setRunnerOnlineStatus(userId, isOnline, isAvailable) {
    const updateData = { lastActive: new Date() };
    
    if (typeof isOnline === 'boolean') {
      updateData.isOnline = isOnline;
    }
    
    if (typeof isAvailable === 'boolean') {
      updateData.isAvailable = isAvailable;
    }

    const runner = await Runner.findByIdAndUpdate(
      userId,
      updateData,
      { new: true }
    ).select('firstName lastName isOnline isAvailable avatar');

    if (!runner) {
      throw new Error('Runner not found');
    }

    return runner;
  }

  /**
   * Get runner by ID
   */
  async getRunnerById(id) {
    const runner = await Runner.findById(id);

    if (!runner) {
      throw new Error('Runner does not exist');
    }

    return runner;
  }

  /**
   * Update runner profile
   */
  async updateRunner(id, updateData) {
    const runner = await Runner.findById(id);

    if (!runner) {
      throw new Error('Runner does not exist');
    }

    const updatedRunner = await Runner.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    return updatedRunner;
  }

  /**
   * Get runner statistics
   */
  async getRunnerStats() {
    const totalRunners = await Runner.countDocuments();
    const onlineRunners = await Runner.countDocuments({ isOnline: true });
    const availableRunners = await Runner.countDocuments({ 
      isOnline: true, 
      isAvailable: true,
      runnerStatus: 'verified'
    });

    const runnersByService = await Runner.aggregate([
      { $group: { _id: '$serviceType', count: { $sum: 1 } } }
    ]);

    const runnersByFleet = await Runner.aggregate([
      { $group: { _id: '$fleetType', count: { $sum: 1 } } }
    ]);

    const runnersByStatus = await Runner.aggregate([
      { $group: { _id: '$runnerStatus', count: { $sum: 1 } } }
    ]);

    return {
      total: totalRunners,
      online: onlineRunners,
      available: availableRunners,
      byService: runnersByService,
      byFleet: runnersByFleet,
      byStatus: runnersByStatus
    };
  }

  /**
   * List runners with pagination and filters
   */
  async listRunners(filters = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        serviceType,
        fleetType,
        runnerStatus,
        isOnline,
        isAvailable,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        dateFrom,
        dateTo
      } = filters;

      // Build query
      const query = {};

      if (search) {
        query.$or = [
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } }
        ];
      }

      if (serviceType) query.serviceType = serviceType;
      if (fleetType) query.fleetType = fleetType;
      if (runnerStatus) query.runnerStatus = runnerStatus;
      if (isOnline !== undefined) query.isOnline = isOnline;
      if (isAvailable !== undefined) query.isAvailable = isAvailable;

      // Date range filter
      if (dateFrom || dateTo) {
        query.createdAt = {};
        if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
        if (dateTo) query.createdAt.$lte = new Date(dateTo);
      }

      // Calculate pagination
      const skip = (page - 1) * limit;

      // Execute query
      const [runners, total] = await Promise.all([
        Runner.find(query)
          .select('-password -verificationToken -resetPasswordToken')
          .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
          .skip(skip)
          .limit(limit),
        Runner.countDocuments(query)
      ]);

      const totalPages = Math.ceil(total / limit);
      const hasNext = page < totalPages;
      const hasPrev = page > 1;

      return {
        runners,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages,
          hasNext,
          hasPrev
        }
      };
    } catch (error) {
      logger.error('RunnerService - List runners error:', error);
      throw error;
    }
  }

  /**
   * Search runners with advanced filters
   */
  async searchRunners(filters = {}) {
    try {
      const {
        query: searchQuery,
        serviceType,
        fleetType,
        runnerStatus,
        isOnline,
        isAvailable,
        dateFrom,
        dateTo
      } = filters;

      // Build search query
      const query = {};

      if (searchQuery) {
        query.$or = [
          { firstName: { $regex: searchQuery, $options: 'i' } },
          { lastName: { $regex: searchQuery, $options: 'i' } },
          { email: { $regex: searchQuery, $options: 'i' } },
          { phone: { $regex: searchQuery, $options: 'i' } }
        ];
      }

      if (serviceType) query.serviceType = serviceType;
      if (fleetType) query.fleetType = fleetType;
      if (runnerStatus) query.runnerStatus = runnerStatus;
      if (isOnline !== undefined) query.isOnline = isOnline;
      if (isAvailable !== undefined) query.isAvailable = isAvailable;

      // Date range
      if (dateFrom || dateTo) {
        query.createdAt = {};
        if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
        if (dateTo) query.createdAt.$lte = new Date(dateTo);
      }

      const runners = await Runner.find(query)
        .select('-password -verificationToken -resetPasswordToken')
        .sort({ createdAt: -1 })
        .limit(50);

      return { runners, count: runners.length };
    } catch (error) {
      logger.error('RunnerService - Search runners error:', error);
      throw error;
    }
  }

  /**
   * Delete runner
   */
  async deleteRunner(runnerId) {
    try {
      const runner = await Runner.findByIdAndDelete(runnerId);

      if (!runner) {
        throw new Error('Runner not found');
      }

      return { message: 'Runner deleted successfully' };
    } catch (error) {
      logger.error('RunnerService - Delete runner error:', error);
      throw error;
    }
  }

  /**
   * Update runner verification documents
   */
  async updateVerificationDocuments(runnerId, documentType, documentData) {
    try {
      const updateField = `verificationDocuments.${documentType}`;
      
      const runner = await Runner.findByIdAndUpdate(
        runnerId,
        {
          $set: {
            [updateField]: {
              ...documentData,
              submittedAt: new Date(),
              status: 'pending'
            }
          }
        },
        { new: true, runValidators: true }
      );

      if (!runner) {
        throw new Error('Runner not found');
      }

      return runner;
    } catch (error) {
      logger.error('RunnerService - Update verification documents error:', error);
      throw error;
    }
  }

  /**
   * Update runner biometric verification
   */
  async updateBiometricVerification(runnerId, biometricData) {
    try {
      const runner = await Runner.findByIdAndUpdate(
        runnerId,
        {
          $set: {
            biometricVerification: {
              ...biometricData,
              submittedAt: new Date(),
              status: 'pending'
            }
          }
        },
        { new: true, runValidators: true }
      );

      if (!runner) {
        throw new Error('Runner not found');
      }

      return runner;
    } catch (error) {
      logger.error('RunnerService - Update biometric verification error:', error);
      throw error;
    }
  }

  /**
   * Update runner status (admin only)
   */
  async updateRunnerStatus(runnerId, statusData) {
    try {
      const runner = await Runner.findByIdAndUpdate(
        runnerId,
        { $set: statusData },
        { new: true, runValidators: true }
      );

      if (!runner) {
        throw new Error('Runner not found');
      }

      return runner;
    } catch (error) {
      logger.error('RunnerService - Update runner status error:', error);
      throw error;
    }
  }
}

module.exports = new RunnerService();