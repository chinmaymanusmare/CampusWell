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

const {
  getAllUsersForAdmin,
  getUserById,
  updateUserById,
  updateTimePerPatient
} = require('../controllers/userController');

const verifyToken = require('../middleware/auth');
const { authorize, authorizeUserOrAdmin } = require('../middleware/authorize');

router.get('/', verifyToken, authorize('admin'), getAllUsersForAdmin);
router.get('/:id', verifyToken, authorizeUserOrAdmin, getUserById);
router.put('/:id', verifyToken, authorizeUserOrAdmin, updateUserById);

// New endpoint for updating time per patient (doctors only)
router.put('/doctor/time-per-patient', verifyToken, authorize('doctor'), updateTimePerPatient);

module.exports = router;
