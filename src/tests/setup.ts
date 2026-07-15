import { prisma } from '../app';
import { redisClient } from '../config/redis.config';
import { closeQueue } from '../queues/notification.queue';

// Global setup
beforeAll(async () => {
  console.log('🧪 Starting tests...');
  
  // Ensure database is clean
  await cleanDatabase();
});

// Clean database before each test
beforeEach(async () => {
  await cleanDatabase();
});

// Clean database after each test
afterEach(async () => {
  await cleanDatabase();
});

// Global teardown
afterAll(async () => {
  console.log('🧪 Tests completed');
  await closeQueue();
  await redisClient.quit();
  await prisma.$disconnect();
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

// Test helpers
export async function createTestUser(role: string = 'ADMIN') {
  return prisma.user.create({
    data: {
      email: `test-${Date.now()}@example.com`,
      passwordHash: 'hashed_password',
      name: `Test User ${role}`,
      role: role as any
    }
  });
}

export async function createTestTemplate(userId: number) {
  return prisma.workflowTemplate.create({
    data: {
      name: 'Test Workflow',
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
      title: 'Test Item',
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