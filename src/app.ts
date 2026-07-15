import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { createServer } from 'http';

// Import routes
import authRoutes from './routes/auth.routes';
import templateRoutes from './routes/template.routes';
import itemRoutes from './routes/item.routes';
import transitionRoutes from './routes/transition.routes';
import attachmentRoutes from './routes/attachment.routes';

// Import queue
import { 
  notificationWorker, 
  processPendingNotifications, 
  closeQueue 
} from './queues/notification.queue';

// Import redis client
import { redisClient } from './config/redis.config';

dotenv.config();

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
});

export const app = express();
const server = createServer(app);

// ============ Middleware ============
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files for uploads
app.use('/uploads', express.static(process.env.UPLOAD_DIR || './uploads'));

// ============ Request Logging ============
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ============ Routes ============
app.use('/api/auth', authRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/transitions', transitionRoutes);
app.use('/api', attachmentRoutes); // /api/items/:id/attachments, /api/attachments/:id

// ============ Health Check ============
app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'OK',
      database: 'connected',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'ERROR',
      database: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// ============ Notification Queue Status ============
app.get('/api/queue/status', async (_req, res) => {
  try {
    const counts = await prisma.notification.groupBy({
      by: ['status'],
      _count: true
    });

    const queueCounts = {
      pending: counts.find(c => c.status === 'PENDING')?._count || 0,
      processing: counts.find(c => c.status === 'PROCESSING')?._count || 0,
      completed: counts.find(c => c.status === 'COMPLETED')?._count || 0,
      failed: counts.find(c => c.status === 'FAILED')?._count || 0
    };

    res.json({
      success: true,
      data: queueCounts
    });
  } catch (error: any) {
    res.status(500).json({
      error: error.message
    });
  }
});

// ============ Force Process Pending Notifications ============
app.post('/api/queue/process', async (_req, res) => {
  try {
    const count = await processPendingNotifications();
    res.json({
      success: true,
      message: `Queued ${count} pending notifications`
    });
  } catch (error: any) {
    res.status(500).json({
      error: error.message
    });
  }
});

// ============ 404 Handler ============
app.use((_req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'Route does not exist',
  });
});

// ============ Global Error Handler ============
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('🔥 Error:', err);
  
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  
  res.status(status).json({
    error: message,
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// ============ Start Server ============
const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Create uploads directory
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    await prisma.$connect();
    console.log('✅ Database connected successfully');

    const pendingCount = await processPendingNotifications();
    if (pendingCount > 0) {
      console.log(`📨 ${pendingCount} pending notifications queued`);
    }

    server.listen(PORT, () => {
      console.log('\n==================================');
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📍 Health: http://localhost:${PORT}/health`);
      console.log(`🔐 Auth: http://localhost:${PORT}/api/auth`);
      console.log(`📋 Templates: http://localhost:${PORT}/api/templates`);
      console.log(`📦 Items: http://localhost:${PORT}/api/items`);
      console.log(`🔄 Transitions: http://localhost:${PORT}/api/transitions`);
      console.log(`📨 Queue: http://localhost:${PORT}/api/queue/status`);
      console.log(`📎 Attachments: http://localhost:${PORT}/api/items/:id/attachments`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('==================================\n');
    });

  } catch (error: any) {
    console.error('❌ Failed to start server:', error.message);
    console.error('💡 Make sure PostgreSQL and Redis are running');
    process.exit(1);
  }
}

// Import fs for directory creation
import fs from 'fs';

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  await closeQueue();
  await redisClient.quit();
  await prisma.$disconnect();
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  await closeQueue();
  await redisClient.quit();
  await prisma.$disconnect();
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

startServer();

export { server };