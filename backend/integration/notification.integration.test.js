const request = require('supertest');
const pool = require('../src/config/db');
const app = require('../src/app');

describe('Notifications integration tests', () => {
  let userId, adminId;
  const pwd = 'Passw0rd1';
  const timestamp = Date.now();
  const userEmail = `int_user_${timestamp}@example.com`;
  const adminEmail = `int_admin_${timestamp}@example.com`;

  beforeAll(async () => {
    // create user and admin
    await request(app).post('/signup').send({ 
      name: 'Int User', 
      email: userEmail, 
      password: pwd, 
      role: 'student',
      roll_no: 'R102'
    });

    await request(app).post('/signup').send({ 
      name: 'Int Admin', 
      email: adminEmail, 
      password: pwd, 
      role: 'admin' 
    });

    const u = await pool.query('SELECT id FROM users WHERE email = $1', [userEmail]);
    userId = u.rows[0].id;
    const a = await pool.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
    adminId = a.rows[0].id;
  });

  afterAll(async () => {
    // clean notifications and users
    await pool.query('DELETE FROM notifications WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM users WHERE email IN ($1, $2)', [userEmail, adminEmail]);
  });

  test('admin can create notifications and user can view them', async () => {
    // login admin
    const adminLogin = await request(app).post('/login').send({ email: adminEmail, password: pwd });
    const adminToken = adminLogin.body && adminLogin.body.token;
    expect(adminLogin.statusCode).toBe(200);

    // admin creates notification (route is /notifications/send)
    const createRes = await request(app)
      .post('/notifications/send')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        user_id: userId,
        title: 'Test Notification',
        message: 'This is a test notification',
        type: 'info'
      });

    expect(createRes.statusCode).toBe(201);

    // login user
    const userLogin = await request(app).post('/login').send({ email: userEmail, password: pwd });
    const userToken = userLogin.body && userLogin.body.token;
    expect(userLogin.statusCode).toBe(200);

    // user views notifications
    const viewRes = await request(app)
      .get('/notifications')
      .set('Authorization', `Bearer ${userToken}`);

    expect(viewRes.statusCode).toBe(200);
    expect(Array.isArray(viewRes.body.data)).toBeTruthy();
    expect(viewRes.body.data.length).toBeGreaterThan(0);
  }, 30000);
});