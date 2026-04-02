  // config/cors.js
  const allowedOrigins =['http://localhost:3000', 'http://127.0.0.1:3000', 'https://sendrey-frontend-three.vercel.app', 'http://172.20.10.3:3000', 'http://localhost:3001', 'http://127.0.0.1:3001', 'http://127.0.0.1:3001']
// const allowedOrigins =['https://sendrey-server-api.onrender.com', 'https://sendrey-server-socket.onrender.com', 'https://sendrey-frontend-three.vercel.app', 'https://sendrey-backoffice.vercel.app']



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
    'Authorization'
  ],
  exposedHeaders: ['Content-Type', 'Content-Length'],
  credentials: true,
  optionsSuccessStatus: 200 // Some legacy browsers choke on 204
};

module.exports = corsOptions;
