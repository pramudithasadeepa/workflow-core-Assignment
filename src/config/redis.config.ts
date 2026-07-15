import Redis from 'ioredis';

// Create Redis connection with proper config
export const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy: (times: number) => {
    if (times > 3) {
      console.log('❌ Redis connection failed after 3 retries');
      return null;
    }
    return Math.min(times * 50, 2000);
  }
};

// Create Redis client for direct operations
export const redisClient = new Redis(redisConnection);

redisClient.on('connect', () => {
  console.log('✅ Redis connected successfully');
});

redisClient.on('error', (error) => {
  console.error('❌ Redis connection error:', error.message);
});

export default redisClient;