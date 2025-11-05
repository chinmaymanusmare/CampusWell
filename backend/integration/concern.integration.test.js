const request = require('supertest');
const pool = require('../src/config/db');
const app = require('../src/app');

describe('Concerns integration tests', () => {
  let studentId, concernId;
  const pwd = 'Passw0rd1';
  const timestamp = Date.now();
  const studentEmail = `int_student_${timestamp}@example.com`;

  beforeAll(async () => {
    // create student via signup endpoint
    await request(app).post('/signup').send({ 
      name: 'Int Student', 
      email: studentEmail, 
      password: pwd, 
      role: 'student', 
      roll_no: 'R100' 
    });

    const s = await pool.query('SELECT id FROM users WHERE email = $1', [studentEmail]);
    studentId = s.rows[0].id;
  });

  afterAll(async () => {
    // clean concerns and users
    await pool.query('DELETE FROM concerns WHERE student_id = $1', [studentId]);
    await pool.query('DELETE FROM users WHERE email = $1', [studentEmail]);
  });

  test('student can create, view, and update concerns', async () => {
    // login student
    const lres = await request(app).post('/login').send({ email: studentEmail, password: pwd });
    const studentToken = lres.body && lres.body.token;
    expect(lres.statusCode).toBe(200);

    // create concern
    const createRes = await request(app)
      .post('/concerns')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ 
        title: 'Test Concern',
        description: 'Integration test concern',
        type: 'medical'
      });

    expect(createRes.statusCode).toBe(201);
    concernId = createRes.body.data && createRes.body.data.id;

    // view concerns
    const viewRes = await request(app)
      .get('/concerns')
      .set('Authorization', `Bearer ${studentToken}`);
    
    expect(viewRes.statusCode).toBe(200);
    expect(Array.isArray(viewRes.body.data)).toBeTruthy();

    // update concern
    const updateRes = await request(app)
      .put(`/concerns/${concernId}`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ 
        title: 'Updated Test Concern',
        description: 'Updated integration test concern',
        type: 'medical'
      });

    expect(updateRes.statusCode).toBe(200);
  }, 30000);
});