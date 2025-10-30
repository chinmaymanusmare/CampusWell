const express = require("express");
const router = express.Router();

const {
  requestReferral,
  getStudentReferrals,
  getPendingReferralsForDoctor,
  updateReferralStatus
} = require("../controllers/referralController");

const verifyToken = require("../middleware/auth");
const { authorize } = require("../middleware/authorize");

router.post("/request", verifyToken, authorize("student"), requestReferral);
router.get("/student", verifyToken, authorize("student"), getStudentReferrals);
router.get("/doctor", verifyToken, authorize("doctor"), getPendingReferralsForDoctor);
router.put("/:id/approve", verifyToken, authorize("doctor"), updateReferralStatus);

module.exports = router;
