
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
const { startExpenseReportJobs } = require('./jobs/expenseReports');
const dedupe = require('./middleware/dedupe');

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

  if (process.env.NODE_ENV === 'production') {
    console.log = () => { };
    console.error = () => { };
    console.warn = () => { };
    console.debug = () => { };
  }

  try {

    // 1. Await the database connection first
    await connectDb();
    console.log(' Database connected');

    // restore any scheduled cron jobs that were active before the server restarted
    await startExpenseReportJobs();

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
    
    // webhooks
    app.use('/payments/webhook', express.raw({ type: 'application/json' }));

    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true }));

    app.use(dedupe(3000, {
      skip: [
        '/kyc/verify',
        '/business/reports/generate',
        '/business/reports',        // covers /reports/:id/export/csv and /pdf
      ]
    }));

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
      console.error(' Kafka consumers failed to start - continuing without Kafka:', kafkaError.message);
      // Don't exit - continue running without Kafka
    }

    // ping socket every 5 mins
    if (process.env.NODE_ENV === 'production') {
      setInterval(async () => {
        try {
          const url = process.env.SOCKET_SERVER_URL || 'https://sendrey-server-socket.onrender.com';
          await fetch(`${url}/health`);
          console.log('[keep-alive] pinged');
        } catch (e) {
          console.error('[keep-alive] ping failed:', e.message);
        }
      }, 5 * 60 * 1000); // every 5 minutes
    }

    // start redis
    // try {
    //   await redis.connect();
    //   locationCleanup.start();
    // } catch (err) {
    //   console.error('Redis unavailable — skipping location cleanup:', err.message);

    // }

    // 3. Routes
    app.use('/api/v1', routes);

    // admin routes
    app.use('/api/v1/admin', adminRoutes)

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
   // await redis.disconnect();
    process.exit(0);
  });
};

startServer();
module.exports = app;