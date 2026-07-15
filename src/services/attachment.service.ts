import { prisma } from '../app';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { Request } from 'express';

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    // Create upload directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with original extension
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// File filter for allowed types
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} is not allowed. Allowed types: ${allowedTypes.join(', ')}`));
  }
};

// Create multer upload instance
export const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB default
  },
  fileFilter: fileFilter
});

export class AttachmentService {
  async uploadAttachment(
    workflowItemId: number,
    file: Express.Multer.File,
    userId: number
  ) {
    // Check if item exists
    const item = await prisma.workflowItem.findUnique({
      where: { id: workflowItemId },
      include: {
        template: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!item) {
      throw new Error('Workflow item not found');
    }

    // Check if user has permission (assigned, creator, or admin)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });

    if (!user) {
      throw new Error('User not found');
    }

    const isAssigned = item.assignedUsers.includes(userId);
    const isCreator = item.createdById === userId;
    const isAdmin = user.role === 'ADMIN';

    if (!isAssigned && !isCreator && !isAdmin) {
      throw new Error('You do not have permission to upload files to this item');
    }

    // Get current max version for this filename
    const existingFiles = await prisma.attachment.findMany({
      where: {
        workflowItemId,
        fileName: file.originalname
      },
      orderBy: { version: 'desc' },
      take: 1
    });

    const nextVersion = existingFiles.length > 0 ? existingFiles[0].version + 1 : 1;

    // Save attachment to database
    const attachment = await prisma.attachment.create({
      data: {
        workflowItemId,
        fileName: file.originalname,
        filePath: file.path,
        fileSize: file.size,
        mimeType: file.mimetype,
        version: nextVersion,
        uploadedById: userId
      },
      include: {
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        workflowItem: {
          select: {
            id: true,
            title: true,
            currentStage: true
          }
        }
      }
    });

    // Create audit event
    await prisma.auditEvent.create({
      data: {
        workflowItemId,
        eventType: 'ATTACHED',
        data: {
          fileName: file.originalname,
          version: nextVersion,
          fileSize: file.size,
          mimeType: file.mimetype,
          filePath: file.path
        },
        actorId: userId
      }
    });

    // Create notification for assigned users and creator
    const recipients = new Set([...item.assignedUsers, item.createdById]);
    
    for (const recipientId of recipients) {
      if (recipientId === userId) continue;

      await prisma.notification.create({
        data: {
          workflowItemId,
          recipientId: recipientId,
          eventType: 'FILE_ATTACHED',
          payload: {
            fileName: file.originalname,
            version: nextVersion,
            message: `File "${file.originalname}" (v${nextVersion}) attached to "${item.title}"`,
            itemId: item.id,
            templateName: item.template.name
          }
        }
      });
    }

    return attachment;
  }

  async getAttachments(itemId: number) {
    const attachments = await prisma.attachment.findMany({
      where: { workflowItemId: itemId },
      orderBy: { createdAt: 'desc' },
      include: {
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    return attachments;
  }

  async getAttachment(id: number) {
    const attachment = await prisma.attachment.findUnique({
      where: { id },
      include: {
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        workflowItem: {
          select: {
            id: true,
            title: true
          }
        }
      }
    });

    if (!attachment) {
      throw new Error('Attachment not found');
    }

    return attachment;
  }

  async deleteAttachment(attachmentId: number, userId: number) {
    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: {
        workflowItem: {
          include: {
            template: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });

    if (!attachment) {
      throw new Error('Attachment not found');
    }

    const item = attachment.workflowItem;

    // Check permission
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });

    if (!user) {
      throw new Error('User not found');
    }

    const isAssigned = item.assignedUsers.includes(userId);
    const isCreator = item.createdById === userId;
    const isAdmin = user.role === 'ADMIN';

    if (!isAssigned && !isCreator && !isAdmin) {
      throw new Error('You do not have permission to delete this attachment');
    }

    // Delete file from disk
    if (fs.existsSync(attachment.filePath)) {
      fs.unlinkSync(attachment.filePath);
    }

    // Delete from database
    await prisma.attachment.delete({
      where: { id: attachmentId }
    });

    // Create audit event
    await prisma.auditEvent.create({
      data: {
        workflowItemId: item.id,
        eventType: 'ATTACHMENT_DELETED',
        data: {
          fileName: attachment.fileName,
          version: attachment.version,
          fileSize: attachment.fileSize
        },
        actorId: userId
      }
    });

    return {
      success: true,
      message: `Attachment "${attachment.fileName}" deleted successfully`
    };
  }

  async getVersionHistory(itemId: number, fileName: string) {
    const attachments = await prisma.attachment.findMany({
      where: {
        workflowItemId: itemId,
        fileName: fileName
      },
      orderBy: { version: 'asc' },
      include: {
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    if (attachments.length === 0) {
      throw new Error(`No attachments found with filename: ${fileName}`);
    }

    return attachments;
  }
}