import { AuditService } from '../../services/audit.service';
import { prisma } from '../../app';
import { createTestUser, createTestTemplate, createTestItem } from '../setup';

describe('Audit Service - Crash Recovery', () => {
  let auditService: AuditService;
  let userId: number;

  beforeEach(async () => {
    auditService = new AuditService();
    const user = await createTestUser();
    userId = user.id;
  });

  describe('rebuildState', () => {
    it('should rebuild state correctly from audit events', async () => {
      // Create template and item
      const template = await createTestTemplate(userId);
      const item = await createTestItem(template.id, userId, 'Draft');

      // Create audit events manually
      await prisma.auditEvent.create({
        data: {
          workflowItemId: item.id,
          eventType: 'CREATED',
          data: {
            initialStage: 'Draft',
            assignedUsers: [userId],
            title: 'Test Item'
          },
          actorId: userId
        }
      });

      await prisma.auditEvent.create({
        data: {
          workflowItemId: item.id,
          eventType: 'TRANSITIONED',
          data: {
            fromStage: 'Draft',
            toStage: 'Review'
          },
          actorId: userId
        }
      });

      await prisma.auditEvent.create({
        data: {
          workflowItemId: item.id,
          eventType: 'TRANSITIONED',
          data: {
            fromStage: 'Review',
            toStage: 'Approval'
          },
          actorId: userId
        }
      });

      // Rebuild state
      const state = await auditService.rebuildState(item.id);
      expect(state.currentStage).toBe('Approval');
    });
  });

  describe('reconcileItem', () => {
    it('should reconcile inconsistent state', async () => {
      // Create template and item
      const template = await createTestTemplate(userId);
      const item = await createTestItem(template.id, userId, 'Draft');

      // Create audit events
      await prisma.auditEvent.create({
        data: {
          workflowItemId: item.id,
          eventType: 'CREATED',
          data: {
            initialStage: 'Draft',
            assignedUsers: [userId],
            title: 'Test Item'
          },
          actorId: userId
        }
      });

      await prisma.auditEvent.create({
        data: {
          workflowItemId: item.id,
          eventType: 'TRANSITIONED',
          data: {
            fromStage: 'Draft',
            toStage: 'Review'
          },
          actorId: userId
        }
      });

      // Corrupt the state (simulate crash)
      await prisma.workflowItem.update({
        where: { id: item.id },
        data: { 
          currentStage: 'Draft', // Should be Review
          version: 1
        }
      });

      // Reconcile
      const result = await auditService.reconcileItem(item.id);
      expect(result.reconciled).toBe(true);
      
      // Fix: Check if newState exists before accessing
      if (result.newState) {
        expect(result.newState.currentStage).toBe('Review');
      } else {
        fail('newState should be defined when reconciled is true');
      }

      // Verify database was updated
      const finalItem = await prisma.workflowItem.findUnique({
        where: { id: item.id }
      });
      expect(finalItem?.currentStage).toBe('Review');
    });
  });
});