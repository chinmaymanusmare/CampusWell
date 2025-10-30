const express = require("express");
const router = express.Router();

const {
  getOverview,
  getAllUsers,
  getAllAppointments,
  getInventorySummary
} = require("../controllers/adminController");

const verifyToken = require("../middleware/auth");
const { authorize } = require("../middleware/authorize");

router.get("/overview", verifyToken, authorize("admin"), getOverview);
router.get("/users", verifyToken, authorize("admin"), getAllUsers);
router.get("/appointments", verifyToken, authorize("admin"), getAllAppointments);
router.get("/inventory", verifyToken, authorize("admin"), getInventorySummary);

module.exports = router;
