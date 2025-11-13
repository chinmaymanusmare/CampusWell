const express = require('express');

jest.mock('../../src/config/db', () => ({
  query: jest.fn(),
  connect: jest.fn(),
  end: jest.fn().mockResolvedValue()
}));

// Mock auth middleware to inject a user
jest.mock('../../src/middleware/auth', () => (req, res, next) => {
  // default user; tests can override by setting req.testUser
  req.user = req.testUser || { id: 123, role: 'student' };
  next();
});

const pool = require('../../src/config/db');
const router = require('../../src/routes/frontendRoutes');

// Helper to build an app that converts res.render into a JSON response
const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    const origRender = res.render.bind(res);
    res.render = (view, locals) => {
      const status = res.statusCode || 200;
      return res.status(status).json({ view, locals });
    };
    next();
  });
  app.use('/', (req, _res, next) => { next(); }, router);
  return app;
};

describe('frontendRoutes basic pages', () => {
  beforeEach(() => jest.clearAllMocks());

  test('GET / renders shared/home', async () => {
    const app = buildApp();
    const res = await require('supertest')(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body.view).toBe('shared/home');
  });

  test('GET /login renders auth/login', async () => {
    const app = buildApp();
    const res = await require('supertest')(app).get('/login');
    expect(res.status).toBe(200);
    expect(res.body.view).toBe('auth/login');
  });
});

describe('frontendRoutes protected dashboard', () => {
  beforeEach(() => jest.clearAllMocks());

  test('GET /users/:id renders dashboard for matching student', async () => {
    // Mock DB response for the user lookup
    pool.query.mockImplementation(async (sql, params) => {
      if (/FROM users WHERE id = \$1/.test(sql)) {
        return { rows: [{ id: params[0], name: 'Stud', email: 's@e.com', role: 'student', roll_number: 'R1', specialization: null, time_per_patient: null }] };
      }
      return { rows: [] };
    });

    const app = buildApp();
    const req = require('supertest');
    const res = await req(app).get('/users/123');
    expect(res.status).toBe(200);
    expect(['student/dashboard', 'shared/profile']).toContain(res.body.view);
  });

  test('GET /users/:id returns 403 when id mismatch', async () => {
    // For mismatch case, DB may not be queried, but provide a default
    pool.query.mockResolvedValue({ rows: [] });
    const app = buildApp();
    const res = await require('supertest')(app).get('/users/999');
    expect(res.status).toBe(403);
    expect(res.body.view).toBe('error/403');
  });
});
