import { prisma } from '../app';

// Global setup
beforeAll(async () => {
  console.log('🧪 Starting tests...');
});

// Clean up after each test
afterEach(async () => {
  // Clean up database tables (keep order by dependencies)
  await prisma.$transaction([
    prisma.auditEvent.deleteMany(),
    prisma.attachment.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.workflowItem.deleteMany(),
    prisma.workflowTemplate.deleteMany(),
    prisma.user.deleteMany(),
  ]);
});

// Global teardown
afterAll(async () => {
  await prisma.$disconnect();
  console.log('🧪 Tests completed');
});