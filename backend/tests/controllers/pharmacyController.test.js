jest.mock('../../src/config/db', () => ({ query: jest.fn(), connect: jest.fn() }));

const { placeOrder } = require('../../src/controllers/pharmacyController');
const pool = require('../../src/config/db');

describe('pharmacyController.placeOrder', () => {
  let req, res;

  beforeEach(() => {
    req = { user: { id: 10 }, body: { medicine_id: 2, quantity: 1, prescription_link: 'https://example.com/presc.pdf' } };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    pool.query.mockReset();
  });

  test('stores prescription_link when provided', async () => {
    // Mock sequence of DB calls
    pool.query
      .mockResolvedValueOnce({ rows: [{ name: 'Student A' }] }) // user name
      .mockResolvedValueOnce({ rows: [{ id: 2, stock: 10, price: 50 }] }) // medicine
      .mockResolvedValueOnce({ rows: [{ id: 123 }] }) // insert order returns id
      .mockResolvedValue({}); // subsequent calls

    await placeOrder(req, res);

    // Find the call which inserts into orders
    const insertCall = pool.query.mock.calls.find(call => /INSERT INTO orders/i.test(call[0]));
    expect(insertCall).toBeDefined();
    // parameters [studentId, studentName, total, prescription_link]
    const params = insertCall[1];
    expect(params[0]).toBe(10);
    expect(params[3]).toBe('https://example.com/presc.pdf');

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, order_id: expect.any(Number) }));
  });
});
