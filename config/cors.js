  // config/cors.js
const allowedOrigins = [
  // Local dev
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://172.20.10.3:3000',
  'http://127.0.0.1:3002',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:4000',
  'http://localhost:4001',

  // Production
  'https://sendrey-server-za1t.onrender.com', // api
  'https://sendrey-server-1.onrender.com', // socket
  'https://sendrey.netlify.app',
  'https://sendrey-backoffice.vercel.app',
];



const corsOptions = {
  origin: function (origin, callback) {
    // console.log('Incoming request origin:', origin);
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-Admin-Role'
  ],
  exposedHeaders: ['Content-Type', 'Content-Length'],
  credentials: true,
  optionsSuccessStatus: 200 // Some legacy browsers choke on 204
};

module.exports = corsOptions;
