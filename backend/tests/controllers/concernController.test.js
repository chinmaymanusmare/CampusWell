const concernController = require("../../src/controllers/concernController");
const pool = require("../../src/config/db");

jest.mock("../../src/config/db", () => ({
  query: jest.fn(),
}));

describe("Concern Controller", () => {
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

  // Tests for submitConcern
  describe("submitConcern", () => {
    it("should submit a new concern", async () => {
      req = {
        user: { id: 1 },
        body: { category: "General", message: "This is a test concern." },
      };
      const mockResult = { rows: [{ id: 1, ...req.body }] };
      pool.query.mockResolvedValueOnce(mockResult);

      await concernController.submitConcern(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockResult.rows[0] });
    });
  });

  // Tests for getConcernsForStudent
  describe("getConcernsForStudent", () => {
    it("should retrieve concerns for the logged-in student", async () => {
      req = { user: { id: 1 } };
      const mockConcerns = {
        rows: [{ id: 1, category: "General", message: "Test" }],
        rowCount: 1,
      };
      pool.query.mockResolvedValueOnce(mockConcerns);

      await concernController.getConcernsForStudent(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: mockConcerns.rowCount,
        data: mockConcerns.rows,
      });
    });
  });

  // Tests for getConcernsForDoctor
  describe("getConcernsForDoctor", () => {
    it("should retrieve concerns for a doctor", async () => {
      req = { user: { id: 2 } }; // Doctor ID
      const mockConcerns = {
        rows: [{ id: 1, category: "General", message: "Test", status: "pending" }],
        rowCount: 1,
      };
      pool.query.mockResolvedValueOnce(mockConcerns);

      await concernController.getConcernsForDoctor(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: mockConcerns.rowCount,
        data: mockConcerns.rows,
      });
    });
  });

  // Tests for replyToConcern
  describe("replyToConcern", () => {
    it("should allow a doctor to reply to a concern", async () => {
      req = {
        params: { id: 1 },
        user: { id: 2 }, // Doctor ID
        body: { reply: "This is a reply." },
      };
      const mockCheck = { rows: [{ id: 1 }] };
      const mockReply = { rows: [{ id: 1, response: "This is a reply." }] };

      pool.query.mockResolvedValueOnce(mockCheck); // Check if concern exists
      pool.query.mockResolvedValueOnce(mockReply); // Update with reply

      await concernController.replyToConcern(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Reply added successfully",
        data: mockReply.rows[0],
      });
    });

    it("should return 404 if concern not found", async () => {
      req = {
        params: { id: 99 },
        user: { id: 2 },
        body: { reply: "This will fail." },
      };
      pool.query.mockResolvedValueOnce({ rows: [] }); // Concern does not exist

      await concernController.replyToConcern(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Concern not found",
      });
    });
  });
});
