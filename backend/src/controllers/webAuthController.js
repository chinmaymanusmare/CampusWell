const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

// Web-based login for form submissions (redirects to dashboard)
exports.webLogin = async (req, res) => {
  const { email, password, role } = req.body;

  try {
    const userResult = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(400).send('<h1>Invalid credentials</h1><a href="/login">Try again</a>');
    }

    const user = userResult.rows[0];

    // Verify role matches
    if (role && user.role !== role) {
      return res.status(400).send('<h1>Invalid role selected</h1><a href="/login">Try again</a>');
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(400).send('<h1>Invalid credentials</h1><a href="/login">Try again</a>');
    }

    // Create JWT token
    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: '24h' // Longer expiry for web sessions
    });

    // Set token in cookie
    res.cookie('token', token, {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'lax'
    });

    // Redirect to user dashboard
    res.redirect(`/users/${user.id}`);

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).send('<h1>Server error</h1><a href="/login">Try again</a>');
  }
};

// Web-based signup
exports.webSignup = async (req, res) => {
  const { name, email, password, role, roll_no, specialization, timePerPatient } = req.body;

  // Validate password
  if (!password) {
    return res.status(400).send('<h1>Password is required</h1><a href="/signup">Try again</a>');
  }

  const pwdRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
  if (!pwdRegex.test(password)) {
    return res.status(400).send('<h1>Password must be at least 8 characters long and include at least one letter and one number</h1><a href="/signup">Try again</a>');
  }

  try {
    const existinguser = await pool.query("SELECT * FROM public.users WHERE email = $1;", [email]);

    if (existinguser.rows.length > 0) {
      return res.status(400).send('<h1>User already exists</h1><a href="/login">Login instead</a>');
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const result = await pool.query(
      "INSERT INTO public.users( name, email, password, role, roll_number, specialization, time_per_patient) VALUES ( $1, $2, $3, $4, $5, $6, $7) RETURNING *;",
      [name, email, hashedPassword, role, roll_no, specialization, timePerPatient]
    );

    const user = result.rows[0];

    // Create JWT token
    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: '24h'
    });

    // Set token in cookie
    res.cookie('token', token, {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: 'lax'
    });

    // Redirect to user dashboard
    res.redirect(`/users/${user.id}`);

  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).send('<h1>Server error</h1><a href="/signup">Try again</a>');
  }
};

// Web-based logout
exports.webLogout = (req, res) => {
  // Clear the token cookie with all the same options used when setting it
  res.clearCookie('token', {
    httpOnly: true,
    sameSite: 'lax'
  });
  
  // Set cache control headers to prevent caching
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  
  res.redirect('/login');
};
