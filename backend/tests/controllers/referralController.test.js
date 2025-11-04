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

  test('getStudentReferrals returns list', async () => {
    pool.query.mockResolvedValue({ rowCount: 2, rows: [{ id:1 }, { id:2 }] });
    await referralController.getStudentReferrals(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('updateReferralStatus returns 404 when not found', async () => {
    req.params.id = '1000';
    req.body.status = 'approved';
    pool.query.mockResolvedValueOnce({ rows: [] });
    await referralController.updateReferralStatus(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
