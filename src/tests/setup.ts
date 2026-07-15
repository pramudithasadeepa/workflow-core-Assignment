import { prisma } from '../app';
import { redisClient } from '../config/redis.config';
import { closeQueue } from '../queues/notification.queue';

// Use dynamic port for tests to avoid conflicts
process.env.NODE_ENV = 'test';
const testPort = Math.floor(Math.random() * (4000 - 3000 + 1)) + 3000;
process.env.PORT = testPort.toString();

console.log(`🧪 Using test port: ${testPort}`);

// Global setup
beforeAll(async () => {
  console.log('🧪 Starting tests...');
  
  // Ensure database is clean
  await cleanDatabase();
  
  // Clear Redis
  try {
    await redisClient.flushall();
  } catch (error) {
    console.log('⚠️ Redis flush failed, continuing...');
  }
});

// Clean database before each test
beforeEach(async () => {
  await cleanDatabase();
  try {
    await redisClient.flushall();
  } catch (error) {
    // Ignore Redis errors in tests
  }
});

// Clean database after each test
afterEach(async () => {
  await cleanDatabase();
});

// Global teardown
afterAll(async () => {
  console.log('🧪 Tests completed');
  
  // Close queue and redis connections
  try {
    await closeQueue();
    await redisClient.quit();
  } catch (error) {
    // Ignore
  }
  await prisma.$disconnect();
  
  // Give time for connections to close
  await new Promise(resolve => setTimeout(resolve, 1000));
});

async function cleanDatabase() {
  // Delete in correct order to avoid foreign key constraints
  await prisma.$transaction([
    prisma.auditEvent.deleteMany(),
    prisma.attachment.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.workflowItem.deleteMany(),
    prisma.workflowTemplate.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}

// Test helpers - Ensure unique emails
export async function createTestUser(role: string = 'ADMIN') {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return prisma.user.create({
    data: {
      email: `test-${timestamp}-${random}@example.com`,
      passwordHash: '$2b$10$hashed_password_for_testing',
      name: `Test User ${role}`,
      role: role as any
    }
  });
}

export async function createTestTemplate(userId: number) {
  return prisma.workflowTemplate.create({
    data: {
      name: `Test Workflow ${Date.now()}`,
      description: 'Test description',
      stages: ['Draft', 'Review', 'Approval', 'Completed'],
      transitions: {
        'Draft': ['Review'],
        'Review': ['Approval', 'Rejected'],
        'Approval': ['Completed', 'Rejected'],
        'Rejected': ['Draft']
      },
      permissions: {
        'Review': ['ADMIN', 'MANAGER'],
        'Approval': ['ADMIN']
      },
      createdById: userId
    }
  });
}

export async function createTestItem(templateId: number, userId: number, stage: string = 'Draft') {
  return prisma.workflowItem.create({
    data: {
      templateId,
      currentStage: stage,
      assignedUsers: [userId],
      title: `Test Item ${Date.now()}`,
      description: 'Test description',
      priority: 'MEDIUM',
      createdById: userId,
      version: 1
    }
  });
}

export function generateTestToken(userId: number) {
  const jwt = require('jsonwebtoken');
  return jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: '1h' });
}