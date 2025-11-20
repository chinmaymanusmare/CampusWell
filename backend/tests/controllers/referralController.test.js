const referralController = require("../../src/controllers/referralController");
const pool = require("../../src/config/db");

jest.mock("../../src/config/db", () => ({
  query: jest.fn(),
}));

describe("Referral Controller", () => {
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

  // Tests for requestReferral
  describe("requestReferral", () => {
    it("should create a new referral request", async () => {
      req.body.reason = "Specialist consultation";
      const mockUser = { rows: [{ name: "Test Student" }], rowCount: 1 };
      const mockReferral = { rows: [{ id: 1, reason: req.body.reason }] };

      pool.query.mockResolvedValueOnce(mockUser);
      pool.query.mockResolvedValueOnce(mockReferral);

      await referralController.requestReferral(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: mockReferral.rows[0] })
      );
    });

    it("should return 404 if student not found", async () => {
      req.body.reason = "Test";
      pool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await referralController.requestReferral(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  // Tests for getStudentReferrals
  describe("getStudentReferrals", () => {
    it("should retrieve all referrals for the logged-in student", async () => {
      const mockReferrals = {
        rows: [{ id: 1, reason: "Test" }],
        rowCount: 1,
      };
      pool.query.mockResolvedValueOnce(mockReferrals);

      await referralController.getStudentReferrals(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 1,
        data: mockReferrals.rows,
      });
    });
  });

  // Tests for getPendingReferralsForDoctor
  describe("getPendingReferralsForDoctor", () => {
    it("should retrieve all pending referrals for a doctor", async () => {
      const mockReferrals = {
        rows: [{ id: 1, status: "pending" }],
        rowCount: 1,
      };
      pool.query.mockResolvedValueOnce(mockReferrals);

      await referralController.getPendingReferralsForDoctor(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 1,
        data: mockReferrals.rows,
      });
    });
  });

  // Tests for updateReferralStatus
  describe("updateReferralStatus", () => {
    it("should update the status of a referral", async () => {
      req.params.id = 1;
      req.user.id = 2; // Doctor
      req.body.status = "approved";
      const mockExisting = { rows: [{ id: 1 }], rowCount: 1 };
      const mockDoctor = { rows: [{ name: "Dr. Feelgood" }] };
      const mockUpdate = { rows: [{ id: 1, status: "approved" }] };

      pool.query.mockResolvedValueOnce(mockExisting);
      pool.query.mockResolvedValueOnce(mockDoctor);
      pool.query.mockResolvedValueOnce(mockUpdate);

      await referralController.updateReferralStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: mockUpdate.rows[0] })
      );
    });

    it("should return 404 if referral not found", async () => {
      req.params.id = 99;
      pool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await referralController.updateReferralStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
});
