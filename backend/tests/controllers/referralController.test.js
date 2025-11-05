jest.mock('../../src/config/db', () => ({ query: jest.fn(), connect: jest.fn() }));

const referralController = require('../../src/controllers/referralController');
const pool = require('../../src/config/db');

describe('referralController', () => {
  let req, res;

  beforeEach(() => {
    req = { user: { id: 12 }, body: {}, params: {} };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    pool.query.mockReset();
  });

  test('requestReferral creates referral when student exists', async () => {
    req.body = { reason: 'test' };
    pool.query
      .mockResolvedValueOnce({ rows: [{ name: 'Student Name' }] }) // userResult
      .mockResolvedValueOnce({ rows: [{ id: 77 }] }); // insert

    await referralController.requestReferral(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('requestReferral returns 404 if student not found', async () => {
    req.body = { reason: 'test' };
    pool.query.mockResolvedValueOnce({ rows: [] });
    await referralController.requestReferral(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  test('getStudentReferrals returns list', async () => {
    pool.query.mockResolvedValue({ rowCount: 2, rows: [{ id:1 }, { id:2 }] });
    await referralController.getStudentReferrals(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('getPendingReferralsForDoctor returns list', async () => {
    pool.query.mockResolvedValue({ rowCount: 1, rows: [{ id: 1 }] });
    await referralController.getPendingReferralsForDoctor(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  test('updateReferralStatus returns 404 when not found', async () => {
    req.params.id = '1000';
    req.body.status = 'approved';
    pool.query.mockResolvedValueOnce({ rows: [] });
    await referralController.updateReferralStatus(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('updateReferralStatus returns 200 when updated', async () => {
    req.params.id = '1000';
    req.body.status = 'approved';
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 1000 }] }) // referral exists
      .mockResolvedValueOnce({ rows: [{ name: 'Dr X' }] }) // doctor name
      .mockResolvedValueOnce({ rows: [{ id: 1000 }] }); // update result
    await referralController.updateReferralStatus(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });
});
