const notificationController = require("../../src/controllers/notificationController");
const pool = require("../../src/config/db");

jest.mock("../../src/config/db", () => ({
  query: jest.fn(),
}));

describe("Notification Controller", () => {
  let req, res;

  beforeEach(() => {
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Tests for getUserNotifications
  describe("getUserNotifications", () => {
    it("should retrieve notifications for the logged-in user", async () => {
      req = { user: { id: 1 } };
      const mockNotifications = {
        rows: [{ id: 1, message: "Test notification", is_read: false }],
        rowCount: 1,
      };
      pool.query.mockResolvedValueOnce(mockNotifications);

      await notificationController.getUserNotifications(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: mockNotifications.rowCount,
        data: mockNotifications.rows,
      });
    });
  });

  // Tests for sendNotification
  describe("sendNotification", () => {
    it("should send a notification to a user", async () => {
      req = { body: { user_id: 1, message: "Hello from admin" } };
      const mockResult = { rows: [{ id: 1, ...req.body }] };
      pool.query.mockResolvedValueOnce(mockResult);

      await notificationController.sendNotification(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Notification sent successfully",
        data: mockResult.rows[0],
      });
    });

    it("should return 400 if fields are missing", async () => {
      req = { body: { user_id: 1 } }; // Missing message
      await notificationController.sendNotification(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  // Tests for markAsRead
  describe("markAsRead", () => {
    it("should mark a notification as read", async () => {
      req = { params: { id: 1 }, user: { id: 1 } };
      const mockResult = {
        rows: [{ id: 1, message: "Test", is_read: true }],
        rowCount: 1,
      };
      pool.query.mockResolvedValueOnce(mockResult);

      await notificationController.markAsRead(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Notification marked as read",
        data: mockResult.rows[0],
      });
    });

    it("should return 404 if notification not found", async () => {
      req = { params: { id: 99 }, user: { id: 1 } };
      pool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await notificationController.markAsRead(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Notification not found",
      });
    });
  });
});
