const pool = require('../config/db');

// ===========================
// GET: Student’s Medical History
// ===========================
exports.getStudentRecords = async (req, res) => {
  const studentId = req.user.id; // JWT se mila student ID

  try {
    const result = await pool.query(
      `SELECT id, doctor_name, date, medicines, diagnosis, notes
       FROM prescriptions 
       WHERE student_id = $1 
       ORDER BY date DESC`,
      [studentId]
    );

    res.status(200).json({
      success: true,
      count: result.rowCount,
      data: result.rows
    });
  } catch (err) {
    console.error("Error fetching student records:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ===========================
// GET: Doctor Views a Student’s Records
// ===========================
exports.getStudentRecordForDoctor = async (req, res) => {
  const { studentId } = req.params;

  try {
    const result = await pool.query(
      `SELECT id, doctor_name, date, medicines, diagnosis, notes
       FROM prescriptions 
       WHERE student_id = $1 
       ORDER BY date DESC`,
      [studentId]
    );

    res.status(200).json({
      success: true,
      count: result.rowCount,
      data: result.rows
    });
  } catch (err) {
    console.error("Error fetching student record for doctor:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ===========================
// POST: Doctor Adds a Health Record
// ===========================
exports.addHealthRecord = async (req, res) => {
  const doctorId = req.user.id;

  // Doctor ka naam users table se nikaalo (JWT me nahi tha)
  const doctorResult = await pool.query("SELECT name FROM users WHERE id = $1", [doctorId]);
  const doctorName = doctorResult.rows[0].name;

  const { student_id, diagnosis, notes, medicines } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO prescriptions (student_id, doctor_name, diagnosis, notes, medicines, date)
       VALUES ($1, $2, $3, $4, $5, CURRENT_DATE)
       RETURNING *`,
      [student_id, doctorName, diagnosis, notes, medicines || null]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error("Error adding health record:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ===========================
// GET: Prescription Details by ID
// ===========================
exports.getPrescriptionById = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT id, student_id, doctor_name, date, medicines, diagnosis, notes
       FROM prescriptions WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Prescription not found" });
    }

    res.status(200).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error("Error fetching prescription:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ===========================
// PUT: Update Prescription (Medicines, Notes, Diagnosis)
// ===========================
exports.updatePrescription = async (req, res) => {
  const { id } = req.params;
  const { medicines, diagnosis, notes } = req.body;

  try {
    const result = await pool.query(
      `UPDATE prescriptions 
       SET medicines = $1, diagnosis = $2, notes = $3
       WHERE id = $4 
       RETURNING *`,
      [medicines || null, diagnosis || null, notes || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Prescription not found" });
    }

    res.status(200).json({
      success: true,
      message: "Prescription updated successfully",
      data: result.rows[0]
    });
  } catch (err) {
    console.error("Error updating prescription:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
