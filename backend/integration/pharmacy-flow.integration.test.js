const request = require('supertest');
const pool = require('../src/config/db');
const app = require('../src/app');

describe('Pharmacy Complete Flow Integration', () => {
  const ts = Date.now();
  const studentEmail = `int_stud_${ts}@example.com`;
  const pharmacyEmail = `int_pharm_${ts}@example.com`;
  let studentToken, pharmacyToken;
  let studentId, pharmacistId, medicineId, orderId;

  beforeAll(async () => {
    // Create users
    await request(app)
      .post('/signup')
      .send({
        name: 'Test Student',
        email: studentEmail,
        password: 'Passw0rd1',
        role: 'student',
        roll_no: 'R123'
      });

    await request(app)
      .post('/signup')
      .send({
        name: 'Test Pharmacist',
        email: pharmacyEmail,
        password: 'Passw0rd1',
        role: 'pharmacy'
      });

    // Login
    const sl = await request(app)
      .post('/login')
      .send({ email: studentEmail, password: 'Passw0rd1' });
    studentToken = sl.body.token;

    const pl = await request(app)
      .post('/login')
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

    // Add test medicine to inventory
    const medRes = await pool.query(
      `INSERT INTO medicines (name, description, stock, price)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      ['Test Medicine', 'For testing', 100, 50]
    );
    medicineId = medRes.rows[0].id;
  });

  afterAll(async () => {
    // Clean up only test-created data
    if (orderId) {
      await pool.query('DELETE FROM order_medicines WHERE order_id = $1', [orderId]);
      await pool.query('DELETE FROM orders WHERE id = $1', [orderId]);
    }
    if (medicineId) {
      await pool.query('DELETE FROM medicines WHERE id = $1', [medicineId]);
    }
    await pool.query('DELETE FROM users WHERE email IN ($1, $2)', [studentEmail, pharmacyEmail]);
  });

  test('complete pharmacy flow: browse, order, update, notify', async () => {
    // Student browses inventory
    const browse = await request(app)
      .get('/pharmacy/inventory')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(browse.statusCode).toBe(200);
    expect(browse.body.data.some(m => m.name === 'Test Medicine')).toBe(true);

    // Student places order
    const order = await request(app)
      .post('/pharmacy/orders')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        medicine_id: medicineId,
        quantity: 2,
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

    // Student views updated order
    const check = await request(app)
      .get('/pharmacy/orders/student')
      .set('Authorization', `Bearer ${studentToken}`);

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