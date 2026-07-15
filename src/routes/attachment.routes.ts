import { Router } from 'express';
import { AttachmentController } from '../controllers/attachment.controller';
import { authenticate } from '../middleware/auth.middleware';
import { upload } from '../services/attachment.service';

const router = Router();
const attachmentController = new AttachmentController();

// All routes require authentication
router.use(authenticate);

// Upload file to item
router.post(
  '/items/:id/attachments',
  upload.single('file'),
  attachmentController.upload.bind(attachmentController)
);

// Get all attachments for an item
router.get(
  '/items/:id/attachments',
  attachmentController.getAttachments.bind(attachmentController)
);

// Get version history for a file
router.get(
  '/items/:id/attachments/versions',
  attachmentController.getVersionHistory.bind(attachmentController)
);

// Get single attachment
router.get(
  '/attachments/:id',
  attachmentController.getAttachment.bind(attachmentController)
);

// Download attachment
router.get(
  '/attachments/:id/download',
  attachmentController.download.bind(attachmentController)
);

// Delete attachment
router.delete(
  '/attachments/:id',
  attachmentController.delete.bind(attachmentController)
);

export default router;