import { TemplateService } from '../../services/template.service';
import { createTestUser, createTestTemplate } from '../setup';
import { prisma } from '../../app';

describe('TemplateService', () => {
  let templateService: TemplateService;
  let userId: number;

  beforeEach(async () => {
    templateService = new TemplateService();
    const user = await createTestUser();
    userId = user.id;
  });

  describe('createTemplate', () => {
    it('should create a valid workflow template', async () => {
      const template = await templateService.createTemplate({
        name: 'Test Workflow',
        description: 'Test description',
        stages: ['Draft', 'Review', 'Approval'],
        transitions: {
          'Draft': ['Review'],
          'Review': ['Approval']
        },
        permissions: {
          'Review': ['ADMIN'],
          'Approval': ['ADMIN']
        },
        createdById: userId
      });

      expect(template.id).toBeDefined();
      expect(template.name).toBe('Test Workflow');
      expect(template.stages).toEqual(['Draft', 'Review', 'Approval']);
    });

    it('should reject invalid transition graph', async () => {
      await expect(templateService.createTemplate({
        name: 'Invalid Workflow',
        description: 'Should fail',
        stages: ['Draft', 'Review'],
        transitions: {
          'Draft': ['Approval'], // Approval doesn't exist
          'Review': ['Draft']
        },
        permissions: {},
        createdById: userId
      })).rejects.toThrow('Target stage "Approval" not found');
    });

    it('should reject cyclic dependencies', async () => {
      await expect(templateService.createTemplate({
        name: 'Cyclic Workflow',
        description: 'Should fail',
        stages: ['Draft', 'Review', 'Approval'],
        transitions: {
          'Draft': ['Review'],
          'Review': ['Approval'],
          'Approval': ['Draft'] // Cycle
        },
        permissions: {},
        createdById: userId
      })).rejects.toThrow('Cyclic dependency detected');
    });
  });

  describe('updateTemplate', () => {
    it('should update template successfully', async () => {
      const template = await createTestTemplate(userId);
      
      const updated = await templateService.updateTemplate(
        template.id,
        { name: 'Updated Name' },
        userId
      );

      expect(updated.name).toBe('Updated Name');
      expect(updated.version).toBe(2);
    });

    it('should throw error if user is not creator', async () => {
      const template = await createTestTemplate(userId);
      const otherUser = await createTestUser('MANAGER');

      await expect(templateService.updateTemplate(
        template.id,
        { name: 'Updated Name' },
        otherUser.id
      )).rejects.toThrow('Only the creator can update this template');
    });
  });

  describe('deleteTemplate', () => {
    it('should delete template successfully', async () => {
      const template = await createTestTemplate(userId);
      
      await templateService.deleteTemplate(template.id, userId);
      
      const deleted = await prisma.workflowTemplate.findUnique({
        where: { id: template.id }
      });
      expect(deleted).toBeNull();
    });

    it('should throw error if template has active items', async () => {
      const template = await createTestTemplate(userId);
      
      // Create an item using this template
      await prisma.workflowItem.create({
        data: {
          templateId: template.id,
          currentStage: 'Draft',
          assignedUsers: [userId],
          title: 'Test Item',
          createdById: userId
        }
      });

      await expect(templateService.deleteTemplate(template.id, userId))
        .rejects.toThrow('Cannot delete template with active workflow items');
    });
  });
});