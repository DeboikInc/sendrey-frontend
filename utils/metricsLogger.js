const Metric = require('../models/Metric');

/**
 * Log a metric event
 */
const logMetric = async ({ type, status, latency = null, chatId = null, userId = null, userType = null, error = null, metadata = null }) => {
  try {
    await Metric.create({
      type,
      status,
      latency,
      chatId,
      userId,
      userType,
      error,
      metadata,
      timestamp: new Date()
    });
  } catch (err) {
    // Don't let metric logging break the app
    console.error(' Failed to log metric:', err.message);
  }
};

/**
 * Get metrics summary for a time period
 */
const getMetricsSummary = async (hours = 24) => {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  try {
    // Total messages
    const totalMessages = await Metric.countDocuments({
      type: 'message',
      timestamp: { $gte: since }
    });

    // Successful messages
    const successfulMessages = await Metric.countDocuments({
      type: 'message',
      status: 'success',
      timestamp: { $gte: since }
    });

    // Failed messages
    const failedMessages = await Metric.countDocuments({
      type: 'message',
      status: 'failed',
      timestamp: { $gte: since }
    });

    // Average message latency
    const latencyStats = await Metric.aggregate([
      {
        $match: {
          type: 'message',
          status: 'success',
          latency: { $ne: null },
          timestamp: { $gte: since }
        }
      },
      {
        $group: {
          _id: null,
          avgLatency: { $avg: '$latency' },
          minLatency: { $min: '$latency' },
          maxLatency: { $max: '$latency' }
        }
      }
    ]);

    // Status updates
    const totalStatusUpdates = await Metric.countDocuments({
      type: 'status_update',
      timestamp: { $gte: since }
    });

    const successfulStatusUpdates = await Metric.countDocuments({
      type: 'status_update',
      status: 'success',
      timestamp: { $gte: since }
    });

    // File uploads
    const totalFileUploads = await Metric.countDocuments({
      type: 'file_upload',
      timestamp: { $gte: since }
    });

    const successfulFileUploads = await Metric.countDocuments({
      type: 'file_upload',
      status: 'success',
      timestamp: { $gte: since }
    });

    // Calls
    const totalCalls = await Metric.countDocuments({
      type: 'call',
      timestamp: { $gte: since }
    });

    const successfulCalls = await Metric.countDocuments({
      type: 'call',
      status: 'success',
      timestamp: { $gte: since }
    });

    // Socket errors
    const socketErrors = await Metric.countDocuments({
      type: 'socket_error',
      timestamp: { $gte: since }
    });

    // Calculate rates
    const messageDeliveryRate = totalMessages > 0 
      ? ((successfulMessages / totalMessages) * 100).toFixed(2)
      : 100;

    const statusUpdateRate = totalStatusUpdates > 0
      ? ((successfulStatusUpdates / totalStatusUpdates) * 100).toFixed(2)
      : 100;

    const fileUploadRate = totalFileUploads > 0
      ? ((successfulFileUploads / totalFileUploads) * 100).toFixed(2)
      : 100;

    const callSuccessRate = totalCalls > 0
      ? ((successfulCalls / totalCalls) * 100).toFixed(2)
      : 100;

    return {
      period: `Last ${hours} hours`,
      messages: {
        total: totalMessages,
        successful: successfulMessages,
        failed: failedMessages,
        deliveryRate: `${messageDeliveryRate}%`,
        avgLatency: latencyStats[0]?.avgLatency ? `${Math.round(latencyStats[0].avgLatency)}ms` : 'N/A',
        minLatency: latencyStats[0]?.minLatency ? `${Math.round(latencyStats[0].minLatency)}ms` : 'N/A',
        maxLatency: latencyStats[0]?.maxLatency ? `${Math.round(latencyStats[0].maxLatency)}ms` : 'N/A',
      },
      statusUpdates: {
        total: totalStatusUpdates,
        successful: successfulStatusUpdates,
        failed: totalStatusUpdates - successfulStatusUpdates,
        complianceRate: `${statusUpdateRate}%`
      },
      fileUploads: {
        total: totalFileUploads,
        successful: successfulFileUploads,
        failed: totalFileUploads - successfulFileUploads,
        successRate: `${fileUploadRate}%`
      },
      calls: {
        total: totalCalls,
        successful: successfulCalls,
        failed: totalCalls - successfulCalls,
        successRate: `${callSuccessRate}%`
      },
      socketErrors: socketErrors,
      timestamp: new Date()
    };
  } catch (error) {
    console.error('Error getting metrics summary:', error);
    throw error;
  }
};

/**
 * Check if metrics are healthy and trigger alerts if needed
 */
const checkMetricsHealth = async () => {
  const summary = await getMetricsSummary(1); // Last hour

  const alerts = [];

  // Alert if message delivery rate < 95%
  const deliveryRate = parseFloat(summary.messages.deliveryRate);
  if (deliveryRate < 95) {
    alerts.push({
      level: 'critical',
      type: 'message_delivery',
      message: `Message delivery rate is ${deliveryRate}% (below 95% threshold)`,
      value: deliveryRate
    });
  }

  // Alert if average latency > 2000ms
  const avgLatency = parseInt(summary.messages.avgLatency);
  if (!isNaN(avgLatency) && avgLatency > 2000) {
    alerts.push({
      level: 'warning',
      type: 'message_latency',
      message: `Average message latency is ${avgLatency}ms (above 2000ms threshold)`,
      value: avgLatency
    });
  }

  // Alert if socket errors > 10
  if (summary.socketErrors > 10) {
    alerts.push({
      level: 'critical',
      type: 'socket_errors',
      message: `${summary.socketErrors} socket errors in the last hour`,
      value: summary.socketErrors
    });
  }

  // Alert if status update compliance < 90%
  const statusRate = parseFloat(summary.statusUpdates.complianceRate);
  if (statusRate < 90 && summary.statusUpdates.total > 0) {
    alerts.push({
      level: 'warning',
      type: 'status_compliance',
      message: `Status update compliance is ${statusRate}% (below 90% threshold)`,
      value: statusRate
    });
  }

  return {
    healthy: alerts.length === 0,
    alerts,
    summary
  };
};

module.exports = {
  logMetric,
  getMetricsSummary,
  checkMetricsHealth
};