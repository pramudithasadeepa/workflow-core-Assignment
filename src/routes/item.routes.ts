import { Router } from 'express';
import { ItemController } from '../controllers/item.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
const itemController = new ItemController();

// All routes require authentication
router.use(authenticate);

// Create item
router.post('/', itemController.create.bind(itemController));

// Get all items (with filters and pagination)
router.get('/', itemController.getAll.bind(itemController));

// Get my items
router.get('/my', itemController.getMyItems.bind(itemController));

// Get single item
router.get('/:id', itemController.get.bind(itemController));

// Update item
router.patch('/:id', itemController.update.bind(itemController));

// Get audit history
router.get('/:id/audit', itemController.getAuditHistory.bind(itemController));

// Rebuild state from audit events
router.get('/:id/rebuild', itemController.rebuildState.bind(itemController));

// Reconcile item
router.post('/:id/reconcile', itemController.reconcileItem.bind(itemController));

export default router;