import request from 'supertest';
import { app } from '../../app';
import { createTestUser, generateTestToken, createTestTemplate } from '../setup';

describe('Permission Validation Tests', () => {
  let adminToken: string;
  let managerToken: string;
  let reviewerToken: string;
  let userId: number;
  let templateId: number;

  beforeEach(async () => {
    // Create users
    const admin = await createTestUser('ADMIN');
    const manager = await createTestUser('MANAGER');
    const reviewer = await createTestUser('REVIEWER');
    userId = admin.id;

    adminToken = generateTestToken(admin.id);
    managerToken = generateTestToken(manager.id);
    reviewerToken = generateTestToken(reviewer.id);

    // Create template
    const template = await createTestTemplate(admin.id);
    templateId = template.id;
  });

  describe('Template Creation', () => {
    it('should allow ADMIN to create template', async () => {
      const response = await request(app)
        .post('/api/templates')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Workflow',
          stages: ['Draft', 'Review'],
          transitions: { 'Draft': ['Review'] },
          permissions: { 'Review': ['ADMIN'] }
        });

      expect(response.status).toBe(201);
    });

    it('should allow MANAGER to create template', async () => {
      const response = await request(app)
        .post('/api/templates')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          name: 'Test Workflow',
          stages: ['Draft', 'Review'],
          transitions: { 'Draft': ['Review'] },
          permissions: { 'Review': ['ADMIN'] }
        });

      expect(response.status).toBe(201);
    });

    it('should deny REVIEWER from creating template', async () => {
      const response = await request(app)
        .post('/api/templates')
        .set('Authorization', `Bearer ${reviewerToken}`)
        .send({
          name: 'Test Workflow',
          stages: ['Draft', 'Review'],
          transitions: { 'Draft': ['Review'] },
          permissions: { 'Review': ['ADMIN'] }
        });

      expect(response.status).toBe(403);
    });
  });

  describe('Template Deletion', () => {
    it('should allow ADMIN to delete template', async () => {
      const response = await request(app)
        .delete(`/api/templates/${templateId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(204);
    });

    it('should deny MANAGER from deleting template', async () => {
      const response = await request(app)
        .delete(`/api/templates/${templateId}`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(response.status).toBe(403);
    });
  });
});