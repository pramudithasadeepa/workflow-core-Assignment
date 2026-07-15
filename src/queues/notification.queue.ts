import { Queue, Worker, Job } from 'bullmq';
import { redisConnection } from '../config/redis.config';
import { prisma } from '../app';

// Create notification queue
export const notificationQueue = new Queue('notifications', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 1000
    },
    removeOnComplete: true,
    removeOnFail: false
  }
});

// Create worker to process notifications
export const notificationWorker = new Worker(
  'notifications',
  async (job: Job) => {
    const { notificationId } = job.data;

    try {
      console.log(`📨 Processing notification ${notificationId}...`);

      // First check if notification exists
      const existingNotification = await prisma.notification.findUnique({
        where: { id: notificationId }
      });

      if (!existingNotification) {
        console.log(`⚠️ Notification ${notificationId} not found, skipping...`);
        return { success: false, error: 'Notification not found' };
      }

      // Mark as processing
      const notification = await prisma.notification.update({
        where: { id: notificationId },
        data: { 
          status: 'PROCESSING'
        }
      });

      console.log(`📧 [Notification] Sending to user ${notification.recipientId}:`, notification.payload);

      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 500));

      // Mark as completed
      await prisma.notification.update({
        where: { id: notificationId },
        data: {
          status: 'COMPLETED',
          processedAt: new Date()
        }
      });

      console.log(`✅ Notification ${notificationId} processed successfully`);
      return { success: true, notificationId };

    } catch (error: any) {
      console.error(`❌ Failed to process notification ${notificationId}:`, error.message);

      // Check if notification still exists before updating
      const exists = await prisma.notification.findUnique({
        where: { id: notificationId }
      });

      if (exists) {
        await prisma.notification.update({
          where: { id: notificationId },
          data: {
            status: 'FAILED',
            retryCount: { increment: 1 }
          }
        });
      }

      throw error;
    }
  },
  { 
    connection: redisConnection,
    concurrency: 5
  }
);

// Handle worker events
notificationWorker.on('completed', (job: Job) => {
  console.log(`✅ Job ${job.id} completed successfully`);
});

notificationWorker.on('failed', (job: Job | undefined, error: Error) => {
  if (job) {
    console.error(`❌ Job ${job.id} failed:`, error.message);
  } else {
    console.error('❌ Job failed:', error.message);
  }
});

notificationWorker.on('error', (error) => {
  console.error('❌ Worker error:', error.message);
});

// Process pending notifications from database
export async function processPendingNotifications() {
  try {
    console.log('🔄 Checking for pending notifications...');
    
    const pending = await prisma.notification.findMany({
      where: { 
        status: 'PENDING'
      },
      orderBy: { createdAt: 'asc' },
      take: 100
    });

    if (pending.length === 0) {
      console.log('✅ No pending notifications found');
      return 0;
    }

    console.log(`📨 Found ${pending.length} pending notifications`);

    for (const notification of pending) {
      await notificationQueue.add('send-notification', {
        notificationId: notification.id
      }, {
        jobId: `notification-${notification.id}`
      });
    }

    console.log(`✅ Queued ${pending.length} notifications`);
    return pending.length;

  } catch (error: any) {
    console.error('❌ Failed to process pending notifications:', error.message);
    return 0;
  }
}

// Function to add notification to queue
export async function enqueueNotification(
  workflowItemId: number,
  recipientId: number,
  eventType: string,
  payload: any
) {
  // Save to database first (outbox pattern)
  const notification = await prisma.notification.create({
    data: {
      workflowItemId,
      recipientId,
      eventType,
      payload,
      status: 'PENDING'
    }
  });

  // Add to queue
  await notificationQueue.add('send-notification', {
    notificationId: notification.id
  }, {
    jobId: `notification-${notification.id}`
  });

  return notification;
}

// Graceful shutdown
export async function closeQueue() {
  try {
    await notificationWorker.close();
    await notificationQueue.close();
    console.log('🛑 Queue closed');
  } catch (error) {
    console.log('⚠️ Queue already closed');
  }
}