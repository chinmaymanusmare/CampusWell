const pool = require("../config/db");

// ===========================================
// POST: Student requests a hospital referral
// ===========================================
exports.requestReferral = async (req, res) => {
  const studentId = req.user.id;
  const { reason } = req.body;

  try {
    // Get student name from users table
    const userResult = await pool.query("SELECT name FROM users WHERE id = $1", [studentId]);
    if (userResult.rows.length === 0)
      return res.status(404).json({ success: false, message: "Student not found" });

    const studentName = userResult.rows[0].name;

    const result = await pool.query(
      `INSERT INTO referrals (student_id, student_name, reason, status, requested_at)
       VALUES ($1, $2, $3, 'pending', CURRENT_TIMESTAMP)
       RETURNING *`,
      [studentId, studentName, reason]
    );

    res.status(201).json({
      success: true,
      message: "Referral request created successfully",
      data: result.rows[0]
    });
  } catch (err) {
    console.error("Error creating referral request:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ===========================================
// GET: Student views their referral history
// ===========================================
exports.getStudentReferrals = async (req, res) => {
  const studentId = req.user.id;

  try {
    const result = await pool.query(
      `SELECT id, reason, status, requested_at, doctor_notes
       FROM referrals WHERE student_id = $1
       ORDER BY requested_at DESC`,
      [studentId]
    );

    res.status(200).json({
      success: true,
      count: result.rowCount,
      data: result.rows
    });
  } catch (err) {
    console.error("Error fetching student referrals:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ===========================================
// GET: Doctor views pending referrals
// ===========================================
exports.getPendingReferralsForDoctor = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, student_id, student_name, reason, status, requested_at
       FROM referrals WHERE status = 'pending'
       ORDER BY requested_at DESC`
    );

    res.status(200).json({
      success: true,
      count: result.rowCount,
      data: result.rows
    });
  } catch (err) {
    console.error("Error fetching pending referrals:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ===========================================
// PUT: Doctor approves or denies referral
// ===========================================
exports.updateReferralStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // approved / denied
  const doctorId = req.user.id;

  try {
    // Check if referral exists
    const existing = await pool.query("SELECT * FROM referrals WHERE id = $1", [id]);
    if (existing.rows.length === 0)
      return res.status(404).json({ success: false, message: "Referral not found" });

    // Doctor info
    const doctorResult = await pool.query("SELECT name FROM users WHERE id = $1", [doctorId]);
    const doctorName = doctorResult.rows[0].name;

    const result = await pool.query(
      `UPDATE referrals
       SET status = $1, doctor_notes = $2
       WHERE id = $3
       RETURNING *`,
      [status === "approved" ? "approved" : "rejected", `Reviewed by ${doctorName}`, id]
    );

    res.status(200).json({
      success: true,
      message: "Referral status updated successfully",
      data: result.rows[0]
    });
  } catch (err) {
    console.error("Error updating referral status:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
