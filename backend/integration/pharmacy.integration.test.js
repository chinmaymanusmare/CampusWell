const request = require('supertest');
const pool = require('../src/config/db');
const app = require('../src/app');
const jwt = require('jsonwebtoken');

describe('Pharmacy integration tests', () => {
  let studentId;
  let medicineId;
  const testMedicineName = `Paracetamol_${Date.now()}`;

  beforeAll(async () => {
    // Clean up any existing test medicines first (in case previous runs failed)
    await pool.query("DELETE FROM order_medicines WHERE medicine_id IN (SELECT id FROM medicines WHERE name LIKE 'Paracetamol_%')");
    await pool.query("DELETE FROM medicines WHERE name LIKE 'Paracetamol_%'");
    
    // Clean up any existing test data in correct order to avoid FK violations
    await pool.query("DELETE FROM order_medicines WHERE order_id IN (SELECT id FROM orders WHERE student_id IN (SELECT id FROM users WHERE email = 'teststudent@example.com'))");
    await pool.query("DELETE FROM orders WHERE student_id IN (SELECT id FROM users WHERE email = 'teststudent@example.com')");
    await pool.query("DELETE FROM users WHERE email = 'teststudent@example.com'");
    
    // create tables assumed loaded by CI; insert a student and a medicine
    const userRes = await pool.query(
      `INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id`,
      ['Test Student', 'teststudent@example.com', 'hashedpwd', 'student']
    );
    studentId = userRes.rows[0].id;

    // Use unique medicine name to avoid conflicts and catch any errors
    try {
      const medRes = await pool.query(
        `INSERT INTO medicines (name, description, stock, price) VALUES ($1, $2, $3, $4) RETURNING id`,
        [testMedicineName, 'Pain reliever', 50, 10]
      );
      medicineId = medRes.rows[0].id;
    } catch (err) {
      // If insert fails due to duplicate, try to find existing medicine
      console.warn('Medicine insert failed, attempting to find existing:', err.message);
      const existing = await pool.query("SELECT id FROM medicines WHERE name = $1", [testMedicineName]);
      if (existing.rows.length > 0) {
        medicineId = existing.rows[0].id;
      } else {
        throw err;
      }
    }
  });

  afterAll(async () => {
    // Clean up all test-created data
    await pool.query("DELETE FROM order_medicines WHERE order_id IN (SELECT o.id FROM orders o JOIN users u ON o.student_id = u.id WHERE u.email LIKE '%@example.com')");
    await pool.query("DELETE FROM orders WHERE student_id IN (SELECT id FROM users WHERE email LIKE '%@example.com')");
    if (medicineId) {
      await pool.query('DELETE FROM medicines WHERE id = $1', [medicineId]);
    }
    await pool.query("DELETE FROM users WHERE email LIKE '%@example.com'");
  });

  test('student can place an order with prescription link', async () => {
    const token = jwt.sign({ id: studentId, role: 'student' }, process.env.JWT_SECRET || 'testsecret');

    const res = await request(app)
      .post('/pharmacy/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ 
        medicines: [{ medicine_id: medicineId, quantity: 2 }],
        prescription_link: 'https://example.com/presc.pdf' 
      });

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('order_id');
  });
});
