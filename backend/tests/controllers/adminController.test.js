const adminController = require("../../src/controllers/adminController");
const pool = require("../../src/config/db");

jest.mock("../../src/config/db", () => ({
  query: jest.fn(),
}));

describe("Admin Controller", () => {
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

  // Tests for getOverview
  describe("getOverview", () => {
    it("should return an overview of the system", async () => {
      const mockData = {
        usersCount: { rows: [{ count: "10" }] },
        doctorsCount: { rows: [{ count: "2" }] },
        studentsCount: { rows: [{ count: "5" }] },
        pharmacyCount: { rows: [{ count: "3" }] },
        appointmentsCount: { rows: [{ count: "20" }] },
        pendingConcerns: { rows: [{ count: "5" }] },
        totalMedicines: { rows: [{ count: "100" }] },
      };

      pool.query.mockResolvedValueOnce(mockData.usersCount);
      pool.query.mockResolvedValueOnce(mockData.doctorsCount);
      pool.query.mockResolvedValueOnce(mockData.studentsCount);
      pool.query.mockResolvedValueOnce(mockData.pharmacyCount);
      pool.query.mockResolvedValueOnce(mockData.appointmentsCount);
      pool.query.mockResolvedValueOnce(mockData.pendingConcerns);
      pool.query.mockResolvedValueOnce(mockData.totalMedicines);

      await adminController.getOverview(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "System overview fetched successfully",
        data: {
          total_users: "10",
          total_doctors: "2",
          total_students: "5",
          total_pharmacy_staff: "3",
          total_appointments: "20",
          pending_concerns: "5",
          medicines_in_inventory: "100",
        },
      });
    });
  });

  // Tests for getAllUsers
  describe("getAllUsers", () => {
    it("should return all users", async () => {
      const mockUsers = {
        rowCount: 2,
        rows: [
          { id: 1, name: "John Doe", email: "john@example.com", role: "student", roll_number: "12345", specialization: null },
          { id: 2, name: "Jane Smith", email: "jane@example.com", role: "doctor", roll_number: null, specialization: "Cardiology" },
        ],
      };

      pool.query.mockResolvedValueOnce(mockUsers);

      await adminController.getAllUsers(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: mockUsers.rowCount,
        data: mockUsers.rows,
      });
    });
  });

  // Tests for getAllAppointments
  describe("getAllAppointments", () => {
    it("should return all appointments", async () => {
      const mockAppointments = {
        rowCount: 2,
        rows: [
          { id: 1, student_name: "John Doe", doctor_name: "Dr. Smith", date: "2025-12-01", time: "10:00", status: "confirmed", reason: "Fever" },
          { id: 2, student_name: "Jane Doe", doctor_name: "Dr. Jones", date: "2025-12-02", time: "11:00", status: "pending", reason: "Headache" },
        ],
      };

      pool.query.mockResolvedValueOnce(mockAppointments);

      await adminController.getAllAppointments(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: mockAppointments.rowCount,
        data: mockAppointments.rows,
      });
    });
  });

  // Tests for getInventorySummary
  describe("getInventorySummary", () => {
    it("should return the inventory summary", async () => {
      const mockInventory = {
        rowCount: 2,
        rows: [
          { id: 1, name: "Paracetamol", stock: 100, price: "10.00" },
          { id: 2, name: "Aspirin", stock: 50, price: "5.00" },
        ],
      };

      pool.query.mockResolvedValueOnce(mockInventory);

      await adminController.getInventorySummary(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: mockInventory.rowCount,
        data: mockInventory.rows,
      });
    });
  });
});
