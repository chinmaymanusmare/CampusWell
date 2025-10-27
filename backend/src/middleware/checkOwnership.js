const pool = require('../config/db');

const checkOwnership = async (req, res, next) => {
  const appointmentId = req.params.id;
  const userId = req.user.id;

  try {
    const result = await pool.query(
      "SELECT student_id, doctor_id FROM appointments WHERE id=$1",
      [appointmentId]
    );

    if (result.rows.length === 0) return res.status(404).json({ success: false, message: "Appointment not found" });

    const appointment = result.rows[0];

    // Allow if the user is either the student or doctor assigned
    if (appointment.student_id !== userId && appointment.doctor_id !== userId) {
      return res.status(403).json({ success: false, message: "Forbidden: Access denied" });
    }

    next();
  } catch (err) {
    console.error('Ownership check error:', err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = checkOwnership;
