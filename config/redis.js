// config/redis.js
const Redis = require('ioredis');

const redisConfig = {
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD,
  db: process.env.REDIS_DB,
  tls: undefined,
  retryStrategy: (times) => {
    // Exponential backoff
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
};

class RedisClient {
  constructor() {
    this.client = null;
    this.subscriber = null;
    this.isConnected = false;
  }


  async connect() {
    // console.log('Connecting to Redis:', {
    //   host: process.env.REDIS_HOST,
    //   port: process.env.REDIS_PORT,
    //   hasPassword: !!process.env.REDIS_PASSWORD,
    // });

    if (this.client) return this.client;
    if (this._connecting) return this._connecting;

    this._connecting = (async () => {
      try {
        this.client = new Redis(redisConfig);
        this.subscriber = new Redis(redisConfig);

        // Handle connection events
        this.client.on('connect', () => {
          console.log('✅ Redis connected');
          this.isConnected = true;
        });

        this.client.on('error', (err) => {
          console.error('❌ Redis error:', err);
          this.isConnected = false;
        });

        this.client.on('close', () => {
          console.warn('⚠️ Redis connection closed');
          this.isConnected = false;
        });

        // Wait for ready state
        await new Promise((resolve, reject) => {
          this.client.once('ready', resolve);
          this.client.once('error', reject);
        });

        // console.log("redis connected")
        return this.client;
      } catch (error) {
        console.error('Failed to connect to Redis:', error.message);
        this.client = null;
        this.subscriber = null;
        throw error;
      }
    }
    ) ();
  }

  getClient() {
    if (!this.client) {
      throw new Error('Redis not connected. Call connect() first.');
    }
    return this.client;
  }

  getSubscriber() {
    if (!this.subscriber) {
      throw new Error('Redis subscriber not connected. Call connect() first.');
    }
    return this.subscriber;
  }

  async disconnect() {
    if (this.client) {
      await this.client.quit();
      this.client = null;
    }
    if (this.subscriber) {
      await this.subscriber.quit();
      this.subscriber = null;
    }
    this.isConnected = false;
    console.warn('Redis disconnected');
  }
}

module.exports = new RedisClient();