import { prisma } from '../src/app';

async function testDatabaseConnection() {
  console.log('🔍 Testing database connection...');
  console.log('📊 DATABASE_URL:', process.env.DATABASE_URL?.replace(/:[^:]*@/, ':****@'));

  try {
    // Test connection
    await prisma.$connect();
    console.log('✅ Connected successfully!');

    // Test query
    const result = await prisma.$queryRaw`SELECT NOW() as time`;
    console.log('✅ Current time:', result);

    // List tables
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    console.log('📊 Tables:', tables);

    console.log('\n✅ Database is ready!');
  } catch (error: any) {
    console.error('❌ Connection failed:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testDatabaseConnection();