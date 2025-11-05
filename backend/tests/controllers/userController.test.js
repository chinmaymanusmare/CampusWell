jest.mock('../../src/config/db', () => ({ query: jest.fn(), connect: jest.fn() }));
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashedPassword123'),
  compare: jest.fn().mockResolvedValue(true)
}));
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mockToken123')
}));

const { signup, login, getUserById, getAllUsersForAdmin, updateUserById, logout } = require('../../src/controllers/userController');
const pool = require('../../src/config/db');
const bcrypt = require('bcrypt');

describe('User Controller', () => {
  let req, res;

  beforeEach(() => {
    req = { 
      body: {},
      params: {},
    };
    res = { 
      status: jest.fn().mockReturnThis(), 
      json: jest.fn(),
      clearCookie: jest.fn()
    };
    pool.query.mockReset();
    bcrypt.compare.mockReset();
  });

  describe('signup', () => {
    test('returns 400 when password is missing', async () => {
      req.body = { name: 'A', email: 'a@a.com' };
      await signup(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ 
        success: false, 
        message: 'Password is required' 
      }));
    });

    test('returns 400 when password does not meet policy', async () => {
      req.body = { name: 'A', email: 'a@a.com', password: 'short1' };
      await signup(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ 
        success: false, 
        message: expect.stringContaining('Password must be at least 8 characters') 
      }));
    });

    test('returns 400 when user already exists', async () => {
      req.body = { 
        name: 'John', 
        email: 'john@test.com', 
        password: 'validPass123' 
      };
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await signup(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ 
        success: false, 
        message: 'User already exists' 
      });
    });

    test('successfully creates new user', async () => {
      const userData = {
        name: 'John',
        email: 'john@test.com',
        password: 'validPass123',
        role: 'student',
        roll_no: '123456',
        specialization: null
      };
      req.body = userData;

      pool.query
        .mockResolvedValueOnce({ rows: [] }) // No existing user
        .mockResolvedValueOnce({ rows: [userData] }); // Insert successful

      await signup(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        user: userData
      });
    });

  });

  describe('login', () => {
    test('successfully logs in user', async () => {
      req.body = {
        email: 'john@test.com',
        password: 'validPass123'
      };
      pool.query.mockResolvedValueOnce({
        rows: [{ id: 1, email: 'john@test.com', password: 'hashedpass', role: 'student' }]
      });
      bcrypt.compare.mockResolvedValueOnce(true);

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        token: expect.any(String)
      });
    });

    test('returns 400 for non-existent user', async () => {
      req.body = {
        email: 'nonexistent@test.com',
        password: 'validPass123'
      };
      pool.query.mockResolvedValueOnce({ rows: [] });

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid credentials'
      });
    });

    test('returns 400 for incorrect password', async () => {
      req.body = {
        email: 'john@test.com',
        password: 'wrongpass'
      };
      pool.query.mockResolvedValueOnce({
        rows: [{ id: 1, email: 'john@test.com', password: 'hashedpass' }]
      });
      bcrypt.compare.mockResolvedValueOnce(false);

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid credentials'
      });
    });

  });

  describe('getUserById', () => {
    test('successfully retrieves user', async () => {
      req.params.id = '1';
      const userData = {
        id: 1,
        name: 'John',
        email: 'john@test.com',
        role: 'student'
      };
      pool.query.mockResolvedValueOnce({ rows: [userData] });

      await getUserById(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: userData
      });
    });

    test('returns 404 for non-existent user', async () => {
      req.params.id = '999';
      pool.query.mockResolvedValueOnce({ rows: [] });

      await getUserById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'User not found'
      });
    });

  });

  describe('getAllUsersForAdmin', () => {
    test('successfully retrieves all users', async () => {
      const users = [
        { id: 1, name: 'John', email: 'john@test.com' },
        { id: 2, name: 'Jane', email: 'jane@test.com' }
      ];
      pool.query.mockResolvedValueOnce({ rows: users, rowCount: 2 });

      await getAllUsersForAdmin(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 2,
        data: users
      });
    });

  });

  describe('updateUserById', () => {
    test('successfully updates user', async () => {
      req.params.id = '1';
      const updateData = {
        name: 'John Updated',
        email: 'john.updated@test.com',
        role: 'student',
        roll_no: '123457',
        specialization: 'Computer Science'
      };
      req.body = updateData;
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1, ...updateData }] });

      await updateUserById(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining(updateData)
      });
    });

    test('returns 404 for non-existent user', async () => {
      req.params.id = '999';
      req.body = {
        name: 'John Updated',
        email: 'john.updated@test.com'
      };
      pool.query.mockResolvedValueOnce({ rows: [] });

      await updateUserById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'User not found'
      });
    });

  });

  describe('logout', () => {
    test('successfully logs out user', () => {
      logout(req, res);

      expect(res.clearCookie).toHaveBeenCalledWith('refreshToken');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Logged out successfully'
      });
    });
  });
});
