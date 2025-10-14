const Logger = require('../utils/logger');
const morgan = require('morgan');

// Custom token for response time
morgan.token('response-time-ms', (req, res) => {
  return `${Math.round(parseInt(morgan['response-time'](req, res)))}ms`;
});

// Custom token for user ID
morgan.token('user-id', (req) => {
  return req.user ? req.user._id.toString() : 'anonymous';
});

// Custom token for user email
morgan.token('user-email', (req) => {
  return req.user ? req.user.email : 'anonymous';
});

// Morgan format string
const morganFormat = ':remote-addr - :user-email [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" - :response-time-ms';

// Morgan middleware
const requestLogger = morgan(morganFormat, {
  stream: Logger.getMorganStream(),
  skip: (req) => {
    // Skip health checks and static files in production
    if (process.env.NODE_ENV === 'production') {
      return req.url === '/health' || req.url.includes('.') || req.url === '/favicon.ico';
    }
    return false;
  }
});

// Enhanced request logger middleware
const enhancedRequestLogger = (req, res, next) => {
  const start = Date.now();

  // Log request start
  Logger.http(`Request started: ${req.method} ${req.url}`, {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user ? req.user._id.toString() : 'anonymous',
    userEmail: req.user ? req.user.email : 'anonymous'
  });

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - start;

    Logger.apiRequest(
      req.method,
      req.url,
      res.statusCode,
      duration,
      {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        userId: req.user ? req.user._id.toString() : 'anonymous',
        userEmail: req.user ? req.user.email : 'anonymous',
        contentLength: res.get('Content-Length'),
        referrer: req.get('Referrer') || req.get('Referer')
      }
    );

    // Log slow requests
    if (duration > 1000) { // More than 1 second
      Logger.warn(`Slow request: ${req.method} ${req.url} took ${duration}ms`, {
        method: req.method,
        url: req.url,
        duration,
        threshold: 1000
      });
    }

    // Log client errors
    if (res.statusCode >= 400 && res.statusCode < 500) {
      Logger.warn(`Client error: ${req.method} ${req.url} - ${res.statusCode}`, {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        userId: req.user ? req.user._id.toString() : 'anonymous'
      });
    }

    // Log server errors
    if (res.statusCode >= 500) {
      Logger.error(`Server error: ${req.method} ${req.url} - ${res.statusCode}`, null, {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        userId: req.user ? req.user._id.toString() : 'anonymous',
        ip: req.ip
      });
    }
  });

  next();
};

module.exports = {
  requestLogger,
  enhancedRequestLogger
};