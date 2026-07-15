import request from 'supertest';
import { app } from '../../app';
import { createTestUser, generateTestToken } from '../setup';

describe('Template API Integration Tests', () => {
  let token: string;
  let userId: number;

  beforeEach(async () => {
    const user = await createTestUser();
    userId = user.id;
    token = generateTestToken(userId);
  });

  describe('POST /api/templates', () => {
    it('should create a template', async () => {
      const response = await request(app)
        .post('/api/templates')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Test Workflow',
          stages: ['Draft', 'Review', 'Approval'],
          transitions: {
            'Draft': ['Review'],
            'Review': ['Approval']
          },
          permissions: {
            'Review': ['ADMIN'],
            'Approval': ['ADMIN']
          }
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Test Workflow');
    });

    it('should return 401 without token', async () => {
      const response = await request(app)
        .post('/api/templates')
        .send({
          name: 'Test Workflow',
          stages: ['Draft', 'Review'],
          transitions: { 'Draft': ['Review'] },
          permissions: {}
        });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/templates', () => {
    it('should get all templates', async () => {
      const response = await request(app)
        .get('/api/templates')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });
});