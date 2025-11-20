const pharmacyController = require("../../src/controllers/pharmacyController");
const pool = require("../../src/config/db");

jest.mock("../../src/config/db", () => {
  const mPool = {
    query: jest.fn(),
    connect: jest.fn(),
  };
  return mPool;
});

describe("Pharmacy Controller", () => {
  let req, res;
  const mockClient = {
    query: jest.fn(),
    release: jest.fn(),
  };

  beforeEach(() => {
    req = {
      user: { id: 1 },
      body: {},
      params: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    pool.connect.mockResolvedValue(mockClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Tests for getInventory
  describe("getInventory", () => {
    it("should return the medicine inventory", async () => {
      const mockInventory = {
        rows: [{ id: 1, name: "Aspirin", stock: 100 }],
        rowCount: 1,
      };
      pool.query.mockResolvedValueOnce(mockInventory);

      await pharmacyController.getInventory(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 1,
        data: mockInventory.rows,
      });
    });
  });

  // Tests for updateInventoryItem
  describe("updateInventoryItem", () => {
    it("should update an inventory item's stock", async () => {
      req.params.id = 1;
      req.body.quantity = 150;
      const mockResult = { rows: [{ id: 1, stock: 150 }], rowCount: 1 };
      pool.query.mockResolvedValueOnce(mockResult);

      await pharmacyController.updateInventoryItem(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: mockResult.rows[0] })
      );
    });

    it("should return 404 if medicine not found", async () => {
      req.params.id = 99;
      req.body.quantity = 100;
      pool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await pharmacyController.updateInventoryItem(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  // Tests for placeOrder
  describe("placeOrder", () => {
    it("should place a new medicine order", async () => {
      req.user.id = 1;
      req.body = {
        medicines: [{ medicine_id: 1, quantity: 2 }],
      };

      mockClient.query.mockImplementation((sql) => {
        if (sql.startsWith("SELECT name")) return Promise.resolve({ rows: [{ name: "Test Student" }] });
        if (sql.startsWith("SELECT * FROM medicines")) return Promise.resolve({ rows: [{ id: 1, name: "Aspirin", price: 10, stock: 20 }] });
        if (sql.startsWith("INSERT INTO orders")) return Promise.resolve({ rows: [{ id: 10 }] });
        return Promise.resolve();
      });

      await pharmacyController.placeOrder(req, res);

      expect(pool.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith("BEGIN");
      expect(mockClient.query).toHaveBeenCalledWith("COMMIT");
      expect(mockClient.release).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, message: "Order placed successfully", order_id: 10 });
    });

    it("should return 400 for invalid medicines data", async () => {
      req.body.medicines = "invalid-json";
      await pharmacyController.placeOrder(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  // Tests for getAllOrders
  describe("getAllOrders", () => {
    it("should return all orders for pharmacy staff", async () => {
      const mockOrders = {
        rows: [{ id: 1, student_name: "Test Student" }],
        rowCount: 1,
      };
      pool.query.mockResolvedValueOnce(mockOrders);

      await pharmacyController.getAllOrders(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, count: 1, data: mockOrders.rows });
    });
  });

  // Tests for getStudentOrders
  describe("getStudentOrders", () => {
    it("should return orders for the logged-in student", async () => {
      req.user.id = 1;
      const mockOrders = {
        rows: [{ id: 1, student_id: 1 }],
        rowCount: 1,
      };
      pool.query.mockResolvedValueOnce(mockOrders);

      await pharmacyController.getStudentOrders(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, count: 1, data: mockOrders.rows });
    });
  });

  // Tests for updateOrderStatus
  describe("updateOrderStatus", () => {
    it("should update an order's status", async () => {
      req.params.id = 1;
      req.body.status = "completed";
      const mockResult = { rows: [{ id: 1, status: "completed" }], rowCount: 1 };
      pool.query.mockResolvedValueOnce(mockResult);

      await pharmacyController.updateOrderStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it("should return 404 if order not found", async () => {
      req.params.id = 99;
      req.body.status = "completed";
      pool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await pharmacyController.updateOrderStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
});
