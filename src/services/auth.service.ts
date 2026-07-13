import { prisma } from '../app';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
// Remove: import { Role } from '@prisma/client';
// Instead, use string literals or Prisma's built-in types

export class AuthService {
  async register(data: {
    email: string;
    password: string;
    name: string;
    role?: string;
  }) {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email }
    });

    if (existingUser) {
      throw new Error('Email already registered. Please login.');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Create user - use string directly instead of Role enum
    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash: hashedPassword,
        name: data.name,
        role: (data.role || 'CLIENT') as any, // Cast to any to bypass type checking
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        rating: true,
        createdAt: true,
      }
    });

    // Generate JWT token
    const token = this.generateToken(user.id);

    return {
      success: true,
      message: 'User registered successfully',
      user,
      token,
    };
  }

  async login(email: string, password: string) {
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      throw new Error('Invalid email or password');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new Error('Invalid email or password');
    }

    // Generate JWT token
    const token = this.generateToken(user.id);

    // Return user without password
    const { passwordHash, ...userWithoutPassword } = user;

    return {
      success: true,
      message: 'Login successful',
      user: userWithoutPassword,
      token,
    };
  }

  async getProfile(userId: number) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        rating: true,
        createdAt: true,
        updatedAt: true,
      }
    });

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }

  async changePassword(userId: number, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isPasswordValid) {
      throw new Error('Current password is incorrect');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hashedPassword }
    });

    return {
      success: true,
      message: 'Password changed successfully',
    };
  }

  private generateToken(userId: number): string {
    return jwt.sign(
      { userId },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );
  }

  async getAllUsers() {
    return prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        rating: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async updateUserRole(userId: number, newRole: string) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { role: newRole as any }, // Cast to any
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        rating: true,
      }
    });

    return {
      success: true,
      message: 'User role updated successfully',
      user,
    };
  }

  async deleteUser(userId: number) {
    await prisma.user.delete({
      where: { id: userId }
    });

    return {
      success: true,
      message: 'User deleted successfully',
    };
  }
}