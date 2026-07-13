import { Request, Response } from 'express';
import { ItemService } from '../services/item.service';
import { AuditService } from '../services/audit.service';
import { AuthRequest } from '../middleware/auth.middleware';

const itemService = new ItemService();
const auditService = new AuditService();

export class ItemController {
  async create(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const { templateId, title, description, assignedUsers, dueDate, priority, metadata } = req.body;

      // Validate required fields
      if (!templateId || !title) {
        return res.status(400).json({
          error: 'Missing required fields: templateId, title'
        });
      }

      // Validate template exists
      const item = await itemService.createItem({
        templateId,
        title,
        description,
        assignedUsers: assignedUsers || [],
        dueDate: dueDate ? new Date(dueDate) : undefined,
        priority,
        metadata,
        createdById: req.user!.id
      });

      return res.status(201).json({
        success: true,
        message: 'Workflow item created successfully',
        data: item
      });
    } catch (error: any) {
      return res.status(400).json({
        error: error.message
      });
    }
  }

  async get(req: Request, res: Response): Promise<Response> {
    try {
      const id = parseInt(req.params.id as string, 10);
      
      if (isNaN(id)) {
        return res.status(400).json({
          error: 'Invalid item ID'
        });
      }

      const item = await itemService.getItem(id);

      if (!item) {
        return res.status(404).json({
          error: 'Workflow item not found'
        });
      }

      return res.json({
        success: true,
        data: item
      });
    } catch (error: any) {
      return res.status(400).json({
        error: error.message
      });
    }
  }

  async getAll(req: Request, res: Response): Promise<Response> {
    try {
      const { stage, assignedUser, templateId, fromDate, toDate, page, limit } = req.query;

      const result = await itemService.getAllItems({
        stage: stage as string,
        assignedUser: assignedUser ? parseInt(assignedUser as string, 10) : undefined,
        templateId: templateId ? parseInt(templateId as string, 10) : undefined,
        fromDate: fromDate ? new Date(fromDate as string) : undefined,
        toDate: toDate ? new Date(toDate as string) : undefined,
        page: page ? parseInt(page as string, 10) : undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined
      });

      return res.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      return res.status(400).json({
        error: error.message
      });
    }
  }

  async update(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const id = parseInt(req.params.id as string, 10);
      
      if (isNaN(id)) {
        return res.status(400).json({
          error: 'Invalid item ID'
        });
      }

      const item = await itemService.updateItem(
        id,
        req.body,
        req.user!.id
      );

      return res.json({
        success: true,
        message: 'Workflow item updated successfully',
        data: item
      });
    } catch (error: any) {
      if (error.message.includes('Conflict')) {
        return res.status(409).json({
          error: error.message
        });
      }
      return res.status(400).json({
        error: error.message
      });
    }
  }

  async getMyItems(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const items = await itemService.getItemsByUser(req.user!.id);
      return res.json({
        success: true,
        count: items.length,
        data: items
      });
    } catch (error: any) {
      return res.status(400).json({
        error: error.message
      });
    }
  }

  async getAuditHistory(req: Request, res: Response): Promise<Response> {
    try {
      const id = parseInt(req.params.id as string, 10);
      
      if (isNaN(id)) {
        return res.status(400).json({
          error: 'Invalid item ID'
        });
      }

      const history = await auditService.getAuditHistory(id);
      return res.json({
        success: true,
        count: history.length,
        data: history
      });
    } catch (error: any) {
      return res.status(400).json({
        error: error.message
      });
    }
  }

  async reconcileItem(req: Request, res: Response): Promise<Response> {
    try {
      const id = parseInt(req.params.id as string, 10);
      
      if (isNaN(id)) {
        return res.status(400).json({
          error: 'Invalid item ID'
        });
      }

      const result = await auditService.reconcileItem(id);
      return res.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      return res.status(400).json({
        error: error.message
      });
    }
  }

  async rebuildState(req: Request, res: Response): Promise<Response> {
    try {
      const id = parseInt(req.params.id as string, 10);
      
      if (isNaN(id)) {
        return res.status(400).json({
          error: 'Invalid item ID'
        });
      }

      const state = await auditService.rebuildState(id);
      return res.json({
        success: true,
        data: state
      });
    } catch (error: any) {
      return res.status(400).json({
        error: error.message
      });
    }
  }
}