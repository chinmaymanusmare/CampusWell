const availabilityController = require("../../src/controllers/availabilityController");
const pool = require("../../src/config/db");

jest.mock("../../src/config/db", () => {
  const mPool = {
    query: jest.fn(),
    connect: jest.fn(),
  };
  return mPool;
});

describe("Availability Controller", () => {
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
      query: {},
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

  // Tests for setAvailability
  describe("setAvailability", () => {
    it("should set a doctor's availability", async () => {
      req.body = { date: "2025-01-01", startTime: "09:00", endTime: "17:00", maxPatients: 10 };
      const mockResult = { rows: [{ id: 1, ...req.body }] };
      pool.query.mockResolvedValueOnce(mockResult);

      await availabilityController.setAvailability(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockResult.rows[0] });
    });

    it("should return 400 if required fields are missing", async () => {
      req.body = { date: "2025-01-01" }; // Missing times
      await availabilityController.setAvailability(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  // Tests for getAvailability
  describe("getAvailability", () => {
    it("should get a doctor's availability for a date range", async () => {
      req.params.doctorId = 1;
      req.query = { startDate: "2025-01-01", endDate: "2025-01-31" };
      const mockAvailabilities = { rows: [{ id: 1, date: "2025-01-10" }] };
      pool.query.mockResolvedValueOnce(mockAvailabilities);

      await availabilityController.getAvailability(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockAvailabilities.rows });
    });
  });

  // Tests for deleteAvailability
  describe("deleteAvailability", () => {
    it("should delete an availability slot", async () => {
      req.params.id = 1;
      pool.query.mockResolvedValueOnce({ rows: [{ count: "0" }] }); // No appointments check
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 }); // Deletion

      await availabilityController.deleteAvailability(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, message: "Availability deleted successfully" });
    });

    it("should return 404 if availability not found", async () => {
      req.params.id = 99;
      pool.query.mockResolvedValueOnce({ rows: [{ count: "0" }] }); // No appointments check
      pool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // Deletion fails

      await availabilityController.deleteAvailability(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("should return 400 if there are booked appointments and force is not true", async () => {
      req.params.id = 1;
      pool.query.mockResolvedValueOnce({ rows: [{ count: "1" }] }); // Has appointments

      await availabilityController.deleteAvailability(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should handle forced deletion", async () => {
      req.params.id = 1;
      req.query.force = "true";

      // Mock transaction queries
      mockClient.query.mockResolvedValueOnce({ rows: [{ count: "1" }] }); // Initial check
      mockClient.query.mockImplementation((sql) => {
        if (sql.startsWith("SELECT doctor_id")) return Promise.resolve({ rows: [{ doctor_id: 1, date: "2025-01-01", start_time: "10:00" }] });
        if (sql.startsWith("SELECT id, student_id")) return Promise.resolve({ rows: [{ id: 100, student_id: 2 }] });
        if (sql.startsWith("SELECT name FROM users")) return Promise.resolve({ rows: [{ name: "Dr. Who" }] });
        if (sql.startsWith("DELETE")) return Promise.resolve({ rows: [{ id: 1 }] });
        return Promise.resolve();
      });

      await availabilityController.deleteAvailability(req, res);

      expect(pool.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith("BEGIN");
      expect(mockClient.query).toHaveBeenCalledWith("COMMIT");
      expect(mockClient.release).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  // Tests for calculateAvailableSlots (this is an internal function, but we can test it)
  describe("calculateAvailableSlots", () => {
    it("should calculate available slots correctly", async () => {
      const availabilityData = {
        rows: [{
          current_bookings: "5",
          max_patients: 10,
          time_per_patient: 15,
        }],
      };
      pool.query.mockResolvedValueOnce(availabilityData);

      const result = await availabilityController.calculateAvailableSlots(1, "2025-01-01", "10:00");

      expect(result.available).toBe(true);
      expect(result.currentBookings).toBe(5);
    });

    it("should return unavailable if no availability is found", async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });
      const result = await availabilityController.calculateAvailableSlots(1, "2025-01-01", "10:00");
      expect(result.available).toBe(false);
    });
  });
});
