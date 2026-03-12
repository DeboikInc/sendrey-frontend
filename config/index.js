require('dotenv').config();

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 3000,

  database: {
    url: process.env.DATABASE_URL,
    
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  },

  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshTokenExpiresIn: process.env.JWT_REFRESH_TOKEN_EXPIRES_IN
  },

  auth: {
    requireEmailVerification: process.env.REQUIRE_EMAIL_VERIFICATION === 'true',
    requirePhoneVerification: process.env.REQUIRE_PHONE_VERIFICATION === 'false',
  },

  // Rate limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    userMax: 1000, // limit each user to 1000 requests per windowMs
    skipSuccessfulRequests: false
  },

  email: {
    elastic: {
      apiKey: process.env.ELASTIC_EMAIL_API_KEY,
      from: process.env.ELASTIC_EMAIL_FROM,
      fromName: process.env.ELASTIC_EMAIL_FROM_NAME
    }
  },

  sms: {
    provider: 'twilio', // 
    twilio: {
      accountSid: process.env.TWILIO_ACCOUNT_SID,
      authToken: process.env.TWILIO_AUTH_TOKEN,
      fromNumber: process.env.TWILIO_FROM_NUMBER
    }
  },

  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization', 'X-API-Key']
  }
};