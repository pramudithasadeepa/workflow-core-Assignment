import { redisClient } from '../src/config/redis.config';

async function testRedisConnection() {
  console.log('\n🔍 Testing Redis Connection...');
  console.log('==================================');

  try {
    const ping = await redisClient.ping();
    console.log(`✅ Redis connected: ${ping}`);

    // Set a test value
    await redisClient.set('test-key', 'Hello, Redis!');
    const value = await redisClient.get('test-key');
    console.log(`✅ Test value: ${value}`);

    // Delete test value
    await redisClient.del('test-key');

    // Get Redis info
    const info = await redisClient.info();
    const version = info.split('\n').find(line => line.startsWith('redis_version'));
    console.log(`📊 Redis version: ${version}`);

    console.log('\n✅ Redis is ready for use!');
    console.log('==================================\n');
  } catch (error: any) {
    console.error('❌ Redis connection failed:', error.message);
    console.error('💡 Make sure Redis is running on localhost:6379');
    process.exit(1);
  } finally {
    await redisClient.quit();
  }
}

testRedisConnection();