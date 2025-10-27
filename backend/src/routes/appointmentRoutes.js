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

// Routes
router.get('/doctors', getDoctors);
router.post('/appointments', bookAppointment);
router.get('/appointments/student', getStudentAppointments);
router.get('/appointments/doctor', getDoctorAppointments);
router.put('/appointments/:id', rescheduleAppointment);
router.delete('/appointments/:id', cancelAppointment);

module.exports = router;
