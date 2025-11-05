const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const {
    setAvailability,
    getAvailability,
    deleteAvailability
} = require('../controllers/availabilityController');

// Set availability (doctors only)
router.post('/', auth, authorize('doctor'), setAvailability);

// Get availability (for doctors and students)
router.get('/', auth, getAvailability); // Get all availabilities
router.get('/:doctorId', auth, getAvailability); // Get availability for specific doctor

// Delete availability (doctors only)
router.delete('/:id', auth, authorize('doctor'), deleteAvailability);

module.exports = router;