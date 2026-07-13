import { Request, Response } from 'express';
import { TransitionService } from '../services/transition.service';
import { AuditService } from '../services/audit.service';
import { AuthRequest } from '../middleware/auth.middleware';

const transitionService = new TransitionService();
const auditService = new AuditService();

export class TransitionController {
  async transition(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const id = parseInt(req.params.id as string, 10);
      const { fromStage, toStage } = req.body;

      if (isNaN(id)) {
        return res.status(400).json({
          error: 'Invalid item ID'
        });
      }

      if (!fromStage || !toStage) {
        return res.status(400).json({
          error: 'Missing required fields: fromStage, toStage'
        });
      }

      const item = await transitionService.transition(
        id,
        fromStage,
        toStage,
        req.user!.id
      );

      return res.json({
        success: true,
        message: `Item transitioned from "${fromStage}" to "${toStage}" successfully`,
        data: item
      });
    } catch (error: any) {
      if (error.message.includes('Concurrency')) {
        return res.status(409).json({
          error: error.message
        });
      }
      if (error.message.includes('Invalid') || error.message.includes('permission')) {
        return res.status(400).json({
          error: error.message
        });
      }
      return res.status(500).json({
        error: error.message
      });
    }
  }

  async getValidTransitions(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const id = parseInt(req.params.id as string, 10);
      
      if (isNaN(id)) {
        return res.status(400).json({
          error: 'Invalid item ID'
        });
      }

      const transitions = await transitionService.getValidTransitions(
        id,
        req.user!.id
      );

      return res.json({
        success: true,
        data: {
          itemId: id,
          currentStage: null, // Will be populated by service
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