import { TransitionService } from '../../services/transition.service';
import { prisma } from '../../app';
import { createTestUser, createTestTemplate, createTestItem } from '../setup';

describe('Concurrency Stress Tests', () => {
  let transitionService: TransitionService;
  let itemId: number;
  let userIds: number[];

  beforeEach(async () => {
    transitionService = new TransitionService();
    
    // Reduce to 10 users for faster tests (still tests concurrency)
    const numUsers = process.env.CI ? 5 : 10;
    
    userIds = await Promise.all(
      Array.from({ length: numUsers }, async (_, i) => {
        const user = await createTestUser('ADMIN');
        return user.id;
      })
    );

    // Create template
    const template = await createTestTemplate(userIds[0]);

    // Create item
    const item = await createTestItem(template.id, userIds[0], 'Draft');
    // Update to Review stage first
    await prisma.workflowItem.update({
      where: { id: item.id },
      data: { currentStage: 'Review' }
    });
    itemId = item.id;
  });

  describe('Concurrent Transitions', () => {
    it('should allow exactly 1 transition success out of concurrent attempts', async () => {
      const promises = userIds.map((userId) => 
        transitionService.transition(itemId, 'Review', 'Approval', userId)
          .then(result => ({ success: true, result }))
          .catch((error: Error) => ({ success: false, error: error.message }))
      );

      const responses = await Promise.all(promises);
      
      const successCount = responses.filter(r => r.success).length;
      const conflictCount = responses.filter(r => 
        !r.success && 'error' in r && r.error && r.error.includes('Concurrency conflict')
      ).length;

      // Exactly 1 should succeed, rest should fail with conflict
      expect(successCount).toBe(1);
      expect(conflictCount).toBe(userIds.length - 1);

      // Verify final state
      const finalItem = await prisma.workflowItem.findUnique({
        where: { id: itemId }
      });
      expect(finalItem?.currentStage).toBe('Approval');
      expect(finalItem?.version).toBe(2);
    });
  });

  describe('Concurrent Field Updates', () => {
    it('should handle concurrent field updates correctly', async () => {
      const template = await createTestTemplate(userIds[0]);
      const item = await createTestItem(template.id, userIds[0], 'Draft');

      const updateData = [
        { priority: 'HIGH', version: 1 },
        { priority: 'LOW', version: 1 },
        { priority: 'URGENT', version: 1 },
        { priority: 'MEDIUM', version: 1 },
        { priority: 'CRITICAL', version: 1 }
      ];

      const promises = updateData.map((data) =>
        prisma.workflowItem.update({
          where: {
            id: item.id,
            version: data.version
          },
          data: {
            priority: data.priority,
            version: { increment: 1 }
          }
        }).then(result => ({ success: true, result }))
          .catch((error: Error) => ({ success: false, error: error.message }))
      );

      const responses = await Promise.all(promises);
      
      const successCount = responses.filter(r => 
        r.success && 'result' in r && r.result && r.result.id
      ).length;
      
      const conflictCount = responses.filter(r => 
        !r.success && 'error' in r && r.error && r.error.includes('Record to update not found')
      ).length;

      expect(successCount).toBe(1);
      expect(conflictCount).toBe(4);

      const finalItem = await prisma.workflowItem.findUnique({
        where: { id: item.id }
      });
      expect(finalItem?.version).toBe(2);
    });
  });
});