jest.mock('../../src/config/db', () => ({ query: jest.fn(), connect: jest.fn() }));

const { rescheduleAppointment } = require('../../src/controllers/appointmentController');
const pool = require('../../src/config/db');

describe('appointmentController.rescheduleAppointment validation', () => {
  let req, res;

  beforeEach(() => {
    req = { params: { id: '1' }, body: {} };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    pool.query.mockReset();
  });

  test('returns 400 when date or time missing', async () => {
    req.body = { date: undefined, time: undefined };
    await rescheduleAppointment(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, message: expect.stringContaining('Both date and time are required') }));
  });
});
