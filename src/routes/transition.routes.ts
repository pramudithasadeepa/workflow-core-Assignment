import { Router } from 'express';
import { TransitionController } from '../controllers/transition.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
const transitionController = new TransitionController();

// All routes require authentication
router.use(authenticate);

// Get valid transitions for an item
router.get(
  '/:id/valid-transitions',
  transitionController.getValidTransitions.bind(transitionController)
);

// Perform transition
router.post(
  '/:id/transition',
  transitionController.transition.bind(transitionController)
);

export default router;