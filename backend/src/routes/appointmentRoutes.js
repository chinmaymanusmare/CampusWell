const express = require('express');
const router = express.Router();
const {
  getDoctors,
  bookAppointment,
  getStudentAppointments,
  getDoctorAppointments,
  rescheduleAppointment,
  cancelAppointment
} = require('../controllers/appointmentController');

const verifyToken = require('../middleware/auth');

router.get('/doctors', getDoctors);
router.post('/appointments', verifyToken, bookAppointment);
router.get('/appointments/student', verifyToken, getStudentAppointments);
router.get('/appointments/doctor', verifyToken, getDoctorAppointments);
router.put('/appointments/:id', verifyToken, rescheduleAppointment);
router.delete('/appointments/:id', verifyToken, cancelAppointment);

module.exports = router;
