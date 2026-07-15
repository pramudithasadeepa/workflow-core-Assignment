import { Request, Response } from 'express';
import { TemplateService } from '../services/template.service';
import { AuthRequest } from '../middleware/auth.middleware';

const templateService = new TemplateService();

export class TemplateController {
  async create(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const { name, description, stages, transitions, permissions } = req.body;

      // Validate required fields
      if (!name || !stages || !transitions) {
        return res.status(400).json({
          error: 'Missing required fields: name, stages, transitions'
        });
      }

      if (!Array.isArray(stages) || stages.length === 0) {
        return res.status(400).json({
          error: 'Stages must be a non-empty array'
        });
      }

      const template = await templateService.createTemplate({
        name,
        description,
        stages,
        transitions,
        permissions: permissions || {},
        createdById: req.user!.id
      });

      return res.status(201).json({
        success: true,
        message: 'Template created successfully',
        data: template
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
          error: 'Invalid template ID'
        });
      }

      const template = await templateService.getTemplate(id);

      if (!template) {
        return res.status(404).json({
          error: 'Template not found'
        });
      }

      return res.json({
        success: true,
        data: template
      });
    } catch (error: any) {
      return res.status(400).json({
        error: error.message
      });
    }
  }

  async getAll(req: Request, res: Response): Promise<Response> {
    try {
      const templates = await templateService.getAllTemplates();
      return res.json({
        success: true,
        count: templates.length,
        data: templates
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
          error: 'Invalid template ID'
        });
      }

      const template = await templateService.updateTemplate(
        id,
        req.body,
        req.user!.id
      );

      return res.json({
        success: true,
        message: 'Template updated successfully',
        data: template
      });
    } catch (error: any) {
      return res.status(400).json({
        error: error.message
      });
    }
  }

  async delete(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const id = parseInt(req.params.id as string, 10);
      
      if (isNaN(id)) {
        return res.status(400).json({
          error: 'Invalid template ID'
        });
      }

      await templateService.deleteTemplate(id, req.user!.id);

      return res.status(204).send();
    } catch (error: any) {
      return res.status(400).json({
        error: error.message
      });
    }
  }

  async getValidTransitions(req: Request, res: Response): Promise<Response> {
    try {
      const id = parseInt(req.params.id as string, 10);
      const { currentStage } = req.query;

      if (isNaN(id)) {
        return res.status(400).json({
          error: 'Invalid template ID'
        });
      }

      if (!currentStage) {
        return res.status(400).json({
          error: 'currentStage query parameter is required'
        });
      }

      const transitions = await templateService.getValidTransitions(
        id,
        currentStage as string
      );

      return res.json({
        success: true,
        data: {
          currentStage,
          validTransitions: transitions
        }
      });
    } catch (error: any) {
      return res.status(400).json({
        error: error.message
      });
    }
  }
}