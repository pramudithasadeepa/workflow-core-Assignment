import { AuthService } from '../../services/auth.service';
import { prisma } from '../../app';
import { createTestUser } from '../setup';

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const result = await authService.register({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
        role: 'ADMIN'
      });

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user.email).toBe('test@example.com');
      expect(result.token).toBeDefined();
    });

    it('should throw error if email already exists', async () => {
      await authService.register({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User'
      });

      await expect(authService.register({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User'
      })).rejects.toThrow('Email already registered');
    });
  });

  describe('login', () => {
    it('should login successfully with correct credentials', async () => {
      await authService.register({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User'
      });

      const result = await authService.login('test@example.com', 'password123');
      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.token).toBeDefined();
    });

    it('should throw error with incorrect password', async () => {
      await authService.register({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User'
      });

      await expect(authService.login('test@example.com', 'wrongpassword'))
        .rejects.toThrow('Invalid email or password');
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      const user = await createTestUser();
      
      const result = await authService.changePassword(
        user.id,
        'password123',
        'newpassword123'
      );

      expect(result.success).toBe(true);
      expect(result.message).toBe('Password changed successfully');
    });

    it('should throw error with incorrect current password', async () => {
      const user = await createTestUser();

      await expect(authService.changePassword(
        user.id,
        'wrongpassword',
        'newpassword123'
      )).rejects.toThrow('Current password is incorrect');
    });
  });
});