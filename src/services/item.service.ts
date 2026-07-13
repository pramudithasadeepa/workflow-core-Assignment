import { prisma } from '../app';
import { AuditService } from './audit.service';

export class ItemService {
  private auditService = new AuditService();

  async createItem(data: {
    templateId: number;
    title: string;
    description?: string;
    assignedUsers: number[];
    dueDate?: Date;
    priority?: string;
    metadata?: any;
    createdById: number;
  }) {
    // Get template
    const template = await prisma.workflowTemplate.findUnique({
      where: { id: data.templateId }
    });

    if (!template) {
      throw new Error('Template not found');
    }

    const stages = template.stages as string[];
    const initialStage = stages[0] || 'DRAFT';

    // Create item
    const item = await prisma.workflowItem.create({
      data: {
        templateId: data.templateId,
        currentStage: initialStage,
        assignedUsers: data.assignedUsers || [],
        title: data.title,
        description: data.description,
        dueDate: data.dueDate,
        priority: data.priority || 'MEDIUM',
        metadata: data.metadata,
        createdById: data.createdById
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

    // Create audit event
    await this.auditService.createAuditEvent({
      workflowItemId: item.id,
      eventType: 'CREATED',
      data: {
        templateId: data.templateId,
        templateName: template.name,
        initialStage,
        assignedUsers: data.assignedUsers,
        title: data.title,
        description: data.description,
        dueDate: data.dueDate,
        priority: data.priority || 'MEDIUM'
      },
      actorId: data.createdById
    });

    // Create notifications for assigned users
    if (data.assignedUsers && data.assignedUsers.length > 0) {
      await this.createNotifications(
        item.id,
        data.assignedUsers,
        'ASSIGNED',
        {
          message: `You have been assigned to "${data.title}" workflow item`,
          itemId: item.id,
          templateName: template.name
        }
      );
    }

    return item;
  }

  async getItem(id: number) {
    return prisma.workflowItem.findUnique({
      where: { id },
      include: {
        template: {
          select: {
            id: true,
            name: true,
            stages: true,
            transitions: true,
            permissions: true
          }
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      }
    });
  }

  async getAllItems(filters: {
    stage?: string;
    assignedUser?: number;
    templateId?: number;
    fromDate?: Date;
    toDate?: Date;
    page?: number;
    limit?: number;
  }) {
    const { page = 1, limit = 10, ...whereFilters } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};
    
    if (whereFilters.stage) {
      where.currentStage = whereFilters.stage;
    }
    
    if (whereFilters.templateId) {
      where.templateId = whereFilters.templateId;
    }
    
    if (whereFilters.assignedUser) {
      where.assignedUsers = { has: whereFilters.assignedUser };
    }
    
    if (whereFilters.fromDate || whereFilters.toDate) {
      where.createdAt = {};
      if (whereFilters.fromDate) {
        where.createdAt.gte = whereFilters.fromDate;
      }
      if (whereFilters.toDate) {
        where.createdAt.lte = whereFilters.toDate;
      }
    }

    const [items, total] = await Promise.all([
      prisma.workflowItem.findMany({
        where,
        include: {
          template: {
            select: {
              id: true,
              name: true,
              stages: true
            }
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.workflowItem.count({ where })
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  async updateItem(id: number, data: any, userId: number) {
    const item = await prisma.workflowItem.findUnique({
      where: { id },
      include: {
        template: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!item) {
      throw new Error('Item not found');
    }

    // Check if user has permission (assigned or creator)
    if (!item.assignedUsers.includes(userId) && item.createdById !== userId) {
      throw new Error('You do not have permission to update this item');
    }

    // Optimistic locking
    const currentVersion = data.version || item.version;
    
    try {
      const updated = await prisma.workflowItem.update({
        where: {
          id,
          version: currentVersion
        },
        data: {
          ...data,
          version: { increment: 1 }
        },
        include: {
          template: {
            select: {
              id: true,
              name: true,
              stages: true
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

      // Create audit event
      await this.auditService.createAuditEvent({
        workflowItemId: id,
        eventType: 'FIELD_UPDATED',
        data: {
          fields: data,
          previousVersion: currentVersion
        },
        actorId: userId
      });

      return updated;
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new Error('Conflict: Item was modified by another user. Please refresh and try again.');
      }
      throw error;
    }
  }

  async getItemsByUser(userId: number) {
    return prisma.workflowItem.findMany({
      where: {
        assignedUsers: { has: userId }
      },
      include: {
        template: {
          select: {
            id: true,
            name: true,
            stages: true
          }
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  private async createNotifications(itemId: number, userIds: number[], eventType: string, payload: any) {
    for (const userId of userIds) {
      await prisma.notification.create({
        data: {
          workflowItemId: itemId,
          recipientId: userId,
          eventType,
          payload
        }
      });
    }
  }
}