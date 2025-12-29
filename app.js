
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
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { requestLogger, enhancedRequestLogger } = require('./middleware/logger');

const app = express();


// Database connection
const connectDb = require('./config/database');
const startServer = async () => {
  try {

    // 1. Await the database connection first
    await connectDb();
    console.log(' Database connected');

    // 2. Middlewares
    app.use(helmet());
    app.use(cors(corsOptions));
    app.options('*', cors(corsOptions));
    app.use(compression());

    // ... (rest of your app.use calls)
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true }));
    app.use(requestLogger);
    app.use(enhancedRequestLogger);

    // 3. Routes
    app.use('/api/v1', routes);

    app.get('/health', (req, res) => {
      res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
    });

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
};

startServer();
module.exports = app;