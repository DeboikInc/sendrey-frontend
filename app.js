
// app.js
const dns = require('node:dns/promises');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const corsOptions = require('./config/cors');

const config = require('./config');

const routes = require('./routes');
const adminRoutes = require('./routes/admin')

const { errorHandler, notFound } = require('./middleware/errorHandler');
const { requestLogger, enhancedRequestLogger } = require('./middleware/logger');
const { startAllConsumers } = require('./kafka/consumers');
const { restoreAllScheduledJobs } = require('./jobs/scheduledConversations');
const { startExpenseReportJobs } = require('./jobs/expenseReports');

const cron = require('node-cron');
const { archiveOldOrders } = require('./services/orderStateMachine');

const app = express();
const path = require('path');
const { startPlatformSettlementCron } = require('./cron/platformSettlementCron');
const { startDailyResetJob } = require('./utils/dailyResetJob');

const redis = require('./config/redis');
const locationCleanup = require('./services/locationTracking/locationCleanup');


// Database connection
const connectDb = require('./config/database');
const startServer = async () => {
  try {

    // 1. Await the database connection first
    await connectDb();
    console.log(' Database connected');

    // restore any scheduled cron jobs that were active before the server restarted
    await restoreAllScheduledJobs();
    startExpenseReportJobs();
    // 2. Middlewares
    app.use(helmet(
      {
        crossOriginResourcePolicy: { policy: "cross-origin" },
        crossOriginEmbedderPolicy: false,
      }
    ));
    app.use(cors(corsOptions));
    app.options('*', cors(corsOptions));
    app.use(compression());

    // ... (rest of your app.use calls)
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true }));
    app.use(requestLogger);
    app.use(enhancedRequestLogger);

    app.use('/uploads', (req, res, next) => {
      res.header('Cross-Origin-Resource-Policy', 'cross-origin');
      next();
    }, express.static(path.join(__dirname, 'uploads')));

    // Start all Kafka consumers
    try {
      console.log('Starting Kafka consumers...');
      await startAllConsumers();
      console.log(' Kafka consumers started');
    } catch (kafkaError) {
      console.error('⚠️ Kafka consumers failed to start - continuing without Kafka:', kafkaError.message);
      // Don't exit - continue running without Kafka
    }

    // start redis
    await redis.connect();
    locationCleanup.start(); // Start cleanup service

    // 3. Routes
    app.use('/api/v1', routes);

    // admin routes
    app.use('/api/admin/v1', adminRoutes)

    app.get('/health', (req, res) => {
      res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
    });

    app.get('/', (req, res) => {
      res.status(200).json({
        message: "Welcome to Sendrey API",
        status: "active",
        environment: process.env.NODE_ENV
      });
    });

    // cron job to 
    cron.schedule('0 0 * * *', async () => {
      console.log('Running daily archive job...');
      await archiveOldOrders();
    });

    startDailyResetJob();

    startPlatformSettlementCron();

    app.use(notFound);
    app.use(errorHandler);

    // 4. Start listening only after DB is ready
    const PORT = process.env.PORT || 4000;
    app.listen(PORT, () => {
      console.log(`✅ Server is running on ${PORT}`);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    locationCleanup.stop();
    await redis.disconnect();
    process.exit(0);
  });
};

startServer();
module.exports = app;