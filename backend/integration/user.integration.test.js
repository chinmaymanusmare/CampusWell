const request = require('supertest');
const pool = require('../src/config/db');
const app = require('../src/app');

describe('Users integration tests', () => {
  const pwd = 'Passw0rd1';
  const timestamp = Date.now();
  const testEmail = `int_user_${timestamp}@example.com`;

  afterAll(async () => {
    // clean users
    await pool.query('DELETE FROM users WHERE email = $1', [testEmail]);
  });

  test('user signup, login, and profile operations', async () => {
    // signup
    const signupRes = await request(app)
      .post('/signup')
      .send({ 
        name: 'Integration Test User', 
        email: testEmail, 
        password: pwd, 
        role: 'student',
        roll_no: 'R101'
      });

    expect(signupRes.statusCode).toBe(201);

    // login
    const loginRes = await request(app)
      .post('/login')
      .send({ 
        email: testEmail, 
        password: pwd 
      });

    expect(loginRes.statusCode).toBe(200);
    const token = loginRes.body && loginRes.body.token;
    expect(token).toBeTruthy();

    // fetch user id then get profile via /users/:id
    const q = await pool.query('SELECT id FROM users WHERE email = $1', [testEmail]);
    const userId = q.rows[0].id;

    // get profile
    const profileRes = await request(app)
      .get(`/users/${userId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(profileRes.statusCode).toBe(200);
    expect(profileRes.body.data.email).toBe(testEmail);

    // update profile via PUT /users/:id (include email to avoid NOT NULL constraint)
    const updateRes = await request(app)
      .put(`/users/${userId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Updated Test User',
        email: testEmail,
        roll_no: 'R101'
      });

    expect(updateRes.statusCode).toBe(200);
  }, 30000);
});