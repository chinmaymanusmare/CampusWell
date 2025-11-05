const request = require('supertest');
const pool = require('../src/config/db');
const app = require('../src/app');

describe('Referrals integration tests', () => {
  let studentId, doctorId, specialistId, referralId;
  const pwd = 'Passw0rd1';
  const timestamp = Date.now();
  const studentEmail = `int_student_${timestamp}@example.com`;
  const doctorEmail = `int_doctor_${timestamp}@example.com`;
  const specialistEmail = `int_specialist_${timestamp}@example.com`;

  beforeAll(async () => {
    // create users
    await request(app).post('/signup').send({ 
      name: 'Int Student', 
      email: studentEmail, 
      password: pwd, 
      role: 'student',
      roll_no: 'R104'
    });

    await request(app).post('/signup').send({ 
      name: 'Int Doctor', 
      email: doctorEmail, 
      password: pwd, 
      role: 'doctor' 
    });

    await request(app).post('/signup').send({ 
      name: 'Int Specialist', 
      email: specialistEmail, 
      password: pwd, 
      role: 'doctor' 
    });

    const s = await pool.query('SELECT id FROM users WHERE email = $1', [studentEmail]);
    studentId = s.rows[0].id;
    const d = await pool.query('SELECT id FROM users WHERE email = $1', [doctorEmail]);
    doctorId = d.rows[0].id;
    const sp = await pool.query('SELECT id FROM users WHERE email = $1', [specialistEmail]);
    specialistId = sp.rows[0].id;
  });

  afterAll(async () => {
    // clean referrals and users
    await pool.query('DELETE FROM referrals WHERE student_id = $1', [studentId]);
    await pool.query('DELETE FROM users WHERE email IN ($1, $2, $3)', [studentEmail, doctorEmail, specialistEmail]);
  });

  test('student can request a referral and doctor can update its status', async () => {
    // login student (creator)
    const studentLogin = await request(app).post('/login').send({ email: studentEmail, password: pwd });
    const studentToken = studentLogin.body && studentLogin.body.token;
    expect(studentLogin.statusCode).toBe(200);

    // student creates referral request
    const createRes = await request(app)
      .post('/referrals/request')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        reason: 'Test Referral - integration'
      });

    expect(createRes.statusCode).toBe(201);
    referralId = createRes.body.data && createRes.body.data.id;

    // login doctor
    const doctorLogin = await request(app).post('/login').send({ email: doctorEmail, password: pwd });
    const doctorToken = doctorLogin.body && doctorLogin.body.token;
    expect(doctorLogin.statusCode).toBe(200);

    // doctor approves referral
    const updateRes = await request(app)
      .put(`/referrals/${referralId}/approve`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        status: 'approved'
      });

    expect(updateRes.statusCode).toBe(200);

    // student views referrals
    const viewRes = await request(app)
      .get('/referrals/student')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(viewRes.statusCode).toBe(200);
    expect(Array.isArray(viewRes.body.data)).toBeTruthy();
    expect(viewRes.body.data.length).toBeGreaterThan(0);
  }, 30000);
});