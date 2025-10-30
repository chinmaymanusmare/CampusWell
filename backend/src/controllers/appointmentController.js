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

  try {
    const conflict = await pool.query(
      "SELECT * FROM appointments WHERE doctor_id = $1 AND date = $2 AND time = $3 AND status = 'scheduled';",
      [doctor_id, date, time]
    );
    if (conflict.rows.length > 0)
      return res.status(400).json({ success: false, message: 'Doctor not available at this slot' });

    const doctorResult = await pool.query(
      "SELECT name FROM users WHERE id = $1 AND role = 'doctor'",
      [doctor_id]
    );
    if (doctorResult.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Doctor not found' });

    const studentResult = await pool.query(
      "SELECT name FROM users WHERE id = $1",
      [student_id]
    );

    const result = await pool.query(
      `INSERT INTO appointments(student_id, student_name, doctor_id, doctor_name, date, time, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'scheduled') RETURNING *;`,
      [student_id, studentResult.rows[0].name, doctor_id, doctorResult.rows[0].name, date, time]
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

// View doctor appointments
exports.getDoctorAppointments = async (req, res) => {
  const doctorId = req.query.doctor_id;
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
  const { date, time } = req.body;
  try {
    // Optional: check if doctor is available at the new slot
    const conflict = await pool.query(
      "SELECT * FROM appointments WHERE id != $1 AND doctor_id = (SELECT doctor_id FROM appointments WHERE id = $1) AND date = $2 AND time = $3 AND status = 'scheduled';",
      [appointmentId, date, time]
    );
    if (conflict.rows.length > 0)
      return res.status(400).json({ success: false, message: 'Doctor not available at this slot' });

    const result = await pool.query(
      "UPDATE appointments SET date = $1, time = $2 WHERE id = $3 RETURNING *;",
      [date, time, appointmentId]
    );
    res.status(200).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error rescheduling appointment:', err);
    res.status(500).json({ success: false, message: 'Server error' });
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
