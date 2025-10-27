
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    next();
  };
};

exports.authorizeUserOrAdmin = (req, res, next) => {
  const userId = parseInt(req.params.id);
  if (req.user.role === 'admin' || req.user.id === userId) {
    return next();
  }
  return res.status(403).json({ success: false, message: 'Forbidden' });
};