const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define log formats
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;

    if (stack) {
      log += `\n${stack}`;
    }

    if (Object.keys(meta).length > 0) {
      log += `\n${JSON.stringify(meta, null, 2)}`;
    }

    return log;
  })
);

// Define log levels
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
  audit: 5
};

// Define log colors
const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
  audit: 'cyan'
};

winston.addColors(logColors);

// Create the main logger
const logger = winston.createLogger({
  levels: logLevels,
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: {
    service: 'sendrey-server',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    // Console transport (for development)
    new winston.transports.Console({
      format: consoleFormat,
      level: process.env.LOG_LEVEL || 'debug'
    }),

    // File transport for all logs
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      level: 'info',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),

    // File transport for errors only
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),

    // File transport for HTTP requests
    new winston.transports.File({
      filename: path.join(logsDir, 'http.log'),
      level: 'http',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),

    // File transport for audit logs
    new winston.transports.File({
      filename: path.join(logsDir, 'audit.log'),
      level: 'audit',
      maxsize: 5242880, // 5MB
      maxFiles: 10,
    })
  ],

  // Handle exceptions and rejections
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log')
    })
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log')
    })
  ],

  // Exit on error set to false to prevent process exit
  exitOnError: false
});

// If we're in production, remove console transport
if (process.env.NODE_ENV === 'production') {
  logger.remove(winston.transports.Console);

  // Add more robust transports for production
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    level: 'info'
  }));
}

// Custom logger methods with additional functionality
class Logger {
  /**
   * Log error with context
   */
  static error(message, error = null, context = {}) {
    const logData = {
      ...context,
      ...(error && {
        errorMessage: error.message,
        errorStack: error.stack,
        errorCode: error.code
      })
    };

    logger.error(message, logData);
  }

  /**
   * Log warning with context
   */
  static warn(message, context = {}) {
    logger.warn(message, context);
  }

  /**
   * Log info with context
   */
  static info(message, context = {}) {
    logger.info(message, context);
  }

  /**
   * Log debug information
   */
  static debug(message, context = {}) {
    logger.debug(message, context);
  }

  /**
   * Log HTTP requests
   */
  static http(message, context = {}) {
    logger.http(message, context);
  }

  /**
   * Log audit events (security, user actions, etc.)
   */
  static audit(event, context = {}) {
    const auditContext = {
      ...context,
      timestamp: new Date().toISOString(),
      userId: context.userId || 'system',
      ip: context.ip || 'unknown',
      userAgent: context.userAgent || 'unknown'
    };

    logger.log('audit', event, auditContext);
  }

  /**
   * Log database operations
   */
  static database(operation, collection, context = {}) {
    logger.info(`DB ${operation} on ${collection}`, {
      type: 'database',
      operation,
      collection,
      ...context
    });
  }

  /**
   * Log API requests
   */
  static apiRequest(method, url, statusCode, responseTime, context = {}) {
    logger.http(`${method} ${url} ${statusCode} ${responseTime}ms`, {
      type: 'api',
      method,
      url,
      statusCode,
      responseTime,
      ...context
    });
  }

  /**
   * Log authentication events
   */
  static auth(action, userId, context = {}) {
    logger.info(`Auth ${action} for user ${userId}`, {
      type: 'auth',
      action,
      userId,
      ...context
    });
  }

  /**
   * Log email events
   */
  static email(action, recipient, context = {}) {
    logger.info(`Email ${action} to ${recipient}`, {
      type: 'email',
      action,
      recipient,
      ...context
    });
  }

  /**
   * Log SMS events
   */
  static sms(action, recipient, context = {}) {
    logger.info(`SMS ${action} to ${recipient}`, {
      type: 'sms',
      action,
      recipient,
      ...context
    });
  }

  /**
   * Log startup information
   */
  static startup(service, context = {}) {
    logger.info(`${service} started successfully`, {
      type: 'startup',
      service,
      ...context
    });
  }

  /**
   * Log shutdown information
   */
  static shutdown(service, context = {}) {
    logger.info(`${service} shutting down`, {
      type: 'shutdown',
      service,
      ...context
    });
  }

  /**
   * Log performance metrics
   */
  static performance(operation, duration, context = {}) {
    logger.info(`Performance: ${operation} took ${duration}ms`, {
      type: 'performance',
      operation,
      duration,
      ...context
    });
  }

  /**
   * Create a child logger with additional context
   */
  static child(context) {
    return logger.child(context);
  }

  /**
   * Get logger streams for morgan (HTTP logging)
   */
  static getMorganStream() {
    return {
      write: (message) => {
        logger.http(message.trim());
      }
    };
  }

  /**
   * Log uncaught exceptions
   */
  static logUncaughtException(error) {
    logger.error('Uncaught Exception', {
      errorMessage: error.message,
      errorStack: error.stack,
      type: 'uncaughtException'
    });
  }

  /**
   * Log unhandled promise rejections
   */
  static logUnhandledRejection(reason, promise) {
    logger.error('Unhandled Promise Rejection', {
      reason: reason?.message || reason,
      stack: reason?.stack,
      promise: promise.toString(),
      type: 'unhandledRejection'
    });
  }

  /**
   * Log memory usage
   */
  static logMemoryUsage() {
    const memoryUsage = process.memoryUsage();
    logger.debug('Memory Usage', {
      type: 'memory',
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
      external: `${Math.round(memoryUsage.external / 1024 / 1024)} MB`
    });
  }

  /**
   * Log database connection events
   */
  static databaseConnection(action, context = {}) {
    logger.info(`Database ${action}`, {
      type: 'database-connection',
      action,
      ...context
    });
  }

  /**
   * Log cache operations
   */
  static cache(operation, key, context = {}) {
    logger.debug(`Cache ${operation}: ${key}`, {
      type: 'cache',
      operation,
      key,
      ...context
    });
  }

  /**
   * Log file operations
   */
  static file(operation, filename, context = {}) {
    logger.info(`File ${operation}: ${filename}`, {
      type: 'file',
      operation,
      filename,
      ...context
    });
  }

  /**
   * Log job/queue operations
   */
  static job(operation, jobId, context = {}) {
    logger.info(`Job ${operation}: ${jobId}`, {
      type: 'job',
      operation,
      jobId,
      ...context
    });
  }

  /**
   * Log validation errors
   */
  static validation(entity, errors, context = {}) {
    logger.warn(`Validation failed for ${entity}`, {
      type: 'validation',
      entity,
      errors,
      ...context
    });
  }

  /**
   * Get logger instance (for direct winston access if needed)
   */
  static getLogger() {
    return logger;
  }
}

// Handle uncaught exceptions and unhandled rejections
process.on('uncaughtException', (error) => {
  Logger.logUncaughtException(error);
  // In production, you might want to exit here
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  Logger.logUnhandledRejection(reason, promise);
});

// Log startup
Logger.startup('Logger Service', {
  logLevel: process.env.LOG_LEVEL || 'info',
  environment: process.env.NODE_ENV || 'development',
  nodeVersion: process.version
});

module.exports = Logger;