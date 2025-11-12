const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  // Set no-cache headers to prevent accessing protected pages after logout
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');

  // Check for token in Authorization header (for API requests)
  const authHeader = req.headers.authorization;
  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } 
  // Also check for token in cookies (for web requests)
  else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    // For web requests, redirect to login
    if (req.accepts('html')) {
      return res.redirect('/login');
    }
    // For API requests, return JSON error
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    console.error('JWT verification failed:', err.message);
    
    // For web requests, redirect to login
    if (req.accepts('html')) {
      return res.redirect('/login');
    }
    // For API requests, return JSON error
    return res.status(403).json({ success: false, message: 'Invalid or expired token' });
  }
};

module.exports = verifyToken;