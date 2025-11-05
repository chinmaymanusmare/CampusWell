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

    // create a doctor to reply to concerns
    const doctorEmail = `int_doctor_${timestamp}@example.com`;
    await request(app).post('/signup').send({ name: 'Int Doctor', email: doctorEmail, password: pwd, role: 'doctor' });
    const d = await pool.query('SELECT id FROM users WHERE email = $1', [doctorEmail]);
    doctorId = d.rows[0].id;

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

    // create concern (controller expects category and message)
    const createRes = await request(app)
      .post('/concerns')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ 
        category: 'medical',
        message: 'Integration test concern'
      });

    expect(createRes.statusCode).toBe(201);
    concernId = createRes.body.data && createRes.body.data.id;

    // view concerns (route is /concerns/student)
    const viewRes = await request(app)
      .get('/concerns/student')
      .set('Authorization', `Bearer ${studentToken}`);
    
    expect(viewRes.statusCode).toBe(200);
    expect(Array.isArray(viewRes.body.data)).toBeTruthy();

    // doctor replies to concern
    const doctorLogin = await request(app).post('/login').send({ email: `int_doctor_${timestamp}@example.com`, password: pwd });
    const doctorToken = doctorLogin.body && doctorLogin.body.token;
    expect(doctorLogin.statusCode).toBe(200);

    const replyRes = await request(app)
      .post(`/concerns/${concernId}/reply`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ reply: 'This is a reply from doctor' });

    expect(replyRes.statusCode).toBe(200);
  }, 30000);
});