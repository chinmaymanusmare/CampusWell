const pool = require("../config/db");

// =============================================
// GET: Admin Dashboard Overview
// =============================================
exports.getOverview = async (req, res) => {
  try {
    // Total counts
    const usersCount = await pool.query("SELECT COUNT(*) FROM users");
    const doctorsCount = await pool.query("SELECT COUNT(*) FROM users WHERE role = 'doctor'");
    const studentsCount = await pool.query("SELECT COUNT(*) FROM users WHERE role = 'student'");
    const pharmacyCount = await pool.query("SELECT COUNT(*) FROM users WHERE role = 'pharmacy'");
    const appointmentsCount = await pool.query("SELECT COUNT(*) FROM appointments");
    const pendingConcerns = await pool.query("SELECT COUNT(*) FROM concerns WHERE status = 'pending'");
    const totalMedicines = await pool.query("SELECT COUNT(*) FROM medicines");

    res.status(200).json({
      success: true,
      message: "System overview fetched successfully",
      data: {
        total_users: usersCount.rows[0].count,
        total_doctors: doctorsCount.rows[0].count,
        total_students: studentsCount.rows[0].count,
        total_pharmacy_staff: pharmacyCount.rows[0].count,
        total_appointments: appointmentsCount.rows[0].count,
        pending_concerns: pendingConcerns.rows[0].count,
        medicines_in_inventory: totalMedicines.rows[0].count
      }
    });
  } catch (err) {
    console.error("Error fetching admin overview:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// =============================================
// GET: Manage all users
// =============================================
exports.getAllUsers = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, role, roll_number, specialization 
       FROM users ORDER BY id ASC`
    );

    res.status(200).json({
      success: true,
      count: result.rowCount,
      data: result.rows
    });
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// =============================================
// GET: View all appointments
// =============================================
exports.getAllAppointments = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, student_name, doctor_name, date, time, status, reason 
       FROM appointments ORDER BY date DESC`
    );

    res.status(200).json({
      success: true,
      count: result.rowCount,
      data: result.rows
    });
  } catch (err) {
    console.error("Error fetching appointments:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// =============================================
// GET: Pharmacy inventory summary
// =============================================
exports.getInventorySummary = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, stock, price 
       FROM medicines ORDER BY name ASC`
    );

    res.status(200).json({
      success: true,
      count: result.rowCount,
      data: result.rows
    });
  } catch (err) {
    console.error("Error fetching inventory summary:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
