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
    // suppress console.error from error-path tests
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
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

    test('returns 400 when doctor missing timePerPatient', async () => {
      req.body = { name: 'Dr', email: 'dr@test.com', password: 'validPass123', role: 'doctor' };
      await signup(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, message: expect.stringContaining('Time per patient is required for doctors') }));
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

    test('returns 400 when updating doctor with invalid timePerPatient', async () => {
      req.params.id = '1';
      req.body = { name: 'Doc', email: 'doc@test.com', role: 'doctor', timePerPatient: 0 };
      await updateUserById(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, message: expect.stringContaining('Time per patient is required for doctors') }));
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

  describe('updateTimePerPatient', () => {
    test('returns 400 when timePerPatient invalid', async () => {
      req.user = { id: 10 };
      req.body = { timePerPatient: 0 };
      await require('../../src/controllers/userController').updateTimePerPatient(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('returns 403 when user is not a doctor', async () => {
      req.user = { id: 11 };
      req.body = { timePerPatient: 15 };
      // doctorCheck returns non-doctor
      pool.query.mockResolvedValueOnce({ rows: [{ role: 'student' }] });

      await require('../../src/controllers/userController').updateTimePerPatient(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    test('successfully updates timePerPatient and notes availability impact', async () => {
      req.user = { id: 12 };
      req.body = { timePerPatient: 20 };

      // Sequence of DB calls in updateTimePerPatient:
      // 1) doctorCheck -> rows: [{ role: 'doctor' }]
      // 2) update -> rows: [{ id:12, name: 'Dr X', time_per_patient: 20 }]
      // 3) availabilityCheck -> rows: [{ count: '3' }]
      pool.query
        .mockResolvedValueOnce({ rows: [{ role: 'doctor' }] })
        .mockResolvedValueOnce({ rows: [{ id:12, name: 'Dr X', time_per_patient: 20 }] })
        .mockResolvedValueOnce({ rows: [{ count: '3' }] });

      await require('../../src/controllers/userController').updateTimePerPatient(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, message: expect.stringContaining('affect your existing availability slots'), data: expect.any(Object) }));
    });
  });

  describe('error and edge catch paths', () => {
    test('signup handles DB errors with 500', async () => {
      req.body = { name: 'Err', email: 'err@test.com', password: 'validPass123' };
      pool.query.mockRejectedValueOnce(new Error('DB failure'));
      await signup(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });

    test('login handles DB errors with 500', async () => {
      req.body = { email: 'x@test.com', password: 'pass' };
      pool.query.mockRejectedValueOnce(new Error('DB fail'));
      await login(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });

    test('getUserById handles DB errors with 500', async () => {
      req.params.id = '1';
      pool.query.mockRejectedValueOnce(new Error('DB fail'));
      await getUserById(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });

    test('getAllUsersForAdmin handles DB errors with 500', async () => {
      pool.query.mockRejectedValueOnce(new Error('DB fail'));
      await getAllUsersForAdmin(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });

    test('updateUserById handles DB errors with 500', async () => {
      req.params.id = '1';
      req.body = { name: 'A' };
      pool.query.mockRejectedValueOnce(new Error('DB fail'));
      await updateUserById(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });

    test('updateTimePerPatient returns 404 when update returns no rows (doctor not found)', async () => {
      req.user = { id: 20 };
      req.body = { timePerPatient: 15 };
      pool.query
        .mockResolvedValueOnce({ rows: [{ role: 'doctor' }] }) // doctorCheck
        .mockResolvedValueOnce({ rows: [] }); // update returns no rows

      await require('../../src/controllers/userController').updateTimePerPatient(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
});
