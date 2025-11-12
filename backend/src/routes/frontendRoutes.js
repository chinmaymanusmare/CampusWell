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
            return res.status(403).render('error/403');
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
            return res.status(403).render('error/403');
        }

        // Fetch available doctors
        const doctorsResult = await pool.query(
            "SELECT id, name, specialization FROM users WHERE role = 'doctor' ORDER BY name"
        );

        // Fetch available appointment slots from doctor_availability table
        // Only show slots for today and future dates
        const availableSlotsResult = await pool.query(
            `SELECT 
                da.id,
                da.doctor_id,
                da.date,
                da.start_time,
                da.end_time,
                da.max_patients,
                COALESCE(u.time_per_patient, 15) as time_per_patient,
                u.name as doctor_name,
                u.specialization,
                COALESCE(
                    (SELECT COUNT(*) 
                     FROM appointments a 
                     WHERE a.doctor_id = da.doctor_id 
                     AND a.date = da.date 
                         AND a.time = da.start_time::VARCHAR 
                     AND a.status != 'cancelled'),
                    0
                ) as booked_slots,
                da.max_patients - COALESCE(
                    (SELECT COUNT(*) 
                     FROM appointments a 
                     WHERE a.doctor_id = da.doctor_id 
                     AND a.date = da.date 
                         AND a.time = da.start_time::VARCHAR 
                     AND a.status != 'cancelled'),
                    0
                ) as available_slots
             FROM doctor_availability da
             LEFT JOIN users u ON da.doctor_id = u.id
             WHERE da.date >= CURRENT_DATE
             ORDER BY da.date, da.start_time, u.name`
        );

        res.render('student/book_appointment', { 
            userid: userId,
            doctors: doctorsResult.rows,
            availableSlots: availableSlotsResult.rows
        });
    } catch (error) {
        console.error('Error loading appointment page:', error);
        res.status(500).render('error/500');
    }
});

// Book appointment - handle form submission
router.post('/book-appointment', auth, async (req, res) => {
    try {
        const student_id = req.user.id;
        const { doctor, date, time } = req.body;
        
        console.log('Booking request:', { doctor, date, time, rawBody: req.body });
        
        // Validate inputs
        if (!doctor || !date || !time) {
            console.error('Missing required fields:', { doctor, date, time });
            return res.status(400).send('Missing required fields: doctor, date, or time');
        }
        
        // Parse doctor field (format: "id,name")
        const [doctor_id, doctor_name] = doctor.split(',');
        
        // Handle date - could be already formatted or a Date object string
        let dateOnly = date;
        if (date.includes('T')) {
            dateOnly = date.split('T')[0];
        } else if (date.includes(' ')) {
            // If it's like "Wed Nov 13 2025"
            const d = new Date(date);
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            dateOnly = `${year}-${month}-${day}`;
        }
        
        console.log('Processed date:', dateOnly);
        
        // Check if student already has an appointment with this doctor at this time
        const duplicateCheck = await pool.query(
            `SELECT id FROM appointments 
             WHERE student_id = $1 
             AND doctor_id = $2 
             AND date = $3 
             AND time = $4 
             AND status != 'cancelled'`,
            [student_id, doctor_id, dateOnly, time]
        );
        
        if (duplicateCheck.rows.length > 0) {
            console.log('Duplicate appointment detected');
            return res.status(400).send(`
                <html>
                <head><title>Booking Error</title></head>
                <body style="font-family: Arial; padding: 50px; text-align: center;">
                    <h2 style="color: #dc3545;">❌ Booking Failed</h2>
                    <p>You already have an appointment with this doctor at this time slot.</p>
                    <p>Please choose a different time or doctor.</p>
                    <a href="/users/${student_id}/appointments" style="color: #0d6efd; text-decoration: none; font-weight: bold;">← Back to Book Appointment</a>
                </body>
                </html>
            `);
        }
        
        // Get student name
        const studentResult = await pool.query(
            'SELECT name FROM users WHERE id = $1',
            [student_id]
        );
        const student_name = studentResult.rows[0]?.name;

        // Insert appointment
        const result = await pool.query(
            `INSERT INTO appointments (student_id, student_name, doctor_id, doctor_name, date, time, status)
             VALUES ($1, $2, $3, $4, $5, $6, 'scheduled')
             RETURNING *`,
            [student_id, student_name, doctor_id, doctor_name, dateOnly, time]
        );

        console.log('Appointment created:', result.rows[0]);
        
        // Redirect back to appointments page with success message
        res.redirect(`/users/${student_id}/appointments?success=true`);
    } catch (error) {
        console.error('Error booking appointment:', error);
        res.status(500).render('error/500');
    }
});

// Order medicine page - for students
router.get('/users/:id/orders', auth, async (req, res) => {
    try {
        const userId = req.params.id;
        
        if (req.user.id != userId) {
            return res.status(403).render('error/403');
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
router.get('/referrals/:id/request', auth, async (req, res) => {
    try {
        const userId = req.params.id;
        
        if (req.user.id != userId) {
            return res.status(403).render('error/403');
        }

        // Fetch available doctors
        const doctorsResult = await pool.query(
            "SELECT id, name, specialization FROM users WHERE role = 'doctor'"
        );

        res.render('student/request_referral', { 
            userid: userId,
            doctors: doctorsResult.rows
        });
    } catch (error) {
        console.error('Error loading referral page:', error);
        res.status(500).send('Internal server error');
    }
});

// Anonymous concern page - for students
router.get('/concerns/:id', auth, async (req, res) => {
    try {
        const userId = req.params.id;
        
        if (req.user.id != userId) {
            return res.status(403).render('error/403');
        }

        // Fetch user's concerns
        const concernsResult = await pool.query(
            'SELECT * FROM concerns WHERE student_id = $1 ORDER BY created_at DESC',
            [userId]
        );

        res.render('student/anonymous_concern', { 
            userid: userId,
            concerns: concernsResult.rows
        });
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
            return res.status(403).render('error/403');
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
            return res.status(403).render('error/403');
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
            return res.status(403).render('error/403');
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
            return res.status(403).render('error/403');
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
router.get('/records/:id/edit', auth, async (req, res) => {
    try {
        const doctorId = req.params.id;
        
        if (req.user.id != doctorId || req.user.role !== 'doctor') {
            return res.status(403).render('error/403');
        }

        // Fetch doctor name
        const userResult = await pool.query('SELECT name FROM users WHERE id = $1', [doctorId]);
        const username = userResult.rows[0]?.name || 'Doctor';

        res.render('doctor/update_prescription', { 
            userid: doctorId,
            username: username
        });
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
            return res.status(403).render('error/403');
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
            return res.status(403).render('error/403');
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

// Admin: Add Doctor page
router.get('/admin/add-doctor', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).render('error/403');
        }

        const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
        res.render('admin/add_doctor', { user: userResult.rows[0] });
    } catch (error) {
        console.error('Error loading add doctor page:', error);
        res.status(500).render('error/500');
    }
});

// Admin: Add Doctor - POST handler
router.post('/admin/add-doctor', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).render('error/403');
        }

        const { name, email, username, password, specialization, phone, timePerPatient } = req.body;

        // Call the API endpoint to create the user
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash(password, 10);

        const newDoctor = await pool.query(
            `INSERT INTO users (name, email, username, password, role, specialization, phone, time_per_patient) 
             VALUES ($1, $2, $3, $4, 'doctor', $5, $6, $7) RETURNING id`,
            [name, email, username, hashedPassword, specialization, phone || null, timePerPatient || 15]
        );

        const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
        res.render('admin/add_doctor', { 
            user: userResult.rows[0], 
            success: 'Doctor added successfully!' 
        });
    } catch (error) {
        console.error('Error adding doctor:', error);
        const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
        res.render('admin/add_doctor', { 
            user: userResult.rows[0], 
            error: error.message || 'Failed to add doctor. Email or username may already exist.' 
        });
    }
});

// Admin: Add Pharmacist page
router.get('/admin/add-pharmacist', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).render('error/403');
        }

        const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
        res.render('admin/add_pharmacist', { user: userResult.rows[0] });
    } catch (error) {
        console.error('Error loading add pharmacist page:', error);
        res.status(500).render('error/500');
    }
});

// Admin: Add Pharmacist - POST handler
router.post('/admin/add-pharmacist', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).render('error/403');
        }

        const { name, email, username, password, phone, pharmacy_note } = req.body;

        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash(password, 10);

        const newPharmacist = await pool.query(
            `INSERT INTO users (name, email, username, password, role, phone, pharmacy_note) 
             VALUES ($1, $2, $3, $4, 'pharmacy', $5, $6) RETURNING id`,
            [name, email, username, hashedPassword, phone || null, pharmacy_note || null]
        );

        const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
        res.render('admin/add_pharmacist', { 
            user: userResult.rows[0], 
            success: 'Pharmacist added successfully!' 
        });
    } catch (error) {
        console.error('Error adding pharmacist:', error);
        const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
        res.render('admin/add_pharmacist', { 
            user: userResult.rows[0], 
            error: error.message || 'Failed to add pharmacist. Email or username may already exist.' 
        });
    }
});

// Admin: Remove Doctor page
router.get('/admin/remove-doctor', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).render('error/403');
        }

        const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
        const doctorsResult = await pool.query(
            "SELECT id, name, email, specialization, phone FROM users WHERE role = 'doctor' ORDER BY name"
        );
        
        res.render('admin/remove_doctor', { 
            user: userResult.rows[0],
            doctors: doctorsResult.rows
        });
    } catch (error) {
        console.error('Error loading remove doctor page:', error);
        res.status(500).render('error/500');
    }
});

// Admin: Remove Doctor - POST handler
router.post('/admin/remove-doctor', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).render('error/403');
        }

        const { doctorId } = req.body;

        // Delete the doctor
        await pool.query('DELETE FROM users WHERE id = $1 AND role = $2', [doctorId, 'doctor']);

        const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
        const doctorsResult = await pool.query(
            "SELECT id, name, email, specialization, phone FROM users WHERE role = 'doctor' ORDER BY name"
        );
        
        res.render('admin/remove_doctor', { 
            user: userResult.rows[0],
            doctors: doctorsResult.rows,
            success: 'Doctor removed successfully!' 
        });
    } catch (error) {
        console.error('Error removing doctor:', error);
        const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
        const doctorsResult = await pool.query(
            "SELECT id, name, email, specialization, phone FROM users WHERE role = 'doctor' ORDER BY name"
        );
        
        res.render('admin/remove_doctor', { 
            user: userResult.rows[0],
            doctors: doctorsResult.rows,
            error: 'Failed to remove doctor. They may have associated appointments.' 
        });
    }
});

// Admin: Remove Pharmacist page
router.get('/admin/remove-pharmacist', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).render('error/403');
        }

        const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
        const pharmacistsResult = await pool.query(
            "SELECT id, name, email, username, phone FROM users WHERE role = 'pharmacy' ORDER BY name"
        );
        
        res.render('admin/remove_pharmacist', { 
            user: userResult.rows[0],
            pharmacists: pharmacistsResult.rows
        });
    } catch (error) {
        console.error('Error loading remove pharmacist page:', error);
        res.status(500).render('error/500');
    }
});

// Admin: Remove Pharmacist - POST handler
router.post('/admin/remove-pharmacist', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).render('error/403');
        }

        const { pharmacistId } = req.body;

        // Delete the pharmacist
        await pool.query('DELETE FROM users WHERE id = $1 AND role = $2', [pharmacistId, 'pharmacy']);

        const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
        const pharmacistsResult = await pool.query(
            "SELECT id, name, email, username, phone FROM users WHERE role = 'pharmacy' ORDER BY name"
        );
        
        res.render('admin/remove_pharmacist', { 
            user: userResult.rows[0],
            pharmacists: pharmacistsResult.rows,
            success: 'Pharmacist removed successfully!' 
        });
    } catch (error) {
        console.error('Error removing pharmacist:', error);
        const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
        const pharmacistsResult = await pool.query(
            "SELECT id, name, email, username, phone FROM users WHERE role = 'pharmacy' ORDER BY name"
        );
        
        res.render('admin/remove_pharmacist', { 
            user: userResult.rows[0],
            pharmacists: pharmacistsResult.rows,
            error: 'Failed to remove pharmacist.' 
        });
    }
});

// Student: View My Appointments page
router.get('/users/:id/appointments/view', auth, async (req, res) => {
    try {
        const userId = req.params.id;
        
        if (req.user.id != userId) {
            return res.status(403).render('error/403');
        }

        // Fetch appointments with doctor information
        const appointmentsResult = await pool.query(
            `SELECT 
                a.id, 
                a.date, 
                a.time, 
                a.reason, 
                a.status,
                u.name as doctor_name,
                u.specialization
             FROM appointments a
             LEFT JOIN users u ON a.doctor_id = u.id
             WHERE a.student_id = $1
             ORDER BY a.date DESC, a.time DESC`,
            [userId]
        );

        res.render('student/my_appointments', { 
            userid: userId,
            appointments: appointmentsResult.rows
        });
    } catch (error) {
        console.error('Error loading my appointments page:', error);
        res.status(500).render('error/500');
    }
});

// Student: View My Orders page
router.get('/users/:id/orders/view', auth, async (req, res) => {
    try {
        const userId = req.params.id;
        
        if (req.user.id != userId) {
            return res.status(403).render('error/403');
        }

        // Fetch orders with medicine details
        const ordersResult = await pool.query(
            `SELECT 
                o.id,
                o.status,
                o.prescription_id,
                o.ordered_at as created_at,
                o.total
             FROM orders o
             WHERE o.student_id = $1
             ORDER BY o.ordered_at DESC`,
            [userId]
        );

        // For each order, fetch the medicines
        const ordersWithMedicines = await Promise.all(
            ordersResult.rows.map(async (order) => {
                const medicinesResult = await pool.query(
                    `SELECT 
                        oi.medicine_id,
                        oi.quantity,
                        m.name,
                        m.category
                     FROM order_items oi
                     LEFT JOIN medicines m ON oi.medicine_id = m.id
                     WHERE oi.order_id = $1`,
                    [order.id]
                );
                return {
                    ...order,
                    medicines: medicinesResult.rows
                };
            })
        );

        res.render('student/my_orders', { 
            userid: userId,
            orders: ordersWithMedicines
        });
    } catch (error) {
        console.error('Error loading my orders page:', error);
        res.status(500).render('error/500');
    }
});

// Doctor: Set Availability page
router.get('/doctors/:id/availability/create', auth, async (req, res) => {
    try {
        const doctorId = req.params.id;
        
        if (req.user.id != doctorId || req.user.role !== 'doctor') {
            return res.status(403).render('error/403');
        }

        // Get doctor's time per patient
        const doctorResult = await pool.query(
            'SELECT time_per_patient FROM users WHERE id = $1',
            [doctorId]
        );

        const timePerPatient = doctorResult.rows[0]?.time_per_patient || 15;
        const today = new Date().toISOString().split('T')[0];

        res.render('doctor/set_availability', { 
            userid: doctorId,
            timePerPatient,
            today
        });
    } catch (error) {
        console.error('Error loading set availability page:', error);
        res.status(500).render('error/500');
    }
});

// Doctor: View Schedule page
router.get('/doctors/:id/availability/view', auth, async (req, res) => {
    try {
        const doctorId = req.params.id;
        
        if (req.user.id != doctorId || req.user.role !== 'doctor') {
            return res.status(403).render('error/403');
        }

        // Fetch doctor's availability schedule
        const scheduleResult = await pool.query(
            `SELECT 
                da.id,
                da.date,
                da.start_time,
                da.end_time,
                da.max_patients,
                EXTRACT(EPOCH FROM (da.end_time - da.start_time))/60 as duration,
                COALESCE(
                    (SELECT COUNT(*) 
                     FROM appointments a 
                     WHERE a.doctor_id = da.doctor_id 
                     AND a.date = da.date 
                     AND a.time = da.start_time::VARCHAR 
                     AND a.status != 'cancelled'),
                    0
                ) as booked_slots
             FROM doctor_availability da
             WHERE da.doctor_id = $1 AND da.date >= CURRENT_DATE
             ORDER BY da.date, da.start_time`,
            [doctorId]
        );

        // Calculate statistics
        const totalSlots = scheduleResult.rows.length;
        const totalBooked = scheduleResult.rows.reduce((sum, slot) => sum + parseInt(slot.booked_slots), 0);
        const availableCapacity = scheduleResult.rows.reduce((sum, slot) => 
            sum + (slot.max_patients - parseInt(slot.booked_slots)), 0
        );

        res.render('doctor/view_schedule', { 
            userid: doctorId,
            schedule: scheduleResult.rows,
            totalSlots,
            totalBooked,
            availableCapacity
        });
    } catch (error) {
        console.error('Error loading schedule page:', error);
        res.status(500).render('error/500');
    }
});

module.exports = router;
