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
      .mockResolvedValueOnce({ rows: [{ name: 'Dr Z', specialization: 'gynac' }] }) // doctor name + specialization
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

  test('getPrescriptionById returns 200 when found', async () => {
    req.params.id = '1';
    pool.query.mockResolvedValue({ rows: [{ id: 1, student_id: 2 }] });
    await recordController.getPrescriptionById(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  test('getStudentRecordForDoctor returns data', async () => {
    req.params.studentId = '5';
    // first call returns doctor's specialization, second returns prescription rows
    pool.query.mockResolvedValueOnce({ rows: [{ specialization: 'gynac' }] })
      .mockResolvedValueOnce({ rowCount: 2, rows: [{ id: 1 }, { id: 2 }] });
    await recordController.getStudentRecordForDoctor(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  test('updatePrescription returns 200 when updated', async () => {
    req.params.id = '10';
    req.body = { medicines: 'A', diagnosis: 'B', notes: 'C' };
    pool.query.mockResolvedValue({ rows: [{ id: 10 }] });
    await recordController.updatePrescription(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  test('updatePrescription returns 404 when not found', async () => {
    req.params.id = '10';
    req.body = { medicines: 'A', diagnosis: 'B', notes: 'C' };
    pool.query.mockResolvedValue({ rows: [] });
    await recordController.updatePrescription(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });
});
