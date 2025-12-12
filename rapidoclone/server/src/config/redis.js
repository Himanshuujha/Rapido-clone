// src/config/redis.js
const Redis = require('ioredis');
const logger = require('../utils/logger');

let redisClient = null;
let redisSubscriber = null;

const createRedisClient = (name = 'default') => {
  const client = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    db: process.env.REDIS_DB || 0,
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: true
  });

  client.on('connect', () => {
    logger.info(`Redis ${name} client connecting...`);
  });

  client.on('ready', () => {
    logger.info(`Redis ${name} client ready`);
  });

  client.on('error', (err) => {
    logger.error(`Redis ${name} client error:`, err.message);
  });

  client.on('close', () => {
    logger.warn(`Redis ${name} client connection closed`);
  });

  client.on('reconnecting', () => {
    logger.info(`Redis ${name} client reconnecting...`);
  });

  return client;
};

const connectRedis = async () => {
  try {
    redisClient = createRedisClient('main');
    await redisClient.connect();
    
    // Test connection
    await redisClient.ping();
    logger.info('Redis connection established');
    
    return redisClient;
  } catch (error) {
    logger.error('Redis connection failed:', error.message);
    throw error;
  }
};

const getClient = () => {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call connectRedis first.');
  }
  return redisClient;
};

const getSubscriber = () => {
  if (!redisSubscriber) {
    redisSubscriber = createRedisClient('subscriber');
    redisSubscriber.connect();
  }
  return redisSubscriber;
};

// Cache helper functions
const cache = {
  async get(key) {
    try {
      const data = await getClient().get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.warn(`Cache get failed for key ${key}:`, error.message);
      return null;
    }
  },

  async set(key, value, ttl = 3600) {
    try {
      await getClient().setex(key, ttl, JSON.stringify(value));
    } catch (error) {
      logger.warn(`Cache set failed for key ${key}:`, error.message);
    }
  },

  async del(key) {
    try {
      await getClient().del(key);
    } catch (error) {
      logger.warn(`Cache del failed for key ${key}:`, error.message);
    }
  },

  async delPattern(pattern) {
    try {
      const keys = await getClient().keys(pattern);
      if (keys.length > 0) {
        await getClient().del(...keys);
      }
    } catch (error) {
      logger.warn(`Cache delPattern failed for pattern ${pattern}:`, error.message);
    }
  },

  async exists(key) {
    try {
      return await getClient().exists(key);
    } catch (error) {
      logger.warn(`Cache exists failed for key ${key}:`, error.message);
      return 0;
    }
  },

  async incr(key) {
    try {
      return await getClient().incr(key);
    } catch (error) {
      logger.warn(`Cache incr failed for key ${key}:`, error.message);
      return 0;
    }
  },

  async expire(key, ttl) {
    try {
      await getClient().expire(key, ttl);
    } catch (error) {
      logger.warn(`Cache expire failed for key ${key}:`, error.message);
    }
  }
};

module.exports = {
  connectRedis,
  getClient,
  getSubscriber,
  cache
};