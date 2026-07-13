import { Router } from 'express';
import { TemplateController } from '../controllers/template.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();
const templateController = new TemplateController();

// All routes require authentication
router.use(authenticate);

// Create template (Admin/Manager only)
router.post(
  '/',
  authorize('ADMIN', 'MANAGER'),
  templateController.create.bind(templateController)
);

// Get all templates (All authenticated users)
router.get(
  '/',
  templateController.getAll.bind(templateController)
);

// Get single template (All authenticated users)
router.get(
  '/:id',
  templateController.get.bind(templateController)
);

// Get valid transitions (All authenticated users)
router.get(
  '/:id/transitions',
  templateController.getValidTransitions.bind(templateController)
);

// Update template (Admin/Manager only)
router.patch(
  '/:id',
  authorize('ADMIN', 'MANAGER'),
  templateController.update.bind(templateController)
);

// Delete template (Admin only)
router.delete(
  '/:id',
  authorize('ADMIN'),
  templateController.delete.bind(templateController)
);

export default router;