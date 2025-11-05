const request = require('supertest');
const pool = require('../src/config/db');
const app = require('../src/app');

describe('Records integration tests', () => {
  let studentId, doctorId, recordId;
  const pwd = 'Passw0rd1';
  const timestamp = Date.now();
  const studentEmail = `int_student_${timestamp}@example.com`;
  const doctorEmail = `int_doctor_${timestamp}@example.com`;

  beforeAll(async () => {
    // create student and doctor
    await request(app).post('/signup').send({ 
      name: 'Int Student', 
      email: studentEmail, 
      password: pwd, 
      role: 'student',
      roll_no: 'R103'
    });

    await request(app).post('/signup').send({ 
      name: 'Int Doctor', 
      email: doctorEmail, 
      password: pwd, 
      role: 'doctor' 
    });

    const s = await pool.query('SELECT id FROM users WHERE email = $1', [studentEmail]);
    studentId = s.rows[0].id;
    const d = await pool.query('SELECT id FROM users WHERE email = $1', [doctorEmail]);
    doctorId = d.rows[0].id;
  });

  afterAll(async () => {
    // clean records and users
    await pool.query('DELETE FROM medical_records WHERE student_id = $1', [studentId]);
    await pool.query('DELETE FROM users WHERE email IN ($1, $2)', [studentEmail, doctorEmail]);
  });

  test('doctor can create records and student can view them', async () => {
    // login doctor
    const doctorLogin = await request(app).post('/login').send({ email: doctorEmail, password: pwd });
    const doctorToken = doctorLogin.body && doctorLogin.body.token;
    expect(doctorLogin.statusCode).toBe(200);

    // doctor creates record
    const createRes = await request(app)
      .post('/records')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        student_id: studentId,
        diagnosis: 'Test Diagnosis',
        prescription: 'Test Prescription',
        notes: 'Test Notes'
      });

    expect(createRes.statusCode).toBe(201);
    recordId = createRes.body.data && createRes.body.data.id;

    // login student
    const studentLogin = await request(app).post('/login').send({ email: studentEmail, password: pwd });
    const studentToken = studentLogin.body && studentLogin.body.token;
    expect(studentLogin.statusCode).toBe(200);

    // student views records (route is /records/student)
    const viewRes = await request(app)
      .get('/records/student')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(viewRes.statusCode).toBe(200);
    expect(Array.isArray(viewRes.body.data)).toBeTruthy();
    expect(viewRes.body.data.length).toBeGreaterThan(0);
  }, 30000);
});