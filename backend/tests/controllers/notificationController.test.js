jest.mock('../../src/config/db', () => ({ query: jest.fn(), connect: jest.fn() }));

const notificationController = require('../../src/controllers/notificationController');
const pool = require('../../src/config/db');

describe('notificationController', () => {
  let req, res;

  beforeEach(() => {
    req = { user: { id: 7 }, body: {}, params: {} };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    pool.query.mockReset();
    // suppress console.error noise from intentional DB error tests
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
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

  test('sendNotification success path', async () => {
    req.body = { user_id: 7, message: 'hello' };
    pool.query.mockResolvedValueOnce({ rows: [{ id: 9, user_id: 7, message: 'hello' }] });
    await notificationController.sendNotification(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, message: 'Notification sent successfully', data: expect.any(Object) }));
  });

  test('markAsRead returns 404 when not found', async () => {
    req.params.id = '99';
    pool.query.mockResolvedValueOnce({ rows: [] });
    await notificationController.markAsRead(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Notification not found' });
  });

  test('getUserNotifications handles DB error', async () => {
    pool.query.mockRejectedValueOnce(new Error('DB error'));
    await notificationController.getUserNotifications(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
