const Activity = require('../models/Activity');
const logger = require('../utils/logger');
const geoip = require('geoip-lite'); // You'll need to install this: npm install geoip-lite

class ActivityService {
  /**
   * Log user activity
   */
  async logActivity(activityData) {
    try {
      const {
        userId,
        action,
        description,
        ipAddress,
        userAgent = '',
        metadata = {},
        severity = 'low',
        status = 'success'
      } = activityData;

      // Get location from IP
      const location = this.getLocationFromIP(ipAddress);

      const activity = new Activity({
        userId,
        action,
        description,
        ipAddress,
        userAgent,
        location,
        metadata,
        severity,
        status
      });

      await activity.save();

      logger.info(`Activity logged: ${action} for user ${userId}`);

      return activity;
    } catch (error) {
      logger.error('ActivityService - Log activity error:', error);
      // Don't throw error for activity logging failures
    }
  }

  /**
   * Get location from IP address
   */
  getLocationFromIP(ip) {
    try {
      // Handle local IPs
      if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
        return {
          country: 'Local',
          city: 'Local Network',
          region: 'Local'
        };
      }

      const geo = geoip.lookup(ip);
      if (geo) {
        return {
          country: geo.country,
          city: geo.city,
          region: geo.region
        };
      }

      return {
        country: 'Unknown',
        city: 'Unknown',
        region: 'Unknown'
      };
    } catch (error) {
      logger.error('ActivityService - Get location from IP error:', error);
      return {
        country: 'Unknown',
        city: 'Unknown',
        region: 'Unknown'
      };
    }
  }

  /**
   * Get user activities with pagination
   */
  async getUserActivities(userId, options = {}) {
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

      const skip = (page - 1) * limit;

      // Build query
      const query = { userId };

      if (action) query.action = action;
      if (severity) query.severity = severity;
      if (status) query.status = status;

      // Date range
      if (dateFrom || dateTo) {
        query.createdAt = {};
        if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
        if (dateTo) query.createdAt.$lte = new Date(dateTo);
      }

      // Search in description
      if (search) {
        query.description = { $regex: search, $options: 'i' };
      }

      const [activities, total] = await Promise.all([
        Activity.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Activity.countDocuments(query)
      ]);

      const totalPages = Math.ceil(total / limit);
      const hasNext = page < totalPages;
      const hasPrev = page > 1;

      return {
        activities,
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
      logger.error('ActivityService - Get user activities error:', error);
      throw error;
    }
  }

  /**
   * Get recent user activities (last 24 hours by default)
   */
  async getRecentActivities(userId, hours = 24) {
    try {
      return await Activity.getRecentActivities(userId, hours);
    } catch (error) {
      logger.error('ActivityService - Get recent activities error:', error);
      throw error;
    }
  }

  /**
   * Get security-related activities
   */
  async getSecurityActivities(userId, limit = 50) {
    try {
      return await Activity.getSecurityActivities(userId, limit);
    } catch (error) {
      logger.error('ActivityService - Get security activities error:', error);
      throw error;
    }
  }

  /**
   * Get activities by specific action
   */
  async getActivitiesByAction(userId, action, limit = 50) {
    try {
      return await Activity.getActivitiesByAction(userId, action, limit);
    } catch (error) {
      logger.error('ActivityService - Get activities by action error:', error);
      throw error;
    }
  }

  /**
   * Get activity statistics
   */
  async getActivityStats(userId, days = 30) {
    try {
      const date = new Date();
      date.setDate(date.getDate() - days);

      const stats = await Activity.aggregate([
        {
          $match: {
            userId: mongoose.Types.ObjectId(userId),
            createdAt: { $gte: date }
          }
        },
        {
          $group: {
            _id: '$action',
            count: { $sum: 1 },
            lastActivity: { $max: '$createdAt' }
          }
        },
        {
          $project: {
            action: '$_id',
            count: 1,
            lastActivity: 1,
            _id: 0
          }
        },
        {
          $sort: { count: -1 }
        }
      ]);

      const totalActivities = await Activity.countDocuments({
        userId,
        createdAt: { $gte: date }
      });

      const activitiesByDay = await Activity.aggregate([
        {
          $match: {
            userId: mongoose.Types.ObjectId(userId),
            createdAt: { $gte: date }
          }
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$createdAt'
              }
            },
            count: { $sum: 1 }
          }
        },
        {
          $sort: { _id: 1 }
        }
      ]);

      return {
        totalActivities,
        activityBreakdown: stats,
        dailyActivity: activitiesByDay,
        period: `${days} days`
      };
    } catch (error) {
      logger.error('ActivityService - Get activity stats error:', error);
      throw error;
    }
  }

  /**
   * Get suspicious activities
   */
  async getSuspiciousActivities(userId, limit = 20) {
    try {
      const suspiciousActivities = await Activity.find({
        userId,
        $or: [
          { severity: { $in: ['high', 'critical'] } },
          { status: 'failed' },
          {
            action: {
              $in: [
                'login',
                'password_reset_request',
                'password_change',
                'email_change'
              ]
            },
            status: 'failed'
          }
        ]
      })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      return suspiciousActivities;
    } catch (error) {
      logger.error('ActivityService - Get suspicious activities error:', error);
      throw error;
    }
  }

  /**
   * Clean up old activities
   */
  async cleanupOldActivities(days = 90) {
    try {
      const result = await Activity.cleanupOldActivities(days);
      logger.info(`Cleaned up activities older than ${days} days. Removed: ${result.deletedCount}`);
      return result;
    } catch (error) {
      logger.error('ActivityService - Cleanup old activities error:', error);
      throw error;
    }
  }

  /**
   * Export activities to CSV
   */
  async exportActivities(userId, options = {}) {
    try {
      const { dateFrom, dateTo } = options;

      const query = { userId };
      if (dateFrom || dateTo) {
        query.createdAt = {};
        if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
        if (dateTo) query.createdAt.$lte = new Date(dateTo);
      }

      const activities = await Activity.find(query)
        .sort({ createdAt: -1 })
        .lean();

      // Convert to CSV
      const headers = ['Date', 'Action', 'Description', 'IP Address', 'Location', 'Status', 'Severity'];
      const rows = activities.map(activity => [
        new Date(activity.createdAt).toISOString(),
        activity.action,
        activity.description,
        activity.ipAddress,
        `${activity.location?.city || ''}, ${activity.location?.country || ''}`.trim(),
        activity.status,
        activity.severity
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(field => `"${String(field || '').replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      return {
        data: csvContent,
        contentType: 'text/csv',
        filename: `user-activities-${userId}-${Date.now()}.csv`,
        count: activities.length
      };
    } catch (error) {
      logger.error('ActivityService - Export activities error:', error);
      throw error;
    }
  }
}

module.exports = new ActivityService();