const pool = require('../config/db');

// ===========================
// GET: Student’s Medical History
// ===========================
exports.getStudentRecords = async (req, res) => {
  const studentId = req.user.id; // JWT se mila student ID

  try {
    const result = await pool.query(
      `SELECT id, doctor_name, date, medicines, diagnosis, notes, category
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
    // Determine doctor's specialization to filter specialized records
    const doctorRes = await pool.query(
      'SELECT specialization FROM users WHERE id = $1',
      [req.user.id]
    );
    const doctorSpec = (doctorRes.rows[0] && doctorRes.rows[0].specialization) || null;

    // Select all general records plus specialized records matching the doctor's specialization
    const result = await pool.query(
      `SELECT p.id, p.doctor_name, p.date, p.medicines, p.diagnosis, p.notes, p.category
       FROM prescriptions p
       WHERE p.student_id = $1
       AND (p.category = 'general' OR 
            (p.category = 'specialized' AND EXISTS (
              SELECT 1 FROM users d 
              WHERE d.id = $2 
              AND d.specialization = (
                SELECT specialization FROM users d2 
                WHERE d2.name = p.doctor_name
              )
            )))
       ORDER BY p.date DESC`,
      [studentId, req.user.id]
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
  const doctorResult = await pool.query("SELECT name, specialization FROM users WHERE id = $1", [doctorId]);
  const doctorName = doctorResult.rows[0].name;
  const doctorSpec = doctorResult.rows[0].specialization;

  const { student_id, diagnosis, notes, medicines, category } = req.body;

  try {
    // Default to general if not specialized
    let finalCategory = (doctorSpec === 'general' || !doctorSpec) ? 'general' : 'specialized';

    // Override with provided category if valid
    if (category && (category === 'general' || category === 'specialized')) {
      finalCategory = category;
    }

    const result = await pool.query(
      `INSERT INTO prescriptions (student_id, doctor_name, diagnosis, notes, medicines, date, category)
       VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, $6)
       RETURNING *`,
      [student_id, doctorName, diagnosis, notes, medicines || null, finalCategory]
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
