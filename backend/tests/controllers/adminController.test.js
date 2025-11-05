jest.mock('../../src/config/db', () => ({ query: jest.fn(), connect: jest.fn() }));

const adminController = require('../../src/controllers/adminController');
const pool = require('../../src/config/db');

describe('adminController', () => {
  let req, res;

  beforeEach(() => {
    req = {};
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    pool.query.mockReset();
  });

  test('getOverview returns counts', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ count: '10' }] })
      .mockResolvedValueOnce({ rows: [{ count: '3' }] })
      .mockResolvedValueOnce({ rows: [{ count: '6' }] })
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })
      .mockResolvedValueOnce({ rows: [{ count: '5' }] })
      .mockResolvedValueOnce({ rows: [{ count: '2' }] })
      .mockResolvedValueOnce({ rows: [{ count: '20' }] });
    await adminController.getOverview(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: expect.any(Object) }));
  });

  test('getAllUsers returns list', async () => {
    pool.query.mockResolvedValue({ rowCount: 2, rows: [{ id:1, name:'A' }, { id:2, name:'B' }] });
    await adminController.getAllUsers(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, count: 2, data: [{ id:1, name:'A' }, { id:2, name:'B' }] }));
  });

  test('getAllAppointments returns appointments', async () => {
    pool.query.mockResolvedValue({ rowCount: 1, rows: [{ id:1, student_name:'A', doctor_name:'D' }] });
    await adminController.getAllAppointments(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, count: 1, data: [{ id:1, student_name:'A', doctor_name:'D' }] }));
  });
  test('getInventorySummary returns inventory', async () => {
    pool.query.mockResolvedValue({ rowCount: 2, rows: [{ id:1, name:'MedA', stock:10, price:5 }, { id:2, name:'MedB', stock:20, price:10 }] });
    await adminController.getInventorySummary(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, count: 2, data: [{ id:1, name:'MedA', stock:10, price:5 }, { id:2, name:'MedB', stock:20, price:10 }] }));
  });
});
