import { Request, Response } from 'express';
import { AttachmentService, upload } from '../services/attachment.service';
import { AuthRequest } from '../middleware/auth.middleware';
import path from 'path';
import fs from 'fs';

const attachmentService = new AttachmentService();

export class AttachmentController {
  // Upload single file
  async upload(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const itemId = parseInt(req.params.id as string, 10);
      
      if (isNaN(itemId)) {
        return res.status(400).json({
          error: 'Invalid item ID'
        });
      }

      if (!req.file) {
        return res.status(400).json({
          error: 'No file uploaded'
        });
      }

      const attachment = await attachmentService.uploadAttachment(
        itemId,
        req.file,
        req.user!.id
      );

      return res.status(201).json({
        success: true,
        message: 'File uploaded successfully',
        data: attachment
      });
    } catch (error: any) {
      return res.status(400).json({
        error: error.message
      });
    }
  }

  // Get all attachments for an item
  async getAttachments(req: Request, res: Response): Promise<Response> {
    try {
      const itemId = parseInt(req.params.id as string, 10);
      
      if (isNaN(itemId)) {
        return res.status(400).json({
          error: 'Invalid item ID'
        });
      }

      const attachments = await attachmentService.getAttachments(itemId);
      
      return res.json({
        success: true,
        count: attachments.length,
        data: attachments
      });
    } catch (error: any) {
      return res.status(400).json({
        error: error.message
      });
    }
  }

  // Get single attachment
  async getAttachment(req: Request, res: Response): Promise<Response> {
    try {
      const id = parseInt(req.params.id as string, 10);
      
      if (isNaN(id)) {
        return res.status(400).json({
          error: 'Invalid attachment ID'
        });
      }

      const attachment = await attachmentService.getAttachment(id);
      
      return res.json({
        success: true,
        data: attachment
      });
    } catch (error: any) {
      return res.status(400).json({
        error: error.message
      });
    }
  }

  // Download attachment
  async download(req: Request, res: Response): Promise<any> {
    try {
      const id = parseInt(req.params.id as string, 10);
      
      if (isNaN(id)) {
        return res.status(400).json({
          error: 'Invalid attachment ID'
        });
      }

      const attachment = await attachmentService.getAttachment(id);
      
      // Check if file exists
      if (!fs.existsSync(attachment.filePath)) {
        return res.status(404).json({
          error: 'File not found on server'
        });
      }

      // Send file
      return res.download(attachment.filePath, attachment.fileName);
    } catch (error: any) {
      return res.status(400).json({
        error: error.message
      });
    }
  }

  // Delete attachment
  async delete(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const id = parseInt(req.params.id as string, 10);
      
      if (isNaN(id)) {
        return res.status(400).json({
          error: 'Invalid attachment ID'
        });
      }

      const result = await attachmentService.deleteAttachment(id, req.user!.id);
      
      return res.json(result);
    } catch (error: any) {
      return res.status(400).json({
        error: error.message
      });
    }
  }

  // Get version history for a file
  async getVersionHistory(req: Request, res: Response): Promise<Response> {
    try {
      const itemId = parseInt(req.params.id as string, 10);
      const { fileName } = req.query;
      
      if (isNaN(itemId)) {
        return res.status(400).json({
          error: 'Invalid item ID'
        });
      }

      if (!fileName) {
        return res.status(400).json({
          error: 'fileName query parameter is required'
        });
      }

      const versions = await attachmentService.getVersionHistory(
        itemId,
        fileName as string
      );
      
      return res.json({
        success: true,
        count: versions.length,
        data: versions
      });
    } catch (error: any) {
      return res.status(400).json({
        error: error.message
      });
    }
  }
}