jest.mock('../../src/config/db', () => ({ query: jest.fn(), connect: jest.fn() }));

const recordController = require('../../src/controllers/recordController');
const pool = require('../../src/config/db');

describe('recordController', () => {
  let req, res;

  beforeEach(() => {
    req = { user: { id: 11 }, params: {}, body: {} };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    pool.query.mockReset();
  });

  test('getStudentRecords returns data', async () => {
    pool.query.mockResolvedValue({ rowCount: 1, rows: [{ id: 1 }] });
    await recordController.getStudentRecords(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('addHealthRecord inserts and returns 201', async () => {
    req.user.id = 4; // doctor id
    req.body = { student_id: 9, diagnosis: 'X', notes: 'Y' };
    pool.query
      .mockResolvedValueOnce({ rows: [{ name: 'Dr Z' }] }) // doctor name
      .mockResolvedValueOnce({ rows: [{ id: 55 }] }); // insert result

    await recordController.addHealthRecord(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('getPrescriptionById returns 404 when missing', async () => {
    req.params.id = '999';
    pool.query.mockResolvedValue({ rows: [] });
    await recordController.getPrescriptionById(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
