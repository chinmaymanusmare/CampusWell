const userController = require("../../src/controllers/userController");
const pool = require("../../src/config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

jest.mock("../../src/config/db", () => ({
  query: jest.fn(),
}));
jest.mock("bcrypt");
jest.mock("jsonwebtoken");

describe("User Controller", () => {
  let req, res;

  beforeEach(() => {
    req = { body: {}, params: {}, user: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      clearCookie: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Tests for signup
  describe("signup", () => {
    it("should create a new user", async () => {
      req.body = { name: "Test", email: "test@test.com", password: "password123", role: "student" };
      pool.query.mockResolvedValueOnce({ rows: [] }); // No existing user
      bcrypt.hash.mockResolvedValueOnce("hashedpassword");
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1, ...req.body }] });

      await userController.signup(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it("should return 400 if user already exists", async () => {
      req.body = { email: "exists@test.com", password: "password123" };
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await userController.signup(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  // Tests for login
  describe("login", () => {
    it("should log in a user and return a token", async () => {
      req.body = { email: "test@test.com", password: "password123" };
      const mockUser = { id: 1, password: "hashedpassword", role: "student" };
      pool.query.mockResolvedValueOnce({ rows: [mockUser] });
      bcrypt.compare.mockResolvedValueOnce(true);
      jwt.sign.mockReturnValueOnce("testtoken");

      await userController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, token: "testtoken" });
    });

    it("should return 400 for invalid credentials", async () => {
      req.body = { email: "test@test.com", password: "wrongpassword" };
      pool.query.mockResolvedValueOnce({ rows: [] }); // User not found

      await userController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  // Tests for getUserById
  describe("getUserById", () => {
    it("should return a user by their ID", async () => {
      req.params.id = 1;
      const mockUser = { rows: [{ id: 1, name: "Test" }], rowCount: 1 };
      pool.query.mockResolvedValueOnce(mockUser);

      await userController.getUserById(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockUser.rows[0] });
    });
  });

  // Tests for getAllUsersForAdmin
  describe("getAllUsersForAdmin", () => {
    it("should return all users", async () => {
      const mockUsers = { rows: [{ id: 1 }, { id: 2 }], rowCount: 2 };
      pool.query.mockResolvedValueOnce(mockUsers);

      await userController.getAllUsersForAdmin(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, count: 2, data: mockUsers.rows });
    });
  });

  // Tests for updateUserById
  describe("updateUserById", () => {
    it("should update a user's details", async () => {
      req.params.id = 1;
      req.body = { name: "Updated Name" };
      const mockUpdate = { rows: [{ id: 1, name: "Updated Name" }], rowCount: 1 };
      pool.query.mockResolvedValueOnce(mockUpdate);

      await userController.updateUserById(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockUpdate.rows[0] });
    });
  });

  // Tests for updateDoctorTimePerPatient
  describe("updateDoctorTimePerPatient", () => {
    it("should update a doctor's time per patient", async () => {
      req.user.id = 1; // Doctor
      req.body.timePerPatient = 20;
      const mockUpdate = { rows: [{ id: 1, time_per_patient: 20 }], rowCount: 1 };
      pool.query.mockResolvedValueOnce(mockUpdate);

      await userController.updateDoctorTimePerPatient(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // Tests for getDistinctSpecializations
  describe("getDistinctSpecializations", () => {
    it("should return a list of distinct specializations", async () => {
      const mockSpecs = { rows: [{ specialization: "Cardiology" }, { specialization: "Neurology" }] };
      pool.query.mockResolvedValueOnce(mockSpecs);

      await userController.getDistinctSpecializations(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: ["All Specializations", "Cardiology", "Neurology"],
      });
    });
  });

  // Tests for logout
  describe("logout", () => {
    it("should log out the user", () => {
      userController.logout(req, res);
      expect(res.clearCookie).toHaveBeenCalledWith("refreshToken");
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});
