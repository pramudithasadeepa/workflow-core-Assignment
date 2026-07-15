import { AuthService } from '../../services/auth.service';
import { prisma } from '../../app';
import { createTestUser } from '../setup';
import bcrypt from 'bcrypt';

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const result = await authService.register({
        email: `test-${Date.now()}-${Math.random()}@example.com`,
        password: 'password123',
        name: 'Test User',
        role: 'ADMIN'
      });

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user.email).toContain('@example.com');
      expect(result.token).toBeDefined();
    });

    it('should throw error if email already exists', async () => {
      const email = `test-${Date.now()}-${Math.random()}@example.com`;
      await authService.register({
        email,
        password: 'password123',
        name: 'Test User'
      });

      await expect(authService.register({
        email,
        password: 'password123',
        name: 'Test User'
      })).rejects.toThrow('Email already registered');
    });
  });

  describe('login', () => {
    it('should login successfully with correct credentials', async () => {
      const email = `test-${Date.now()}-${Math.random()}@example.com`;
      await authService.register({
        email,
        password: 'password123',
        name: 'Test User'
      });

      const result = await authService.login(email, 'password123');
      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.token).toBeDefined();
    });

    it('should throw error with incorrect password', async () => {
      const email = `test-${Date.now()}-${Math.random()}@example.com`;
      await authService.register({
        email,
        password: 'password123',
        name: 'Test User'
      });

      await expect(authService.login(email, 'wrongpassword'))
        .rejects.toThrow('Invalid email or password');
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      // Create user with known password
      const email = `test-${Date.now()}-${Math.random()}@example.com`;
      const password = 'password123';
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash: hashedPassword,
          name: 'Test User',
          role: 'ADMIN'
        }
      });
      
      const result = await authService.changePassword(
        user.id,
        password,
        'newpassword123'
      );

      expect(result.success).toBe(true);
      expect(result.message).toBe('Password changed successfully');
    });

    it('should throw error with incorrect current password', async () => {
      const email = `test-${Date.now()}-${Math.random()}@example.com`;
      const password = 'password123';
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash: hashedPassword,
          name: 'Test User',
          role: 'ADMIN'
        }
      });

      await expect(authService.changePassword(
        user.id,
        'wrongpassword',
        'newpassword123'
      )).rejects.toThrow('Current password is incorrect');
    });
  });
});