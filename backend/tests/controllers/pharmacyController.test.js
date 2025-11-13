jest.mock('../../src/config/db', () => ({ query: jest.fn(), connect: jest.fn() }));

const { placeOrder, getInventory, updateInventoryItem, getAllOrders, getStudentOrders, updateOrderStatus } = require('../../src/controllers/pharmacyController');
const pool = require('../../src/config/db');

describe('Pharmacy Controller', () => {
  let req, res;

  beforeEach(() => {
    req = { 
      user: { id: 10 }, 
      body: {}, 
      params: {}
    };
    res = { 
      status: jest.fn().mockReturnThis(), 
      json: jest.fn() 
    };
    pool.query.mockReset();
  });

  describe('getInventory', () => {
    test('successfully retrieves inventory', async () => {
      const mockMedicines = [
        { id: 1, name: 'Med A', description: 'Description A', stock: 10, price: 50 },
        { id: 2, name: 'Med B', description: 'Description B', stock: 20, price: 30 }
      ];
      pool.query.mockResolvedValueOnce({ rows: mockMedicines, rowCount: 2 });

      await getInventory(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 2,
        data: mockMedicines
      });
    });
  });

  describe('updateInventoryItem', () => {
    test('successfully updates inventory item', async () => {
      req.params.id = '1';
      req.body.quantity = 15;
      const updatedMedicine = { id: 1, name: 'Med A', stock: 15 };
      pool.query.mockResolvedValueOnce({ rows: [updatedMedicine] });

      await updateInventoryItem(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Inventory updated successfully',
        data: updatedMedicine
      });
    });

    test('returns 404 for non-existent medicine', async () => {
      req.params.id = '999';
      req.body.quantity = 15;
      pool.query.mockResolvedValueOnce({ rows: [] });

      await updateInventoryItem(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Medicine not found'
      });
    });
  });

  describe('placeOrder', () => {
    beforeEach(() => {
      req.body = { 
        medicines: [{ medicine_id: 2, quantity: 1 }],
        prescription_link: 'https://example.com/presc.pdf' 
      };
    });

    test('successfully places order with prescription', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [{ id: 2, stock: 10, price: 50 }] }) // medicine check
          .mockResolvedValueOnce({ rows: [{ id: 123 }] }) // insert order
          .mockResolvedValueOnce({ rows: [] }) // insert order_medicines
          .mockResolvedValueOnce({ rows: [] }) // update stock
          .mockResolvedValueOnce({ rows: [] }), // COMMIT
        release: jest.fn()
      };
      pool.connect = jest.fn().mockResolvedValue(mockClient);
      pool.query.mockResolvedValueOnce({ rows: [{ name: 'Student A' }] });

      await placeOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ 
        success: true, 
        order_id: expect.any(Number) 
      }));
    });

    test('returns 404 for non-existent medicine', async () => {
      req.body.medicines = [{ medicine_id: 999, quantity: 1 }];
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [] }) // medicine check - not found
          .mockRejectedValueOnce(new Error('Medicine with ID 999 not found')),
        release: jest.fn()
      };
      pool.connect = jest.fn().mockResolvedValue(mockClient);
      pool.query.mockResolvedValueOnce({ rows: [{ name: 'Student A' }] });

      await placeOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false
      }));
    });

    test('returns 400 when insufficient stock', async () => {
      req.body.medicines = [{ medicine_id: 2, quantity: 10 }];
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [{ id: 2, stock: 0, price: 50, name: 'Med B' }] }) // medicine check - no stock
          .mockRejectedValueOnce(new Error('Not enough stock for Med B. Available: 0')),
        release: jest.fn()
      };
      pool.connect = jest.fn().mockResolvedValue(mockClient);
      pool.query.mockResolvedValueOnce({ rows: [{ name: 'Student A' }] });

      await placeOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false
      }));
    });
  });

  describe('getAllOrders', () => {
    test('successfully retrieves all orders', async () => {
      const mockOrders = [
        { id: 1, student_name: 'Student A', status: 'pending' },
        { id: 2, student_name: 'Student B', status: 'completed' }
      ];
      pool.query.mockResolvedValueOnce({ rows: mockOrders, rowCount: 2 });

      await getAllOrders(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 2,
        data: mockOrders
      });
    });
  });

  describe('getStudentOrders', () => {
    test('successfully retrieves student orders', async () => {
      const mockOrders = [
        { id: 1, student_id: 10, status: 'pending' },
        { id: 2, student_id: 10, status: 'completed' }
      ];
      pool.query.mockResolvedValueOnce({ rows: mockOrders, rowCount: 2 });

      await getStudentOrders(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 2,
        data: mockOrders
      });
    });
  });

  describe('updateOrderStatus', () => {
    test('successfully updates order status', async () => {
      req.params.id = '1';
      req.body.status = 'completed';
      const updatedOrder = { id: 1, status: 'completed' };
      pool.query.mockResolvedValueOnce({ rows: [updatedOrder] });

      await updateOrderStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Order status updated successfully',
        data: updatedOrder
      });
    });

    test('returns 404 for non-existent order', async () => {
      req.params.id = '999';
      req.body.status = 'completed';
      pool.query.mockResolvedValueOnce({ rows: [] });

      await updateOrderStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Order not found'
      });
    });
  });
});
