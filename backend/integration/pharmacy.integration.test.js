const request = require('supertest');
const pool = require('../../src/config/db');
const app = require('../../src/app');
const jwt = require('jsonwebtoken');

describe('Pharmacy integration tests', () => {
  let studentId;
  let medicineId;

  beforeAll(async () => {
    // create tables assumed loaded by CI; insert a student and a medicine
    const userRes = await pool.query(
      `INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id`,
      ['Test Student', 'teststudent@example.com', 'hashedpwd', 'student']
    );
    studentId = userRes.rows[0].id;

    const medRes = await pool.query(
      `INSERT INTO medicines (name, description, stock, price) VALUES ($1, $2, $3, $4) RETURNING id`,
      ['Paracetamol', 'Pain reliever', 50, 10]
    );
    medicineId = medRes.rows[0].id;
  });

  afterAll(async () => {
    // clean up
    await pool.query('DELETE FROM order_medicines');
    await pool.query('DELETE FROM orders');
    await pool.query('DELETE FROM medicines');
    await pool.query('DELETE FROM users');
  });

  test('student can place an order with prescription link', async () => {
    const token = jwt.sign({ id: studentId, role: 'student' }, process.env.JWT_SECRET || 'testsecret');

    const res = await request(app)
      .post('/pharmacy/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ medicine_id: medicineId, quantity: 2, prescription_link: 'https://example.com/presc.pdf' });

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('order_id');
  });
});
