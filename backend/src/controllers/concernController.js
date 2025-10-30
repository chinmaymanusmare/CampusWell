const pool = require('../config/db');

// POST: Submit an anonymous concern
exports.submitConcern = async (req, res) => {
  const { category, message } = req.body;
  const studentId = req.user.id; // Logged-in user ID from JWT

  try {
    const result = await pool.query(
      `INSERT INTO public.concerns (student_id, category, message, status)
       VALUES ($1, $2, $3, 'pending') RETURNING *`,
      [studentId, category, message]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error submitting concern:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET: Student - View own concerns
exports.getConcernsForStudent = async (req, res) => {
  const studentId = req.user.id;

  try {
    const result = await pool.query(
      `SELECT id, category, message, response, status, created_at, responded_at
       FROM public.concerns
       WHERE student_id = $1
       ORDER BY id DESC`,
      [studentId]
    );

    res.status(200).json({ success: true, count: result.rowCount, data: result.rows });
  } catch (err) {
    console.error('Error fetching concerns:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET: Doctor - View assigned or pending concerns
exports.getConcernsForDoctor = async (req, res) => {
  const doctorId = req.user.id;

  try {
    const result = await pool.query(
      `SELECT id, category, message, status, response, responded_by
       FROM public.concerns
       WHERE responded_by = $1 OR status = 'pending'
       ORDER BY id DESC`,
      [doctorId]
    );

    res.status(200).json({ success: true, count: result.rowCount, data: result.rows });
  } catch (err) {
    console.error('Error fetching concerns for doctor:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST: Doctor reply to concern
exports.replyToConcern = async (req, res) => {
  const concernId = req.params.id;
  const doctorId = req.user.id;
  const { reply } = req.body;

  try {
    const check = await pool.query('SELECT * FROM public.concerns WHERE id = $1', [concernId]);
    if (check.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Concern not found' });

    const result = await pool.query(
      `UPDATE public.concerns 
       SET response = $1, responded_by = $2, status = 'responded', responded_at = NOW()
       WHERE id = $3 RETURNING *`,
      [reply, doctorId, concernId]
    );

    res.status(200).json({ success: true, message: 'Reply added successfully', data: result.rows[0] });
  } catch (err) {
    console.error('Error replying to concern:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
