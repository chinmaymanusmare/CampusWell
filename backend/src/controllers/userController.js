const bcrypt = require('bcrypt'); 
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

exports.signup = async (req, res) => {
  const { name, email, password, role, roll_no, specialization, timePerPatient } = req.body;

  // Validate password presence and basic strength:
  // - minimum 8 characters
  // - at least one letter
  // - at least one digit
  // Special characters are allowed.
  if (!password) {
    return res.status(400).json({ success: false, message: 'Password is required' });
  }

  // Validate timePerPatient for doctors
  if (role === 'doctor') {
    if (!timePerPatient || timePerPatient < 1) {
      return res.status(400).json({ 
        success: false, 
        message: 'Time per patient is required for doctors and must be greater than 0' 
      });
    }
  }

  const pwdRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
  if (!pwdRegex.test(password)) {
    return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long and include at least one letter and one number' });
  }

  try {
    const existinguser = await pool.query("SELECT * FROM public.users WHERE email = $1;", [email]);

    if (existinguser.rows.length > 0)
      return res.status(400).json({ success: false, message: "User already exists" });

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const result = await pool.query(
      "INSERT INTO public.users(name, email, password, role, roll_number, specialization, time_per_patient) VALUES ($1, $2, $3, $4, $5, $6, $7);",
      [name, email, hashedPassword, role, roll_no, specialization, role === 'doctor' ? timePerPatient : null]
    );

    res.status(201).json({ success: true, user: result.rows[0] });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const userResult = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(400).json({ success: false, message: "Invalid credentials" });
    }

    const user = userResult.rows[0];

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(400).json({ success: false, message: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: '10m'
    });

    res.status(200).json({ success: true, token });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};


exports.getUserById = async (req, res) => {
  const userId = req.params.id;
  try {
    const result = await pool.query(
      "SELECT id, name, email, role, roll_number, specialization FROM public.users WHERE id = $1",
      [userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    res.status(200).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error fetching user:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getAllUsersForAdmin = async (req, res) => {
  try {
    const result = await pool.query("SELECT id, name, email, role, roll_number, specialization FROM public.users;");
    res.status(200).json({
      success: true,
      count: result.rowCount,
      data: result.rows
    });
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.updateUserById = async (req, res) => {
  const userId = req.params.id;
  const { name, email, role, roll_no, specialization, timePerPatient } = req.body;

  // Validate timePerPatient for doctors
  if (role === 'doctor' && (!timePerPatient || timePerPatient < 1)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Time per patient is required for doctors and must be greater than 0' 
    });
  }
  try {
    const result = await pool.query(
      `UPDATE public.users 
       SET name = $1, email = $2, role = $3, roll_number = $4, specialization = $5, time_per_patient = $6
       WHERE id = $7
       RETURNING id, name, email, role, roll_number, specialization, time_per_patient`,
      [name, email, role, roll_no, specialization, role === 'doctor' ? timePerPatient : null, userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};


// exports.logout = async (req, res) => {
  
//   res.status(200).json({ success: true, message: "User logged out successfully" });
// };

exports.logout = (req, res) => {
  res.clearCookie('refreshToken'); // remove refresh token
  res.status(200).json({ success: true, message: "Logged out successfully" });
};

exports.updateTimePerPatient = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const { timePerPatient } = req.body;

    // Validate input
    if (!timePerPatient || timePerPatient < 1) {
      return res.status(400).json({
        success: false,
        message: 'Time per patient must be greater than 0'
      });
    }

    // Verify user is a doctor
    const doctorCheck = await pool.query(
      "SELECT role FROM users WHERE id = $1",
      [doctorId]
    );

    if (doctorCheck.rows.length === 0 || doctorCheck.rows[0].role !== 'doctor') {
      return res.status(403).json({
        success: false,
        message: 'Only doctors can update time per patient'
      });
    }

    // Update the time_per_patient
    const result = await pool.query(
      `UPDATE users 
       SET time_per_patient = $1
       WHERE id = $2 AND role = 'doctor'
       RETURNING id, name, time_per_patient`,
      [timePerPatient, doctorId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    // Check if this affects any existing availability slots
    const availabilityCheck = await pool.query(
      `SELECT COUNT(*) 
       FROM doctor_availability da 
       WHERE da.doctor_id = $1 
       AND da.date >= CURRENT_DATE`,
      [doctorId]
    );

    let message = 'Time per patient updated successfully';
    if (parseInt(availabilityCheck.rows[0].count) > 0) {
      message += '. Note: This change will affect your existing availability slots.';
    }

    res.status(200).json({
      success: true,
      message,
      data: result.rows[0]
    });
  } catch (err) {
    console.error('Error updating time per patient:', err);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

