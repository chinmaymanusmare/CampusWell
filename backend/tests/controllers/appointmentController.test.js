const appointmentController = require("../../src/controllers/appointmentController");
const pool = require("../../src/config/db");

jest.mock("../../src/config/db", () => ({
  query: jest.fn(),
}));

describe("Appointment Controller", () => {
  let req, res;

  beforeEach(() => {
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      send: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Tests for getAppointments
  describe("getAppointments", () => {
    it("should return appointments for a student", async () => {
      req = { user: { id: 1, role: "student" } };
      const mockAppointments = {
        rows: [{ id: 1, doctor_name: "Dr. Smith", date: "2025-01-01", status: "confirmed" }],
      };
      pool.query.mockResolvedValueOnce(mockAppointments);

      await appointmentController.getAppointments(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockAppointments.rows,
      });
    });

    it("should return appointments for a doctor", async () => {
      req = { user: { id: 2, role: "doctor" } };
      const mockAppointments = {
        rows: [{ id: 1, student_name: "John Doe", date: "2025-01-01", status: "confirmed" }],
      };
      pool.query.mockResolvedValueOnce(mockAppointments);

      await appointmentController.getAppointments(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockAppointments.rows,
      });
    });
  });

  // Tests for getAppointmentById
  describe("getAppointmentById", () => {
    it("should return a single appointment", async () => {
      req = { params: { id: 1 }, user: { id: 1, role: "student" } };
      const mockAppointment = {
        rows: [{ id: 1, student_id: 1, doctor_name: "Dr. Smith" }],
        rowCount: 1,
      };
      pool.query.mockResolvedValueOnce(mockAppointment);

      await appointmentController.getAppointmentById(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockAppointment.rows[0],
      });
    });

    it("should return 404 if appointment not found", async () => {
      req = { params: { id: 1 }, user: { id: 1, role: "student" } };
      pool.query.mockResolvedValueOnce({ rowCount: 0 });

      await appointmentController.getAppointmentById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Appointment not found",
      });
    });
  });

  // Tests for createAppointment
  describe("createAppointment", () => {
    it("should create a new appointment", async () => {
      req = {
        user: { id: 1, name: "John Doe" },
        body: { doctor_id: 2, date: "2025-01-01", time: "10:00:00", reason: "Fever" },
      };
      const mockDoctor = { rows: [{ name: "Dr. Smith" }] };
      const mockAvailability = { rowCount: 1 };
      const mockCreate = { rows: [{ id: 1 }] };

      pool.query.mockResolvedValueOnce(mockDoctor); // Get doctor name
      pool.query.mockResolvedValueOnce(mockAvailability); // Check availability
      pool.query.mockResolvedValueOnce(mockCreate); // Create appointment

      await appointmentController.createAppointment(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Appointment booked successfully",
        data: { id: 1 },
      });
    });

    it("should return 400 if doctor is not available", async () => {
      req = {
        user: { id: 1, name: "John Doe" },
        body: { doctor_id: 2, date: "2025-01-01", time: "10:00:00", reason: "Fever" },
      };
      const mockDoctor = { rows: [{ name: "Dr. Smith" }] };
      const mockAvailability = { rowCount: 0 };

      pool.query.mockResolvedValueOnce(mockDoctor); // Get doctor name
      pool.query.mockResolvedValueOnce(mockAvailability); // Check availability

      await appointmentController.createAppointment(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Doctor is not available at the selected time.",
      });
    });
  });

  // Tests for updateAppointmentStatus
  describe("updateAppointmentStatus", () => {
    it("should update the appointment status", async () => {
      req = { params: { id: 1 }, body: { status: "confirmed" } };
      const mockUpdate = { rowCount: 1 };
      pool.query.mockResolvedValueOnce(mockUpdate);

      await appointmentController.updateAppointmentStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Appointment status updated successfully",
      });
    });

    it("should return 404 if appointment not found for updating status", async () => {
      req = { params: { id: 1 }, body: { status: "confirmed" } };
      pool.query.mockResolvedValueOnce({ rowCount: 0 });

      await appointmentController.updateAppointmentStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Appointment not found",
      });
    });
  });

  // Tests for cancelAppointment
  describe("cancelAppointment", () => {
    it("should cancel an appointment", async () => {
      req = { params: { id: 1 }, user: { id: 1 } };
      const mockAppointment = { rows: [{ student_id: 1 }], rowCount: 1 };
      const mockDelete = { rowCount: 1 };

      pool.query.mockResolvedValueOnce(mockAppointment); // Find appointment
      pool.query.mockResolvedValueOnce(mockDelete); // Delete appointment

      await appointmentController.cancelAppointment(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Appointment cancelled",
      });
    });

    it("should return 404 if appointment not found for cancellation", async () => {
      req = { params: { id: 1 }, user: { id: 1 } };
      pool.query.mockResolvedValueOnce({ rowCount: 0 });

      await appointmentController.cancelAppointment(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Appointment not found",
      });
    });

    it("should return 403 if user is not authorized to cancel", async () => {
      req = { params: { id: 1 }, user: { id: 2 } }; // User ID doesn't match student_id
      const mockAppointment = { rows: [{ student_id: 1 }], rowCount: 1 };
      pool.query.mockResolvedValueOnce(mockAppointment);

      await appointmentController.cancelAppointment(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "You are not authorized to cancel this appointment.",
      });
    });
  });
});
