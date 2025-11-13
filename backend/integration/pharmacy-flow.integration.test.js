const request = require('supertest');
const pool = require('../src/config/db');
const app = require('../src/app');

describe('Pharmacy Complete Flow Integration', () => {
  const ts = Date.now();
  const studentEmail = `int_stud_${ts}@example.com`;
  const pharmacyEmail = `int_pharm_${ts}@example.com`;
  const testMedicineName = `Test_Medicine_${ts}`;
  let studentToken, pharmacyToken;
  let studentId, pharmacistId, medicineId, orderId;

  beforeAll(async () => {
    // Create users
    await request(app)
      .post('/api/signup')
      .send({
        name: 'Test Student',
        email: studentEmail,
        password: 'Passw0rd1',
        role: 'student',
        roll_no: 'R123'
      });

    await request(app)
      .post('/api/signup')
      .send({
        name: 'Test Pharmacist',
        email: pharmacyEmail,
        password: 'Passw0rd1',
        role: 'pharmacy'
      });

    // Login
    const sl = await request(app)
      .post('/api/login')
      .send({ email: studentEmail, password: 'Passw0rd1' });
    studentToken = sl.body.token;

    const pl = await request(app)
      .post('/api/login')
      .send({ email: pharmacyEmail, password: 'Passw0rd1' });
    pharmacyToken = pl.body.token;

    // Get IDs
    const users = await pool.query(
      'SELECT id, email FROM users WHERE email IN ($1, $2)',
      [studentEmail, pharmacyEmail]
    );
    users.rows.forEach(u => {
      if (u.email === studentEmail) studentId = u.id;
      else if (u.email === pharmacyEmail) pharmacistId = u.id;
    });

    // Clean up any existing test medicines first (in case previous runs failed)
    await pool.query("DELETE FROM order_medicines WHERE medicine_id IN (SELECT id FROM medicines WHERE name LIKE 'Test_Medicine_%')");
    await pool.query("DELETE FROM medicines WHERE name LIKE 'Test_Medicine_%'");
    
    // Clean up any existing test data in correct order to avoid FK violations
    await pool.query("DELETE FROM order_medicines WHERE order_id IN (SELECT id FROM orders WHERE student_id IN (SELECT id FROM users WHERE email LIKE 'int_stud_%@example.com'))");
    await pool.query("DELETE FROM orders WHERE student_id IN (SELECT id FROM users WHERE email LIKE 'int_stud_%@example.com')");
    
    // Add test medicine to inventory with unique name and catch any errors
    try {
      const medRes = await pool.query(
        `INSERT INTO medicines (name, description, stock, price)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [testMedicineName, 'For testing', 100, 50]
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
    // Clean up all test-created data including any lingering test users
    await pool.query("DELETE FROM order_medicines WHERE order_id IN (SELECT o.id FROM orders o JOIN users u ON o.student_id = u.id WHERE u.email LIKE 'int_stud_%@example.com')");
    await pool.query("DELETE FROM orders WHERE student_id IN (SELECT id FROM users WHERE email LIKE 'int_stud_%@example.com')");
    if (medicineId) {
      await pool.query('DELETE FROM medicines WHERE id = $1', [medicineId]);
    }
    await pool.query("DELETE FROM users WHERE email LIKE 'int_stud_%@example.com' OR email LIKE 'int_pharm_%@example.com'");
  });

  test('complete pharmacy flow: browse, order, update, notify', async () => {
    // Student browses inventory
    const browse = await request(app)
      .get('/pharmacy/inventory')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(browse.statusCode).toBe(200);
    expect(Array.isArray(browse.body.data)).toBe(true);
    expect(browse.body.data.some(m => m.name === testMedicineName)).toBe(true);

    // Student places order
    const order = await request(app)
      .post('/pharmacy/orders')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        medicines: [{ medicine_id: medicineId, quantity: 2 }],
        prescription_link: 'https://example.com/rx.pdf'
      });

    expect(order.statusCode).toBe(201);
    orderId = order.body.order_id;

    // Pharmacist views pending orders
    const pending = await request(app)
      .get('/pharmacy/orders')
      .set('Authorization', `Bearer ${pharmacyToken}`);

    expect(pending.statusCode).toBe(200);
    expect(pending.body.data.some(o => o.id === orderId)).toBe(true);

    // Pharmacist marks order ready
    const ready = await request(app)
      .put(`/pharmacy/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${pharmacyToken}`)
      .send({ status: 'ready' });

    expect(ready.statusCode).toBe(200);

    // Student views updated order (refresh token to avoid any transient issues)
    const sl2 = await request(app)
      .post('/api/login')
      .send({ email: studentEmail, password: 'Passw0rd1' });
    if (sl2.statusCode !== 200) {
      // eslint-disable-next-line no-console
      console.log('Re-login failed:', sl2.statusCode, sl2.body);
    }
    const studentToken2 = sl2.body.token;

    const check = await request(app)
      .get('/pharmacy/orders/student')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${studentToken2}`);

    // Debug output before assertion to capture response on failure
    if (check.statusCode !== 200) {
      // eslint-disable-next-line no-console
      console.log('Student orders response:', check.body, 'raw:', check.text);
    }
    expect(check.statusCode).toBe(200);
    const updatedOrder = check.body.data.find(o => o.id === orderId);
    expect(updatedOrder.status).toBe('ready');

    // Check inventory was updated
    const inventory = await request(app)
      .get('/pharmacy/inventory')
      .set('Authorization', `Bearer ${pharmacyToken}`);

    expect(inventory.statusCode).toBe(200);
    const medicine = inventory.body.data.find(m => m.id === medicineId);
    expect(medicine.stock).toBe(98); // original 100 - 2 ordered
  });
});
