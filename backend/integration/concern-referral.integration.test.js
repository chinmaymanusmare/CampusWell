const request = require('supertest');
const pool = require('../src/config/db');
const app = require('../src/app');

describe('Concerns, Referrals & Health Records Integration', () => {
  const ts = Date.now();
  const studentEmail = `int_stud_${ts}@example.com`;
  const doctorEmail = `int_doc_${ts}@example.com`;
  const doctor2Email = `int_doc2_${ts}@example.com`;
  let studentToken, doctorToken, doctor2Token;
  let studentId, doctorId, doctor2Id, concernId, referralId;

  beforeAll(async () => {
    // Create users and store their responses
    const student = await request(app)
      .post('/signup')
      .send({
        name: 'Test Student',
        email: studentEmail,
        password: 'Passw0rd1',
        role: 'student',
        roll_no: 'R123'
      });
    expect(student.statusCode).toBe(201);

    const doctor = await request(app)
      .post('/signup')
      .send({
        name: 'Test Doctor',
        email: doctorEmail,
        password: 'Passw0rd1',
        role: 'doctor',
        specialization: 'mental-health',
        timePerPatient: 30
      });
    expect(doctor.statusCode).toBe(201);

    const doctor2 = await request(app)
      .post('/signup')
      .send({
        name: 'Test Doctor 2',
        email: doctor2Email,
        password: 'Passw0rd1',
        role: 'doctor',
        specialization: 'gynac',
        timePerPatient: 30
      });
    expect(doctor2.statusCode).toBe(201);

    // After signup, immediately get IDs from DB
    const userIds = await pool.query(
      'SELECT id FROM users WHERE email IN ($1, $2, $3)',
      [studentEmail, doctorEmail, doctor2Email]
    );

    const [studentRecord, doctorRecord, doctor2Record] = userIds.rows;
    studentId = studentRecord.id;
    doctorId = doctorRecord.id;
    doctor2Id = doctor2Record.id;

    // Login to get fresh tokens
    const sl = await request(app)
      .post('/login')
      .send({ email: studentEmail, password: 'Passw0rd1' });
    expect(sl.statusCode).toBe(200);
    studentToken = sl.body.token;

    const dl = await request(app)
      .post('/login')
      .send({ email: doctorEmail, password: 'Passw0rd1' });
    expect(dl.statusCode).toBe(200);
    doctorToken = dl.body.token;

    const dl2 = await request(app)
      .post('/login')
      .send({ email: doctor2Email, password: 'Passw0rd1' });
    expect(dl2.statusCode).toBe(200);
    doctor2Token = dl2.body.token;

    // Get user IDs
    const users = await pool.query(
      'SELECT id, email FROM users WHERE email IN ($1, $2, $3)',
      [studentEmail, doctorEmail, doctor2Email]
    );
    users.rows.forEach(u => {
      if (u.email === studentEmail) studentId = u.id;
      else if (u.email === doctorEmail) doctorId = u.id;
      else if (u.email === doctor2Email) doctor2Id = u.id;
    });
  });

  afterAll(async () => {
    // Clean up all test data including any lingering records
    await pool.query("DELETE FROM concerns WHERE student_id IN (SELECT id FROM users WHERE email LIKE 'int_stud_%@example.com')");
    await pool.query("DELETE FROM referrals WHERE student_id IN (SELECT id FROM users WHERE email LIKE 'int_stud_%@example.com')");
    await pool.query("DELETE FROM prescriptions WHERE student_id IN (SELECT id FROM users WHERE email LIKE 'int_stud_%@example.com')");
    await pool.query("DELETE FROM users WHERE email LIKE 'int_stud_%@example.com' OR email LIKE 'int_doc_%@example.com'");
  });

  describe('Anonymous Concerns Flow', () => {
    test('student can submit concern and doctor can respond while keeping student anonymous', async () => {
      // Student submits concern
      const concern = await request(app)
        .post('/concerns')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          category: 'mental-health',
          message: 'Test concern message'
        });

      expect(concern.statusCode).toBe(201);
      concernId = concern.body.data.id;

      // Doctor views assigned concerns
      const docView = await request(app)
        .get('/concerns/doctor')
        .set('Authorization', `Bearer ${doctorToken}`);

      expect(docView.statusCode).toBe(200);
      expect(docView.body.data.some(c => c.message === 'Test concern message')).toBe(true);
      // Verify anonymity - doctor shouldn't see student details
      const concernDetail = docView.body.data.find(c => c.message === 'Test concern message');
      expect(concernDetail).not.toHaveProperty('student_id');
      expect(concernDetail).not.toHaveProperty('student_name');

      // Doctor replies
      const reply = await request(app)
        .post(`/concerns/${concernId}/reply`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({ reply: 'Test doctor reply' });

      expect(reply.statusCode).toBe(200);

      // Student views response (should see doctor name)
      const studView = await request(app)
        .get('/concerns/student')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(studView.statusCode).toBe(200);
      const responded = studView.body.data.find(c => c.id === concernId);
      expect(responded.response).toBe('Test doctor reply');
      expect(responded.responded_by).toBeTruthy();
    });
  });

  describe('Referral Flow', () => {
    test('complete referral flow: request, review, and approval', async () => {
      // Student requests referral
      const ref = await request(app)
        .post('/referrals/request')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ reason: 'Test referral reason' });

      expect(ref.statusCode).toBe(201);
      referralId = ref.body.data.id;

      // Doctor views pending referrals
      const docView = await request(app)
        .get('/referrals/doctor')
        .set('Authorization', `Bearer ${doctorToken}`);

      expect(docView.statusCode).toBe(200);
      expect(docView.body.data.some(r => r.reason === 'Test referral reason')).toBe(true);

      // Doctor approves referral
      const approve = await request(app)
        .put(`/referrals/${referralId}/approve`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({ status: 'approved' });

      expect(approve.statusCode).toBe(200);

      // Student checks referral status
      const studView = await request(app)
        .get('/referrals/student')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(studView.statusCode).toBe(200);
      const updated = studView.body.data.find(r => r.id === referralId);
      expect(updated.status).toBe('approved');
    });
  });

  describe('Prescription & Health Records', () => {
    test('specialized records visibility based on doctor specialization', async () => {
      // First doctor creates specialized record
      const addSpec = await request(app)
        .post('/records')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          student_id: studentId,
          diagnosis: 'Mental health diagnosis',
          notes: 'Specialized notes',
          medicines: 'Med A, Med B',
          category: 'specialized'
        });

      expect(addSpec.statusCode).toBe(201);

      // Second doctor (different specialization) shouldn't see specialized record
      const viewOther = await request(app)
        .get(`/records/doctor/${studentId}`)
        .set('Authorization', `Bearer ${doctor2Token}`);

      expect(viewOther.statusCode).toBe(200);
      expect(viewOther.body.data.some(r => r.diagnosis === 'Mental health diagnosis')).toBe(false);

      // First doctor adds general record
      const addGen = await request(app)
        .post('/records')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          student_id: studentId,
          diagnosis: 'General checkup',
          notes: 'General notes',
          medicines: 'Vitamin C',
          category: 'general'
        });

      expect(addGen.statusCode).toBe(201);

      // Second doctor should see general record
      const viewGen = await request(app)
        .get(`/records/doctor/${studentId}`)
        .set('Authorization', `Bearer ${doctor2Token}`);

      expect(viewGen.statusCode).toBe(200);
      expect(viewGen.body.data.some(r => r.diagnosis === 'General checkup')).toBe(true);

      // Student should see all their records
      const studView = await request(app)
        .get('/records/student')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(studView.statusCode).toBe(200);
      expect(studView.body.data.some(r => r.diagnosis === 'Mental health diagnosis')).toBe(true);
      expect(studView.body.data.some(r => r.diagnosis === 'General checkup')).toBe(true);
    });
  });
});