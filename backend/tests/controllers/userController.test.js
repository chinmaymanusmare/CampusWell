jest.mock('../../src/config/db', () => ({ query: jest.fn(), connect: jest.fn() }));

const { signup } = require('../../src/controllers/userController');
const pool = require('../../src/config/db');

describe('userController.signup validation', () => {
  let req, res;

  beforeEach(() => {
    req = { body: {} };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    pool.query.mockReset();
  });

  test('returns 400 when password is missing', async () => {
    req.body = { name: 'A', email: 'a@a.com' };
    await signup(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, message: 'Password is required' }));
  });

  test('returns 400 when password does not meet policy', async () => {
    req.body = { name: 'A', email: 'a@a.com', password: 'short1' };
    await signup(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, message: expect.stringContaining('Password must be at least 8 characters') }));
  });
});
