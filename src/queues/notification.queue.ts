import { Queue, Worker, Job } from 'bullmq';
import { redisConnection } from '../config/redis.config';
import { prisma } from '../app';

// Create notification queue
export const notificationQueue = new Queue('notifications', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
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

      // Mark as processing
      const notification = await prisma.notification.update({
        where: { id: notificationId },
        data: { 
          status: 'PROCESSING'
        }
      });

      // Simulate sending notification (email, push, etc.)
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

      // Mark as failed
      await prisma.notification.update({
        where: { id: notificationId },
        data: {
          status: 'FAILED',
          retryCount: { increment: 1 }
        }
      });

      throw error;
    }
  },
  { 
    connection: redisConnection,
    concurrency: 5 // Process 5 notifications simultaneously
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

// Process pending notifications from database (crash recovery)
export async function processPendingNotifications() {
  try {
    console.log('🔄 Checking for pending notifications...');
    
    const pending = await prisma.notification.findMany({
      where: { 
        status: 'PENDING'
      },
      orderBy: { createdAt: 'asc' },
      take: 100 // Process 100 at a time
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
        jobId: `notification-${notification.id}` // Deduplicate
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
  await notificationWorker.close();
  await notificationQueue.close();
  console.log('🛑 Queue closed');
}