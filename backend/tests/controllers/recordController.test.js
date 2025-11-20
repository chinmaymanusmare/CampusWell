const recordController = require("../../src/controllers/recordController");
const pool = require("../../src/config/db");

jest.mock("../../src/config/db", () => ({
  query: jest.fn(),
}));

describe("Record Controller", () => {
  let req, res;

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
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Tests for getStudentRecords
  describe("getStudentRecords", () => {
    it("should retrieve all medical records for the logged-in student", async () => {
      const mockRecords = {
        rows: [{ id: 1, doctor_name: "Dr. House" }],
        rowCount: 1,
      };
      pool.query.mockResolvedValueOnce(mockRecords);

      await recordController.getStudentRecords(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 1,
        data: mockRecords.rows,
      });
    });
  });

  // Tests for getStudentRecordForDoctor
  describe("getStudentRecordForDoctor", () => {
    it("should retrieve a student's records for a doctor", async () => {
      req.params.studentId = 2;
      req.user.id = 1; // Doctor
      const mockDoctorSpec = { rows: [{ specialization: "Cardiology" }] };
      const mockRecords = { rows: [{ id: 1, category: "Cardiology" }], rowCount: 1 };

      pool.query.mockResolvedValueOnce(mockDoctorSpec); // Get doctor spec
      pool.query.mockResolvedValueOnce(mockRecords); // All prescriptions (for debug)
      pool.query.mockResolvedValueOnce(mockRecords); // Filtered prescriptions

      await recordController.getStudentRecordForDoctor(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 1,
        data: mockRecords.rows,
      });
    });
  });

  // Tests for addHealthRecord
  describe("addHealthRecord", () => {
    it("should add a new health record for a student", async () => {
      req.user.id = 1; // Doctor
      req.body = { student_id: 2, diagnosis: "Fever" };
      const mockDoctorInfo = { rows: [{ name: "Dr. House", specialization: "General" }] };
      const mockRecord = { rows: [{ id: 1, ...req.body }] };

      pool.query.mockResolvedValueOnce(mockDoctorInfo);
      pool.query.mockResolvedValueOnce(mockRecord);

      await recordController.addHealthRecord(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockRecord.rows[0] });
    });
  });

  // Tests for getPrescriptionById
  describe("getPrescriptionById", () => {
    it("should retrieve a single prescription by its ID", async () => {
      req.params.id = 1;
      const mockPrescription = { rows: [{ id: 1, diagnosis: "Flu" }], rowCount: 1 };
      pool.query.mockResolvedValueOnce(mockPrescription);

      await recordController.getPrescriptionById(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockPrescription.rows[0] });
    });

    it("should return 404 if prescription not found", async () => {
      req.params.id = 99;
      pool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await recordController.getPrescriptionById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  // Tests for updatePrescription
  describe("updatePrescription", () => {
    it("should update an existing prescription", async () => {
      req.params.id = 1;
      req.body = { diagnosis: "Common Cold" };
      const mockResult = { rows: [{ id: 1, diagnosis: "Common Cold" }], rowCount: 1 };
      pool.query.mockResolvedValueOnce(mockResult);

      await recordController.updatePrescription(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: mockResult.rows[0] })
      );
    });

    it("should return 404 if prescription to update is not found", async () => {
      req.params.id = 99;
      pool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await recordController.updatePrescription(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
});
