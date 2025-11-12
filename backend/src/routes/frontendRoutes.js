const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const jwt = require('jsonwebtoken');
const auth = require('../middleware/auth');

// Home page
router.get('/', (req, res) => {
    // render shared/home directly to avoid nested include issues
    res.render('shared/home');
});

// Login page
router.get('/login', (req, res) => {
    res.render('auth/login');
});

// Signup page
router.get('/signup', (req, res) => {
    res.render('auth/signup');
});

// Student dashboard - protected route
router.get('/users/:id', auth, async (req, res) => {
    try {
        const userId = req.params.id;
        
        // Verify the user ID matches the authenticated user
        if (req.user.id != userId) {
            return res.status(403).send('Unauthorized');
        }

        const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
        
        if (userResult.rows.length === 0) {
            return res.status(404).send('User not found');
        }

        const user = userResult.rows[0];
        
        // Render different dashboards based on role
        switch(user.role) {
            case 'student':
                res.render('student/dashboard', { user });
                break;
            case 'doctor':
                res.render('doctor/dashboard', { user });
                break;
            case 'admin':
                res.render('admin/dashboard', { user });
                break;
            case 'pharmacy':
                res.render('pharmacy/dashboard', { user });
                break;
            default:
                res.status(400).send('Invalid user role');
        }
    } catch (error) {
        console.error('Error loading dashboard:', error);
        res.status(500).send('Internal server error');
    }
});

// Book appointment page - for students
router.get('/users/:id/appointments', auth, async (req, res) => {
    try {
        const userId = req.params.id;
        
        if (req.user.id != userId) {
            return res.status(403).send('Unauthorized');
        }

        // Fetch available doctors
        const doctorsResult = await pool.query(
            "SELECT id, name, specialization FROM users WHERE role = 'doctor'"
        );

        // Generate time slots (example: 9 AM to 5 PM, hourly)
        const timeSlots = [];
        for (let hour = 9; hour <= 17; hour++) {
            const time = `${hour.toString().padStart(2, '0')}:00`;
            timeSlots.push(time);
        }

        res.render('student/book_appointment', { 
            userid: userId,
            doctors: doctorsResult.rows,
            timeSlots: timeSlots
        });
    } catch (error) {
        console.error('Error loading appointment page:', error);
        res.status(500).send('Internal server error');
    }
});

// Order medicine page - for students
router.get('/users/:id/orders', auth, async (req, res) => {
    try {
        const userId = req.params.id;
        
        if (req.user.id != userId) {
            return res.status(403).send('Unauthorized');
        }

        // Fetch available medicines
        const medicinesResult = await pool.query(
            'SELECT * FROM medicines WHERE stock > 0 ORDER BY name'
        );

        res.render('student/order_medicine', { 
            userid: userId,
            medicines: medicinesResult.rows
        });
    } catch (error) {
        console.error('Error loading order page:', error);
        res.status(500).send('Internal server error');
    }
});

// Request referral page - for students
router.get('/referrals/:id/request', auth, (req, res) => {
    try {
        const userId = req.params.id;
        
        if (req.user.id != userId) {
            return res.status(403).send('Unauthorized');
        }

    res.render('student/request_referral', { userid: userId });
    } catch (error) {
        console.error('Error loading referral page:', error);
        res.status(500).send('Internal server error');
    }
});

// Anonymous concern page - for students
router.get('/concerns/:id', auth, (req, res) => {
    try {
        const userId = req.params.id;
        
        if (req.user.id != userId) {
            return res.status(403).send('Unauthorized');
        }

    res.render('student/anonymous_concern', { userid: userId });
    } catch (error) {
        console.error('Error loading concern page:', error);
        res.status(500).send('Internal server error');
    }
});

// My prescriptions page - for students
router.get('/records/prescriptions/:id', auth, async (req, res) => {
    try {
        const userId = req.params.id;
        
        if (req.user.id != userId) {
            return res.status(403).send('Unauthorized');
        }

        // Fetch user's prescriptions
        const prescriptionsResult = await pool.query(
            'SELECT * FROM prescriptions WHERE student_id = $1 ORDER BY date DESC',
            [userId]
        );

        res.render('student/my_prescriptions', { 
            userid: userId,
            prescriptions: prescriptionsResult.rows
        });
    } catch (error) {
        console.error('Error loading prescriptions:', error);
        res.status(500).send('Internal server error');
    }
});

// Doctor appointments view
router.get('/appointments/doctor/:id', auth, async (req, res) => {
    try {
        const doctorId = req.params.id;
        
        if (req.user.id != doctorId || req.user.role !== 'doctor') {
            return res.status(403).send('Unauthorized');
        }

        // Fetch doctor's appointments
        const appointmentsResult = await pool.query(
            'SELECT * FROM appointments WHERE doctor_id = $1 ORDER BY date DESC, time DESC',
            [doctorId]
        );

        res.render('doctor/view_appointments', { 
            userid: doctorId,
            appointments: appointmentsResult.rows
        });
    } catch (error) {
        console.error('Error loading appointments:', error);
        res.status(500).send('Internal server error');
    }
});

// Doctor - approve referrals
router.get('/referrals/doctor/:id', auth, async (req, res) => {
    try {
        const doctorId = req.params.id;
        
        if (req.user.id != doctorId || req.user.role !== 'doctor') {
            return res.status(403).send('Unauthorized');
        }

        // Fetch pending referrals
        const referralsResult = await pool.query(
            "SELECT * FROM referrals WHERE status = 'pending' ORDER BY requested_at DESC"
        );

        res.render('doctor/approve_referrals', { 
            userid: doctorId,
            referrals: referralsResult.rows
        });
    } catch (error) {
        console.error('Error loading referrals:', error);
        res.status(500).send('Internal server error');
    }
});

// Doctor - respond to concerns
router.get('/concerns/doctor/:id', auth, async (req, res) => {
    try {
        const doctorId = req.params.id;
        
        if (req.user.id != doctorId || req.user.role !== 'doctor') {
            return res.status(403).send('Unauthorized');
        }

        // Fetch pending concerns based on doctor's specialization
        const userResult = await pool.query('SELECT specialization FROM users WHERE id = $1', [doctorId]);
        const specialization = userResult.rows[0]?.specialization;

        const concernsResult = await pool.query(
            "SELECT * FROM concerns WHERE status = 'pending' AND category = $1 ORDER BY created_at DESC",
            [specialization]
        );

        res.render('doctor/respond_to_concern', { 
            userid: doctorId,
            concerns: concernsResult.rows
        });
    } catch (error) {
        console.error('Error loading concerns:', error);
        res.status(500).send('Internal server error');
    }
});

// Doctor - update prescriptions
router.get('/records/:id/edit', auth, (req, res) => {
    try {
        const doctorId = req.params.id;
        
        if (req.user.id != doctorId || req.user.role !== 'doctor') {
            return res.status(403).send('Unauthorized');
        }

    res.render('doctor/update_prescription', { userid: doctorId });
    } catch (error) {
        console.error('Error loading prescription page:', error);
        res.status(500).send('Internal server error');
    }
});

// Pharmacist - view orders
router.get('/pharmacy/orders/:id', auth, async (req, res) => {
    try {
        const pharmacistId = req.params.id;
        
        if (req.user.id != pharmacistId || req.user.role !== 'pharmacy') {
            return res.status(403).send('Unauthorized');
        }

        // Fetch all orders
        const ordersResult = await pool.query(
            'SELECT * FROM orders ORDER BY ordered_at DESC'
        );

        res.render('pharmacy/view_orders', { 
            userid: pharmacistId,
            orders: ordersResult.rows
        });
    } catch (error) {
        console.error('Error loading orders:', error);
        res.status(500).send('Internal server error');
    }
});

// Pharmacist - update stocks
router.get('/pharmacy/stocks/:id', auth, async (req, res) => {
    try {
        const pharmacistId = req.params.id;
        
        if (req.user.id != pharmacistId || req.user.role !== 'pharmacy') {
            return res.status(403).send('Unauthorized');
        }

        // Fetch all medicines
        const medicinesResult = await pool.query(
            'SELECT * FROM medicines ORDER BY name'
        );

        res.render('pharmacy/update_stocks', { 
            userid: pharmacistId,
            medicines: medicinesResult.rows
        });
    } catch (error) {
        console.error('Error loading stocks page:', error);
        res.status(500).send('Internal server error');
    }
});

module.exports = router;
