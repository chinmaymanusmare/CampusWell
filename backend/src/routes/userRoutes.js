// const express = require('express');
// const router = express.Router();
// const { getAllUsersForAdmin, getUserById, updateUserById } = require('../controllers/userController');
// const authenticate = require('../middleware/auth');
// const authorize = require('../middleware/authorize');

// router.get('/', authenticate, authorize('admin'), getAllUsersForAdmin);
// router.get('/:id', authenticate, getUserById);
// router.put('/:id', authenticate, updateUserById);

// module.exports = router;

// const express = require('express');
// const router = express.Router();
// const { authenticate } = require('../middleware/auth');
// // Correct import
// const { authorize, authorizeUserOrAdmin } = require('../middleware/authorize');

// const { getAllUsersForAdmin, getUserById, updateUserById } = require('../controllers/userController');

// router.get('/', authenticate, authorize('admin'), getAllUsersForAdmin);
// router.get('/:id', authenticate, authorizeUserOrAdmin, getUserById);
// router.put('/:id', authenticate, authorizeUserOrAdmin, updateUserById);

// module.exports = router;
const express = require('express');
const router = express.Router();

// Controllers
const {
  getAllUsersForAdmin,
  getUserById,
  updateUserById
} = require('../controllers/userController');

// Middleware
const authenticate = require('../middleware/auth');
const { authorize, authorizeUserOrAdmin } = require('../middleware/authorize');

// Routes

// Admin-only route: get all users
router.get('/', authenticate, authorize('admin'), getAllUsersForAdmin);

// Admin or the user itself can get a specific user
router.get('/:id', authenticate, authorizeUserOrAdmin, getUserById);

// Admin or the user itself can update a specific user
router.put('/:id', authenticate, authorizeUserOrAdmin, updateUserById);

module.exports = router;
