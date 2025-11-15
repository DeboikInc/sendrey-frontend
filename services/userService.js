const User = require('../models/User');
const activityService = require('./activityService');
const logger = require('../utils/logger');

class UserService {
  /**
   * update last login user
   */
  async updateLastLogin(id) {
    const user = await User.findById(id);

    if (!user) {
      throw new Error('User does not exist');
    }

    user.lastLogin = Date.now();

    await user.save();
  }

  /**
   * user by email
   */
  async getUserByEmail(email, phone) {

    // Find user
    const user = await User.findOne({
      $or: [
        { email },
        { phone }
      ]
    });

    if (!user) {
      throw new Error('Invalid credentials or user does not exist');
    }

    return user;
  }

  /**
 * find single user by id 
 */
  async getUserById(id) {
    const user = await User.findById(id);

    if (!user) {
      throw new Error('User does not exist');
    }

    return user
  }

  // Get runners by service type
  async findRunnersByServiceType(serviceType) {
    return await User.find({
      role: 'runner',
      serviceType: serviceType,
      isActive: true,
      isVerified: true
    }).select('firstName lastName avatar phone fleetType serviceType');
  }

  // Get nearby runners by service type and location
  async findNearbyRunners(serviceType, nearestBusStop) {
    return await User.find({
      role: 'runner',
      serviceType: serviceType,
      nearestBusStop: new RegExp(nearestBusStop, 'i'),
      isActive: true,
      isVerified: true
    }).select('firstName lastName avatar phone fleetType serviceType');
  }

  /**
   * Get public user profile (excludes sensitive information)
   */
  async getPublicProfile(userId) {
    try {
      const user = await User.findById(userId).select('-email -phone -verificationToken -resetPasswordToken');

      if (!user) {
        throw new Error('User not found');
      }

      if (!user.isActive) {
        throw new Error('User profile is not available');
      }

      // Only return public information
      const publicProfile = {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar,
        bio: user.bio,
        website: user.website,
        isEmailPublic: user.isEmailPublic,
        isPhonePublic: user.isPhonePublic,
        createdAt: user.createdAt,
        // Only include email/phone if user has made them public
        ...(user.isEmailPublic && { email: user.email }),
        ...(user.isPhonePublic && { phone: user.phone })
      };

      return publicProfile;
    } catch (error) {
      logger.error('UserService - Get public profile error:', error);
      throw error;
    }
  }

  /**
    * List users with pagination and filters
    */
  async listUsers(filters = {}) {
    try {

      const {
        page = 1,
        limit = 10,
        search,
        role,
        isActive,
        isVerified,
        country,
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
          { email: { $regex: search, $options: 'i' } }
        ];
      }

      if (role) query.role = role;
      if (isActive !== undefined) query.isActive = isActive;
      if (isVerified !== undefined) query.isVerified = isVerified;
      if (country) query.country = country;

      // Date range filter
      if (dateFrom || dateTo) {
        query.createdAt = {};
        if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
        if (dateTo) query.createdAt.$lte = new Date(dateTo);
      }

      // Calculate pagination
      const skip = (page - 1) * limit;

      // Execute query
      const [users, total] = await Promise.all([
        User.find(query)
          .select('-password -verificationToken -resetPasswordToken')
          .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
          .skip(skip)
          .limit(limit),
        User.countDocuments(query)
      ]);

      console.log('Users found:', users.length);
      console.log('Total matching query:', total);

      const totalPages = Math.ceil(total / limit);
      const hasNext = page < totalPages;
      const hasPrev = page > 1;

      return {
        users,
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
      logger.error('UserService - List users error:', error);
      throw error;
    }
  }

  /**
 * update single user by id 
 */
  async updateUser(id, updateData) {
    const user = await User.findById(id);

    if (!user) {
      throw new Error('User does not exist');
    }

    const updatedUser = await User.findByIdAndUpdate(id, updateData)

    return updatedUser;
  }

  /**
  * Update notification preferences
  */
  async updateNotificationPreferences(userId, preferences) {
    try {
      const user = await User.findByIdAndUpdate(
        userId,
        {
          $set: {
            notificationPreferences: preferences
          }
        },
        { new: true }
      );

      if (!user) {
        throw new Error('User not found');
      }

      return user;
    } catch (error) {
      logger.error('UserService - Update notification preferences error:', error);
      throw error;
    }
  }

  /**
   * Update user role (admin only)
   */
  async updateUserRole(userId, role) {
    try {
      const user = await User.findByIdAndUpdate(
        userId,
        { role },
        { new: true, runValidators: true }
      );

      if (!user) {
        throw new Error('User not found');
      }

      return user;
    } catch (error) {
      logger.error('UserService - Update user role error:', error);
      throw error;
    }
  }

  /**
     * Update user status (active/inactive)
     */
  async updateUserStatus(userId, isActive, reason = '') {
    try {
      const user = await User.findByIdAndUpdate(
        userId,
        {
          isActive,
          ...(reason && { statusReason: reason })
        },
        { new: true }
      );

      if (!user) {
        throw new Error('User not found');
      }

      return user;
    } catch (error) {
      logger.error('UserService - Update user status error:', error);
      throw error;
    }
  }

  /**
   * Delete user
   */
  async deleteUser(userId) {
    try {
      const user = await User.findByIdAndDelete(userId);

      if (!user) {
        throw new Error('User not found');
      }

      // In a real application, you might want to soft delete
      // or archive user data instead of hard delete
      return { message: 'User deleted successfully' };
    } catch (error) {
      logger.error('UserService - Delete user error:', error);
      throw error;
    }
  }

  /**
  * Search users with advanced filters
  */
  async searchUsers(filters = {}) {
    try {
      const {
        query: searchQuery,
        role,
        isActive,
        isVerified,
        country,
        dateFrom,
        dateTo,
        hasPhone,
        hasAvatar
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

      if (role) query.role = role;
      if (isActive !== undefined) query.isActive = isActive;
      if (isVerified !== undefined) query.isVerified = isVerified;
      if (country) query.country = country;

      // Special filters
      if (hasPhone !== undefined) {
        query.phone = hasPhone ? { $exists: true, $ne: '' } : { $exists: false };
      }

      if (hasAvatar !== undefined) {
        query.avatar = hasAvatar ? { $exists: true, $ne: '' } : { $exists: false };
      }

      // Date range
      if (dateFrom || dateTo) {
        query.createdAt = {};
        if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
        if (dateTo) query.createdAt.$lte = new Date(dateTo);
      }

      const users = await User.find(query)
        .select('-password -verificationToken -resetPasswordToken')
        .sort({ createdAt: -1 })
        .limit(50); // Limit search results

      return { users, count: users.length };
    } catch (error) {
      logger.error('UserService - Search users error:', error);
      throw error;
    }
  }

  /**
   * Bulk user actions
   */
  async bulkUserAction(userIds, action, role = null) {
    try {
      let result;

      switch (action) {
        case 'activate':
          result = await User.updateMany(
            { _id: { $in: userIds } },
            { isActive: true }
          );
          break;

        case 'deactivate':
          result = await User.updateMany(
            { _id: { $in: userIds } },
            { isActive: false }
          );
          break;

        case 'delete':
          result = await User.deleteMany({ _id: { $in: userIds } });
          break;

        case 'assign-role':
          if (!role) {
            throw new Error('Role is required for assign-role action');
          }
          result = await User.updateMany(
            { _id: { $in: userIds } },
            { role }
          );
          break;

        default:
          throw new Error('Invalid bulk action');
      }

      return {
        action,
        affectedCount: result.modifiedCount || result.deletedCount,
        totalSelected: userIds.length
      };
    } catch (error) {
      logger.error('UserService - Bulk user action error:', error);
      throw error;
    }
  }

  /**
  * Export users data
  */
  async exportUsers(options = {}) {
    try {
      const {
        format = 'csv',
        fields = ['id', 'email', 'firstName', 'lastName', 'role', 'createdAt'],
        dateFrom,
        dateTo
      } = options;

      // Build query for date range
      const query = {};
      if (dateFrom || dateTo) {
        query.createdAt = {};
        if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
        if (dateTo) query.createdAt.$lte = new Date(dateTo);
      }

      const users = await User.find(query).select(fields.join(' '));

      let data;
      let contentType;
      let filename;

      switch (format) {
        case 'csv':
          data = this.convertToCSV(users, fields);
          contentType = 'text/csv';
          filename = `users-export-${Date.now()}.csv`;
          break;

        case 'json':
          data = JSON.stringify(users, null, 2);
          contentType = 'application/json';
          filename = `users-export-${Date.now()}.json`;
          break;

        case 'xlsx':
          // For XLSX, you would need a library like 'xlsx'
          data = this.convertToXLSX(users, fields);
          contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          filename = `users-export-${Date.now()}.xlsx`;
          break;

        default:
          throw new Error('Unsupported export format');
      }

      return { data, contentType, filename };
    } catch (error) {
      logger.error('UserService - Export users error:', error);
      throw error;
    }
  }

  /**
   * Get user statistics (admin only)
   */
  async getUserStats() {
    try {
      const [
        totalUsers,
        activeUsers,
        verifiedUsers,
        usersToday,
        usersThisWeek,
        usersByRole
      ] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ isActive: true }),
        User.countDocuments({ isVerified: true }),
        User.countDocuments({
          createdAt: { $gte: new Date().setHours(0, 0, 0, 0) }
        }),
        User.countDocuments({
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        }),
        User.aggregate([
          { $group: { _id: '$role', count: { $sum: 1 } } }
        ])
      ]);

      return {
        totalUsers,
        activeUsers,
        verifiedUsers,
        usersToday,
        usersThisWeek,
        usersByRole: usersByRole.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {})
      };
    } catch (error) {
      logger.error('UserService - Get user stats error:', error);
      throw error;
    }
  }

  /**
  * Convert users data to CSV
  */
  convertToCSV(users, fields) {
    if (users.length === 0) return '';

    const headers = fields.join(',');
    const rows = users.map(user => {
      return fields.map(field => {
        let value = user[field];

        // Handle nested fields and dates
        if (value instanceof Date) {
          value = value.toISOString();
        } else if (typeof value === 'object') {
          value = JSON.stringify(value);
        }

        // Escape commas and quotes
        value = String(value || '').replace(/"/g, '""');
        return `"${value}"`;
      }).join(',');
    });

    return [headers, ...rows].join('\n');
  }

  /**
   * Convert users data to XLSX (placeholder)
   */
  convertToXLSX(users, fields) {
    // This would require the 'xlsx' package
    // For now, return CSV data as fallback
    logger.warn('XLSX export not implemented, falling back to CSV');
    return this.convertToCSV(users, fields);
  }

  async getUserActivity(userId, options = {}) {
    try {
      const {
        page = 1,
        limit = 50,
        action,
        severity,
        status,
        dateFrom,
        dateTo,
        search
      } = options;

      const result = await activityService.getUserActivities(userId, {
        page,
        limit,
        action,
        severity,
        status,
        dateFrom,
        dateTo,
        search
      });

      return result;
    } catch (error) {
      logger.error('UserService - Get user activity error:', error);
      throw error;
    }
  }

  /**
   * Get user activity statistics
   */
  async getUserActivityStats(userId, days = 30) {
    try {
      return await activityService.getActivityStats(userId, days);
    } catch (error) {
      logger.error('UserService - Get user activity stats error:', error);
      throw error;
    }
  }

  /**
   * Get user security activities
   */
  async getUserSecurityActivities(userId, limit = 50) {
    try {
      return await activityService.getSecurityActivities(userId, limit);
    } catch (error) {
      logger.error('UserService - Get user security activities error:', error);
      throw error;
    }
  }

  /**
   * Export user activities
   */
  async exportUserActivities(userId, options = {}) {
    try {
      return await activityService.exportActivities(userId, options);
    } catch (error) {
      logger.error('UserService - Export user activities error:', error);
      throw error;
    }
  }

}

module.exports = new UserService();