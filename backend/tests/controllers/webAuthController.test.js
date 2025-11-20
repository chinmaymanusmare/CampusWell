const webAuthController = require("../../src/controllers/webAuthController");
const pool = require("../../src/config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

jest.mock("../../src/config/db", () => ({
  query: jest.fn(),
}));
jest.mock("bcrypt");
jest.mock("jsonwebtoken");

describe("Web Auth Controller", () => {
  let req, res;

  beforeEach(() => {
    req = { body: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
      cookie: jest.fn(),
      redirect: jest.fn(),
      clearCookie: jest.fn(),
      set: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Tests for webLogin
  describe("webLogin", () => {
    it("should log in a user and redirect to their dashboard", async () => {
      req.body = { email: "test@web.com", password: "password123", role: "student" };
      const mockUser = { id: 1, password: "hashedpassword", role: "student" };
      pool.query.mockResolvedValueOnce({ rows: [mockUser] });
      bcrypt.compare.mockResolvedValueOnce(true);
      jwt.sign.mockReturnValueOnce("webtoken");

      await webAuthController.webLogin(req, res);

      expect(res.cookie).toHaveBeenCalledWith("token", "webtoken", expect.any(Object));
      expect(res.redirect).toHaveBeenCalledWith("/users/1");
    });

    it("should return 400 for invalid credentials", async () => {
      req.body = { email: "test@web.com", password: "wrongpassword" };
      pool.query.mockResolvedValueOnce({ rows: [] });

      await webAuthController.webLogin(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith(expect.stringContaining("Invalid credentials"));
    });

    it("should return 400 for incorrect role", async () => {
        req.body = { email: "test@web.com", password: "password123", role: "doctor" };
        const mockUser = { id: 1, password: "hashedpassword", role: "student" };
        pool.query.mockResolvedValueOnce({ rows: [mockUser] });
  
        await webAuthController.webLogin(req, res);
  
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.send).toHaveBeenCalledWith(expect.stringContaining("Invalid role selected"));
      });
  });

  // Tests for webSignup
  describe("webSignup", () => {
    it("should sign up a new user and redirect to their dashboard", async () => {
      req.body = { name: "New Web User", email: "new@web.com", password: "password123" };
      pool.query.mockResolvedValueOnce({ rows: [] }); // No existing user
      bcrypt.hash.mockResolvedValueOnce("newhashedpassword");
      const mockNewUser = { id: 2, role: "student" };
      pool.query.mockResolvedValueOnce({ rows: [mockNewUser] });
      jwt.sign.mockReturnValueOnce("newwebtoken");

      await webAuthController.webSignup(req, res);

      expect(res.cookie).toHaveBeenCalledWith("token", "newwebtoken", expect.any(Object));
      expect(res.redirect).toHaveBeenCalledWith("/users/2");
    });

    it("should return 400 if user already exists", async () => {
      req.body = { email: "exists@web.com", password: "password123" };
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await webAuthController.webSignup(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith(expect.stringContaining("User already exists"));
    });
  });

  // Tests for webLogout
  describe("webLogout", () => {
    it("should clear the token cookie and redirect to login", () => {
      webAuthController.webLogout(req, res);

      expect(res.clearCookie).toHaveBeenCalledWith("token", expect.any(Object));
      expect(res.redirect).toHaveBeenCalledWith("/login");
    });
  });
});
