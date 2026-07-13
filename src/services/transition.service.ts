import { prisma } from '../app';
import { Prisma } from '@prisma/client';
import { AuditService } from './audit.service';

export class TransitionService {
  private auditService = new AuditService();

  async transition(
    itemId: number,
    fromStage: string,
    toStage: string,
    userId: number
  ) {
    // Use transaction for atomicity with proper type
    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1. Get item with optimistic locking
      const item = await tx.workflowItem.findUnique({
        where: { id: itemId },
        include: { 
          template: true,
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });

      if (!item) {
        throw new Error('Item not found');
      }

      // 2. Check if current stage matches
      if (item.currentStage !== fromStage) {
        throw new Error(`Item is at "${item.currentStage}", not "${fromStage}"`);
      }

      // 3. Validate transition
      const transitions = item.template.transitions as Record<string, string[]>;
      const validTransitions = transitions[fromStage] || [];
      
      if (!validTransitions.includes(toStage)) {
        throw new Error(`Invalid transition from "${fromStage}" to "${toStage}"`);
      }

      // 4. Permission check (data-driven)
      const permissions = item.template.permissions as Record<string, string[]>;
      const allowedRoles = permissions[toStage] || ['ADMIN'];
      
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { role: true }
      });

      if (!user) {
        throw new Error('User not found');
      }

      if (!allowedRoles.includes(user.role)) {
        throw new Error(`You do not have permission for this transition. Required roles: ${allowedRoles.join(', ')}`);
      }

      // 5. Check if user is assigned to the item (or is creator/admin)
      const isAssigned = item.assignedUsers.includes(userId);
      const isCreator = item.createdById === userId;
      const isAdmin = user.role === 'ADMIN';

      if (!isAssigned && !isCreator && !isAdmin) {
        throw new Error('You are not assigned to this item');
      }

      // 6. Update with optimistic locking
      const updatedItem = await tx.workflowItem.update({
        where: {
          id: itemId,
          version: item.version // Optimistic locking
        },
        data: {
          currentStage: toStage,
          version: { increment: 1 }
        },
        include: {
          template: {
            select: {
              id: true,
              name: true,
              stages: true,
              transitions: true
            }
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });

      // 7. Create audit event
      await this.auditService.createAuditEvent({
        workflowItemId: itemId,
        eventType: 'TRANSITIONED',
        data: {
          fromStage,
          toStage,
          timestamp: new Date().toISOString(),
          userId,
          userRole: user.role
        },
        actorId: userId
      });

      // 8. Create notification for creator and assigned users
      const recipients = new Set([...item.assignedUsers, item.createdById]);
      
      for (const recipientId of recipients) {
        if (recipientId === userId) continue;

        await tx.notification.create({
          data: {
            workflowItemId: itemId,
            recipientId: recipientId,
            eventType: 'STAGE_CHANGED',
            payload: {
              fromStage,
              toStage,
              message: `Item "${item.title}" moved from ${fromStage} to ${toStage}`,
              itemId: item.id,
              templateName: item.template.name,
              performedBy: user.role
            }
          }
        });
      }

      return updatedItem;
    });
  }

  async getValidTransitions(itemId: number, userId: number) {
    const item = await prisma.workflowItem.findUnique({
      where: { id: itemId },
      include: { template: true }
    });

    if (!item) {
      throw new Error('Item not found');
    }

    const transitions = item.template.transitions as Record<string, string[]>;
    const validTargets = transitions[item.currentStage] || [];

    const permissions = item.template.permissions as Record<string, string[]>;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });

    if (!user) {
      throw new Error('User not found');
    }

    const isAssigned = item.assignedUsers.includes(userId);
    const isCreator = item.createdById === userId;
    const isAdmin = user.role === 'ADMIN';

    if (!isAssigned && !isCreator && !isAdmin) {
      return [];
    }

    const filteredTargets = validTargets.filter(target => {
      const allowedRoles = permissions[target] || ['ADMIN'];
      return allowedRoles.includes(user.role);
    });

    return filteredTargets;
  }
}