import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();
const authController = new AuthController();

// Public routes (no authentication required)
router.post('/register', authController.register.bind(authController));
router.post('/login', authController.login.bind(authController));

// Protected routes (authentication required)
router.get('/profile', authenticate, authController.getProfile.bind(authController));
router.post('/change-password', authenticate, authController.changePassword.bind(authController));

// Admin only routes
router.get('/users', authenticate, authorize('ADMIN'), authController.getAllUsers.bind(authController));
router.patch('/users/:userId/role', authenticate, authorize('ADMIN'), authController.updateUserRole.bind(authController));
router.delete('/users/:userId', authenticate, authorize('ADMIN'), authController.deleteUser.bind(authController));

export default router;