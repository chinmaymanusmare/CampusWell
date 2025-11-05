const pool = require('../config/db');

// List all doctors
exports.getDoctors = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, specialization FROM users WHERE role = 'doctor';"
    );
    res.status(200).json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Error fetching doctors:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.bookAppointment = async (req, res) => {
  const { doctor_id, date, time } = req.body;
  const student_id = req.user.id;

  // Validate required fields
  if (!doctor_id || !date || !time) {
    return res.status(400).json({
      success: false,
      message: 'doctor_id, date, and time are required'
    });
  }

  // Validate date format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid date format. Use YYYY-MM-DD'
    });
  }

  // Validate time format (HH:mm)
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  if (!timeRegex.test(time)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid time format. Use HH:mm (24-hour format)'
    });
  }

  // Validate doctor_id is a positive number
  if (!Number.isInteger(doctor_id) || doctor_id <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Invalid doctor_id. Must be a positive integer'
    });
  }

  try {
    // First check if doctor exists
    const doctorCheck = await pool.query(
      "SELECT name FROM users WHERE id = $1 AND role = 'doctor'",
      [doctor_id]
    );
    if (doctorCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    // Check doctor's availability using the new system
    const { calculateAvailableSlots } = require('./availabilityController');
    const availability = await calculateAvailableSlots(doctor_id, date, time);
    
    if (!availability.available) {
      return res.status(400).json({ 
        success: false, 
        message: availability.message || 'This slot is fully booked or doctor is not available' 
      });
    }

    const studentResult = await pool.query(
      "SELECT name FROM users WHERE id = $1",
      [student_id]
    );

    const result = await pool.query(
      `INSERT INTO appointments(student_id, student_name, doctor_id, doctor_name, date, time, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'scheduled') RETURNING *;`,
      [student_id, studentResult.rows[0].name, doctor_id, doctorCheck.rows[0].name, date, time]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error booking appointment:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// View student appointments
exports.getStudentAppointments = async (req, res) => {
  const studentId = req.user.id;
  try {
    const result = await pool.query(
      "SELECT * FROM appointments WHERE student_id = $1 ORDER BY date, time;",
      [studentId]
    );
    res.status(200).json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Error fetching student appointments:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getDoctorAppointments = async (req, res) => {
  // Prefer explicit query param (for admins) but fall back to authenticated user's id
  let doctorId = req.query.doctor_id || (req.user && req.user.id);

  if (!doctorId) {
    return res.status(400).json({ success: false, message: 'Doctor id is required' });
  }

  try {
    const result = await pool.query(
      "SELECT * FROM appointments WHERE doctor_id = $1 ORDER BY date, time;",
      [doctorId]
    );
    res.status(200).json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Error fetching doctor appointments:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Reschedule appointment
exports.rescheduleAppointment = async (req, res) => {
  const appointmentId = req.params.id;
  // Support both formats (date, time) and (new_date, new_time)
  const date = req.body.date || req.body.new_date;
  const time = req.body.time || req.body.new_time;

  // Validate required fields
  if (!date || !time) {
    return res.status(400).json({ 
      success: false, 
      message: 'Both date and time are required for rescheduling. Use either {date, time} or {new_date, new_time} format.' 
    });
  }

  try {
    // First check if appointment exists and is in a valid state
    const appointmentCheck = await pool.query(
      "SELECT * FROM appointments WHERE id = $1",
      [appointmentId]
    );

    if (appointmentCheck.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Appointment not found' 
      });
    }

    if (appointmentCheck.rows[0].status !== 'scheduled') {
      return res.status(400).json({ 
        success: false, 
        message: 'Can only reschedule appointments that are currently scheduled' 
      });
    }

    // Check if doctor is available at the new slot
    const conflict = await pool.query(
      "SELECT * FROM appointments WHERE id != $1 AND doctor_id = $2 AND date = $3 AND time = $4 AND status = 'scheduled';",
      [appointmentId, appointmentCheck.rows[0].doctor_id, date, time]
    );

    if (conflict.rows.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Doctor not available at this slot' 
      });
    }

    // Update the appointment
    const result = await pool.query(
      "UPDATE appointments SET date = $1, time = $2 WHERE id = $3 RETURNING *;",
      [date, time, appointmentId]
    );

    res.status(200).json({ 
      success: true, 
      data: result.rows[0] 
    });
  } catch (err) {
    console.error('Error rescheduling appointment:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      details: err.message 
    });
  }
};

// Cancel appointment
exports.cancelAppointment = async (req, res) => {
  const appointmentId = req.params.id;
  try {
    await pool.query(
      "UPDATE appointments SET status = 'cancelled' WHERE id = $1;",
      [appointmentId]
    );
    res.status(200).json({ success: true, message: 'Appointment cancelled' });
  } catch (err) {
    console.error('Error cancelling appointment:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
