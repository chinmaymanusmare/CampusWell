const express = require("express");
const router = express.Router();

const {
  getStudentRecords,
  getStudentRecordForDoctor,
  addHealthRecord,
  getPrescriptionById,
  updatePrescription
} = require("../controllers/recordController");

const verifyToken = require("../middleware/auth");
const { authorize } = require("../middleware/authorize");

router.get("/student", verifyToken, authorize("student"), getStudentRecords);
router.get("/doctor/:studentId", verifyToken, authorize("doctor"), getStudentRecordForDoctor);
router.post("/", verifyToken, authorize("doctor"), addHealthRecord);
router.get("/prescriptions/:id", verifyToken, getPrescriptionById);
router.put("/prescriptions/:id", verifyToken, authorize("doctor"), updatePrescription);

module.exports = router;
