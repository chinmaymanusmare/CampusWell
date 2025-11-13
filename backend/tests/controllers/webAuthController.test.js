const webAuth = require('../../src/controllers/webAuthController');

jest.mock('../../src/config/db', () => ({
  query: jest.fn(),
  connect: jest.fn(),
  end: jest.fn().mockResolvedValue()
}));

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn()
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn()
}));

const pool = require('../../src/config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const mockRes = () => {
  const res = {};
  res.cookie = jest.fn().mockReturnValue(res);
  res.clearCookie = jest.fn().mockReturnValue(res);
  res.redirect = jest.fn();
  res.status = jest.fn(function (code) { this.statusCode = code; return this; });
  res.send = jest.fn();
  res.set = jest.fn();
  return res;
};

describe('webAuthController - webLogin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 400 for unknown user', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const req = { body: { email: 'x@x.com', password: 'pass' } };
    const res = mockRes();
    await webAuth.webLogin(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalled();
  });

  test('returns 400 for role mismatch', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 1, email: 'x', password: 'hash', role: 'student' }] });
    const req = { body: { email: 'x@x.com', password: 'pass', role: 'doctor' } };
    const res = mockRes();
    await webAuth.webLogin(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalled();
  });

  test('returns 400 for invalid password', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 1, email: 'x', password: 'hash', role: 'student' }] });
    bcrypt.compare.mockResolvedValueOnce(false);
    const req = { body: { email: 'x@x.com', password: 'bad' } };
    const res = mockRes();
    await webAuth.webLogin(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalled();
  });

  test('sets cookie and redirects on success', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 42, email: 'x', password: 'hash', role: 'student' }] });
    bcrypt.compare.mockResolvedValueOnce(true);
    jwt.sign.mockReturnValue('tok123');
    const req = { body: { email: 'x@x.com', password: 'good' } };
    const res = mockRes();
    await webAuth.webLogin(req, res);
    expect(res.cookie).toHaveBeenCalledWith('token', 'tok123', expect.any(Object));
    expect(res.redirect).toHaveBeenCalledWith('/users/42');
  });
});

describe('webAuthController - webSignup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 400 when password missing', async () => {
    const req = { body: { name: 'A', email: 'a@a.com' } };
    const res = mockRes();
    await webAuth.webSignup(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalled();
  });

  test('returns 400 for weak password', async () => {
    const req = { body: { name: 'A', email: 'a@a.com', password: 'short' } };
    const res = mockRes();
    await webAuth.webSignup(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('returns 400 if user exists', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    const req = { body: { name: 'A', email: 'a@a.com', password: 'Passw0rd1' } };
    const res = mockRes();
    await webAuth.webSignup(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('creates student, sets cookie and redirects', async () => {
    // First SELECT existing user -> none
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      // INSERT new user returns id + role student
      .mockResolvedValueOnce({ rows: [{ id: 77, role: 'student' }] });

    bcrypt.hash.mockResolvedValueOnce('hashed');
    jwt.sign.mockReturnValue('tokWeb');

    const req = { body: { name: 'A', email: 'a@a.com', password: 'Passw0rd1', roll_no: 'R1' } };
    const res = mockRes();
    await webAuth.webSignup(req, res);
    expect(pool.query).toHaveBeenCalledTimes(2);
    expect(res.cookie).toHaveBeenCalledWith('token', 'tokWeb', expect.any(Object));
    expect(res.redirect).toHaveBeenCalledWith('/users/77');
  });
});

describe('webAuthController - webLogout', () => {
  test('clears cookie and redirects to /login', () => {
    const req = {};
    const res = mockRes();
    webAuth.webLogout(req, res);
    expect(res.clearCookie).toHaveBeenCalledWith('token', expect.any(Object));
    expect(res.set).toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('/login');
  });
});
