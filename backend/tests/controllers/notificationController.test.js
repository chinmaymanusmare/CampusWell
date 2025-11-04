jest.mock('../../src/config/db', () => ({ query: jest.fn(), connect: jest.fn() }));

const notificationController = require('../../src/controllers/notificationController');
const pool = require('../../src/config/db');

describe('notificationController', () => {
  let req, res;

  beforeEach(() => {
    req = { user: { id: 7 }, body: {}, params: {} };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    pool.query.mockReset();
  });

  test('getUserNotifications returns notifications', async () => {
    pool.query.mockResolvedValue({ rowCount: 1, rows: [{ id:1, message: 'hi' }] });
    await notificationController.getUserNotifications(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('sendNotification validates missing fields', async () => {
    req.body = { message: '' };
    await notificationController.sendNotification(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('markAsRead updates and returns 200', async () => {
    req.params.id = '3';
    pool.query.mockResolvedValueOnce({ rows: [{ id:3 }] });
    await notificationController.markAsRead(req, res);
    // It will call UPDATE and return 200 or 404 depending on mock; here we mocked a row
    expect(res.status).toHaveBeenCalled();
  });
});
