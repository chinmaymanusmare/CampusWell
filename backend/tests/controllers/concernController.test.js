jest.mock('../../src/config/db', () => ({ query: jest.fn(), connect: jest.fn() }));

const concernController = require('../../src/controllers/concernController');
const pool = require('../../src/config/db');

describe('concernController', () => {
  let req, res;

  beforeEach(() => {
    req = { user: { id: 5 }, body: {}, params: {} };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    pool.query.mockReset();
  });

  test('submitConcern inserts and returns 201', async () => {
    req.body = { category: 'mental', message: 'help' };
    pool.query.mockResolvedValueOnce({ rows: [{ id: 1, category: 'mental' }] });
    await concernController.submitConcern(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('getConcernsForStudent returns data', async () => {
    pool.query.mockResolvedValue({ rowCount: 1, rows: [{ id: 1 }] });
    await concernController.getConcernsForStudent(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('replyToConcern updates when exists', async () => {
    req.params.id = '2';
    req.body = { reply: 'response' };
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 2 }] }) // check exists
      .mockResolvedValueOnce({ rows: [{ id: 2, response: 'response' }] }); // update

    await concernController.replyToConcern(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
