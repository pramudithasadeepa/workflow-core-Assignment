import { prisma } from '../app';

export class AuditService {
  async createAuditEvent(data: {
    workflowItemId: number;
    eventType: string;
    data: any;
    actorId: number;
  }) {
    return prisma.auditEvent.create({
      data: {
        workflowItemId: data.workflowItemId,
        eventType: data.eventType,
        data: data.data,
        actorId: data.actorId
      }
    });
  }

  async getAuditHistory(itemId: number) {
    return prisma.auditEvent.findMany({
      where: { workflowItemId: itemId },
      orderBy: { timestamp: 'asc' },
      include: {
        actor: {
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

  async rebuildState(itemId: number) {
    const events = await this.getAuditHistory(itemId);
    
    let state: any = {
      currentStage: null,
      assignedUsers: [],
      title: null,
      description: null,
      dueDate: null,
      priority: null,
      metadata: null
    };

    for (const event of events) {
      // Skip if data is null or not an object
      if (!event.data || typeof event.data !== 'object' || Array.isArray(event.data)) {
        continue;
      }

      const data = event.data as any;

      switch (event.eventType) {
        case 'CREATED':
          state.currentStage = data.initialStage || null;
          state.assignedUsers = data.assignedUsers || [];
          state.title = data.title || null;
          state.description = data.description || null;
          state.dueDate = data.dueDate || null;
          state.priority = data.priority || 'MEDIUM';
          break;
        case 'TRANSITIONED':
          state.currentStage = data.toStage || null;
          break;
        case 'FIELD_UPDATED':
          if (data.fields && typeof data.fields === 'object') {
            state = { ...state, ...data.fields };
          }
          break;
        case 'ASSIGNED':
          state.assignedUsers = data.users || state.assignedUsers;
          break;
      }
    }

    return state;
  }

  async reconcileItem(itemId: number) {
    const item = await prisma.workflowItem.findUnique({
      where: { id: itemId }
    });

    if (!item) {
      throw new Error('Item not found');
    }

    const reconstructedState = await this.rebuildState(itemId);

    const needsUpdate = 
      item.currentStage !== reconstructedState.currentStage ||
      JSON.stringify(item.assignedUsers) !== JSON.stringify(reconstructedState.assignedUsers);

    if (needsUpdate) {
      const updated = await prisma.workflowItem.update({
        where: { id: itemId },
        data: {
          currentStage: reconstructedState.currentStage || item.currentStage,
          assignedUsers: reconstructedState.assignedUsers || item.assignedUsers,
          title: reconstructedState.title || item.title,
          description: reconstructedState.description || item.description,
          dueDate: reconstructedState.dueDate || item.dueDate,
          priority: reconstructedState.priority || item.priority,
          metadata: reconstructedState.metadata || item.metadata,
          version: { increment: 1 }
        }
      });

      return {
        reconciled: true,
        previousState: item,
        newState: updated,
        reconstructedState
      };
    }

    return {
      reconciled: false,
      state: item
    };
  }
}