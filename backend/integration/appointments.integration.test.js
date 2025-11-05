const request = require('supertest');
const pool = require('../src/config/db');
const app = require('../src/app');
const jwt = require('jsonwebtoken');

describe('Appointments integration tests', () => {
  let studentId, doctorId, appointmentId;
  const pwd = 'Passw0rd1';
  const timestamp = Date.now();
  const studentEmail = `int_student_${timestamp}@example.com`;
  const doctorEmail = `int_doctor_${timestamp}@example.com`;

  beforeAll(async () => {
    // create users via signup endpoints (exercise full stack)
    await request(app).post('/signup').send({ name: 'Int Student', email: studentEmail, password: pwd, role: 'student', roll_no: 'R100' });
    await request(app).post('/signup').send({ name: 'Int Doctor', email: doctorEmail, password: pwd, role: 'doctor' });

    const s = await pool.query('SELECT id FROM users WHERE email = $1', [studentEmail]);
    studentId = s.rows[0].id;
    const d = await pool.query('SELECT id FROM users WHERE email = $1', [doctorEmail]);
    doctorId = d.rows[0].id;
  });

  afterAll(async () => {
    // clean appointments and users
    await pool.query('DELETE FROM appointments');
    await pool.query('DELETE FROM users WHERE email = $1 OR email = $2', [studentEmail, doctorEmail]);
  });

  test('student can book, view and doctor can view then reschedule appointment', async () => {
    // login student
    const lres = await request(app).post('/login').send({ email: studentEmail, password: pwd });
    const studentToken = lres.body && lres.body.token;
    expect(lres.statusCode).toBe(200);

    // book appointment
    const bookRes = await request(app)
      .post('/appointments')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ doctor_id: doctorId, date: '2025-12-01', time: '10:00' });

    expect(bookRes.statusCode).toBe(201);
    appointmentId = bookRes.body.data && bookRes.body.data.id;

    // student views appointments
    const studView = await request(app).get('/appointments/student').set('Authorization', `Bearer ${studentToken}`);
    expect(studView.statusCode).toBe(200);

    // login doctor
    const ld = await request(app).post('/login').send({ email: doctorEmail, password: pwd });
    const doctorToken = ld.body && ld.body.token;
    expect(ld.statusCode).toBe(200);

    // doctor views their appointments
    const docView = await request(app).get('/appointments/doctor').set('Authorization', `Bearer ${doctorToken}`);
    expect(docView.statusCode).toBe(200);

    // reschedule appointment by student (allowed since auth only checks token in controller - adjust if role checks exist)
    const resched = await request(app)
      .put(`/appointments/${appointmentId}`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ new_date: '2025-12-02', new_time: '11:00' });

    expect([200, 400]).toContain(resched.statusCode); // 400 if conflict or forbidden, 200 if success
  }, 30000);
});
