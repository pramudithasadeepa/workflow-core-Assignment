import { prisma } from '../../app';
import { processPendingNotifications, enqueueNotification } from '../../queues/notification.queue';
import { createTestUser, createTestTemplate, createTestItem } from '../setup';

describe('Notification Queue Tests', () => {
  let userId: number;

  beforeEach(async () => {
    const user = await createTestUser();
    userId = user.id;
  });

  describe('enqueueNotification', () => {
    it('should create notification in database and queue', async () => {
      const template = await createTestTemplate(userId);
      const item = await createTestItem(template.id, userId);

      const notification = await enqueueNotification(
        item.id,
        userId,
        'TEST_EVENT',
        { message: 'Test notification' }
      );

      expect(notification.id).toBeDefined();
      expect(notification.status).toBe('PENDING');

      // Check database
      const saved = await prisma.notification.findUnique({
        where: { id: notification.id }
      });
      expect(saved).toBeDefined();
      expect(saved?.status).toBe('PENDING');
    });
  });

  describe('processPendingNotifications', () => {
    it('should process pending notifications', async () => {
      const template = await createTestTemplate(userId);
      const item = await createTestItem(template.id, userId);

      // Create pending notifications
      await Promise.all([
        enqueueNotification(item.id, userId, 'EVENT_1', { message: 'Test 1' }),
        enqueueNotification(item.id, userId, 'EVENT_2', { message: 'Test 2' }),
        enqueueNotification(item.id, userId, 'EVENT_3', { message: 'Test 3' })
      ]);

      // Process pending
      const count = await processPendingNotifications();

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check status
      const notifications = await prisma.notification.findMany({
        where: { workflowItemId: item.id }
      });

      const completed = notifications.filter(n => n.status === 'COMPLETED');
      expect(completed.length).toBeGreaterThan(0);
    });
  });
});