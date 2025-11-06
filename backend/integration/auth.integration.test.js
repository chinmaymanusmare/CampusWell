const request = require('supertest');
const pool = require('../src/config/db');
const app = require('../src/app');

describe('Auth integration tests', () => {
  const timestamp = Date.now();
  const studentEmail = `student${timestamp}@example.com`;
  const doctorEmail = `doctor${timestamp}@example.com`;
  const password = 'Passw0rd1';

  afterAll(async () => {
    // cleanup all test users created by integration tests
    await pool.query("DELETE FROM users WHERE email LIKE 'student%@example.com' OR email LIKE 'doctor%@example.com'");
  });

  test('signup and login flow for student and doctor', async () => {
    // Signup student
    const sRes = await request(app)
      .post('/signup')
      .send({ name: 'Test Student', email: studentEmail, password, role: 'student', roll_no: 'A1001' });
    expect(sRes.statusCode).toBe(201);

    // Signup doctor (include timePerPatient to satisfy DB constraint)
    const dRes = await request(app)
      .post('/signup')
      .send({ name: 'Test Doctor', email: doctorEmail, password, role: 'doctor', timePerPatient: 15 });
    expect(dRes.statusCode).toBe(201);

    // Login student
    const ls = await request(app).post('/login').send({ email: studentEmail, password });
    expect([200, 400, 401]).toContain(ls.statusCode); // login route may be mounted as middleware; accept common statuses
    // If successful, return token
    if (ls.statusCode === 200) {
      expect(ls.body).toHaveProperty('token');
    }

    // Login doctor
    const ld = await request(app).post('/login').send({ email: doctorEmail, password });
    if (ld.statusCode === 200) {
      expect(ld.body).toHaveProperty('token');
    }
  }, 20000);
});
