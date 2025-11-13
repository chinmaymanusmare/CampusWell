const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const jwt = require('jsonwebtoken');
const auth = require('../middleware/auth');
const bcrypt = require('bcryptjs');

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

// Profile - GET (self)
router.get('/profile', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await pool.query('SELECT id, name, email, role, roll_number, specialization, time_per_patient FROM users WHERE id = $1', [userId]);
        if (result.rows.length === 0) {
            return res.status(404).render('error/404');
        }
        const user = result.rows[0];
        res.render('shared/profile', { user, success: null, error: null });
    } catch (error) {
        console.error('Error loading profile:', error);
        res.status(500).render('error/500');
    }
});

// Profile - POST (update self)
router.post('/profile', auth, async (req, res) => {
    const userId = req.user.id;
    const role = req.user.role;
    const { name, email } = req.body;
    let roll_no = req.body.roll_no;
    let specialization = req.body.specialization;
    let timePerPatient = req.body.timePerPatient;

    try {
        const current = await pool.query('SELECT id, name, email, role, roll_number, specialization, time_per_patient FROM users WHERE id = $1', [userId]);
        if (current.rows.length === 0) {
            return res.status(404).render('error/404');
        }

        // Basic validation
        if (!name || !email) {
            return res.render('shared/profile', { user: current.rows[0], error: 'Name and Email are required.', success: null });
        }

        if (role === 'doctor') {
            // Normalize timePerPatient
            if (timePerPatient !== undefined && timePerPatient !== '') {
                const tpp = parseInt(timePerPatient, 10);
                if (!Number.isInteger(tpp) || tpp <= 0) {
                    return res.render('shared/profile', { user: current.rows[0], error: 'Time per patient must be a positive integer.', success: null });
                }
                timePerPatient = tpp;
            } else {
                timePerPatient = null;
            }

            const update = await pool.query(
                `UPDATE users SET name = $1, email = $2, specialization = $3, time_per_patient = $4 WHERE id = $5
                 RETURNING id, name, email, role, roll_number, specialization, time_per_patient`,
                [name, email, specialization || null, timePerPatient, userId]
            );
            return res.render('shared/profile', { user: update.rows[0], success: 'Profile updated successfully.', error: null });
        }

        if (role === 'student') {
            const update = await pool.query(
                `UPDATE users SET name = $1, email = $2, roll_number = $3 WHERE id = $4
                 RETURNING id, name, email, role, roll_number, specialization, time_per_patient`,
                [name, email, roll_no || null, userId]
            );
            return res.render('shared/profile', { user: update.rows[0], success: 'Profile updated successfully.', error: null });
        }

        // Other roles (admin, pharmacist): name + email
        const update = await pool.query(
            `UPDATE users SET name = $1, email = $2 WHERE id = $3
             RETURNING id, name, email, role, roll_number, specialization, time_per_patient`,
            [name, email, userId]
        );
        return res.render('shared/profile', { user: update.rows[0], success: 'Profile updated successfully.', error: null });
    } catch (error) {
        console.error('Error updating profile:', error);
        const fallback = await pool.query('SELECT id, name, email, role, roll_number, specialization, time_per_patient FROM users WHERE id = $1', [userId]);
        res.render('shared/profile', { user: fallback.rows[0], error: 'Failed to update profile. Please try again.', success: null });
    }
});
// Generic Change Password - GET (for any authenticated user)
router.get('/change-password', auth, async (req, res) => {
    try {
        const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
        res.render('shared/change-password', { user: userResult.rows[0], success: null, error: null });
    } catch (error) {
        console.error('Error loading change-password page:', error);
        res.status(500).render('error/500');
    }
});

// Generic Change Password - POST (self-service)
router.post('/change-password', auth, async (req, res) => {
    try {
        const { oldpassword, newpassword } = req.body;
        const userId = req.user.id;

        const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
        if (userResult.rows.length === 0) {
            return res.render('shared/change-password', { user: null, error: 'User not found.', success: null });
        }

        const user = userResult.rows[0];
        const match = await bcrypt.compare(oldpassword, user.password);
        if (!match) {
            return res.render('shared/change-password', { user, error: 'Current password is incorrect.', success: null });
        }

        const hashedPassword = await bcrypt.hash(newpassword, 10);
        await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, userId]);

        res.render('shared/change-password', { user, success: 'Password updated successfully!', error: null });
    } catch (error) {
        console.error('Error updating password:', error);
        const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
        res.render('shared/change-password', { user: userResult.rows[0], error: 'Failed to update password. Please try again.', success: null });
    }
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
            availableSlots: availableSlotsResult.rows,
            success: req.query.success === 'true'
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
            medicines: medicinesResult.rows,
            success: req.query.success === 'true' ? 'Order placed successfully! 🎉' : null
        });
    } catch (error) {
        console.error('Error loading order page:', error);
        res.status(500).send('Internal server error');
    }
});

// Order medicine - handle form submission
router.post('/order-medicines', auth, async (req, res) => {
    try {
        const studentId = req.user.id;
        const { medicines, prescription_link } = req.body;

        console.log('Order request:', { medicines, prescription_link });

        // Parse medicines if it's a string
        let medicineItems;
        if (typeof medicines === 'string') {
            try {
                medicineItems = JSON.parse(medicines);
            } catch (e) {
                return res.status(400).send('Invalid medicines data');
            }
        } else {
            medicineItems = medicines;
        }

        // Validate
        if (!Array.isArray(medicineItems) || medicineItems.length === 0) {
            return res.status(400).send('Please add at least one medicine');
        }

        // Get student name
        const userResult = await pool.query('SELECT name FROM users WHERE id = $1', [studentId]);
        const studentName = userResult.rows[0].name;

        // Begin transaction
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            let totalAmount = 0;

            // Validate all medicines and calculate total
            for (const item of medicineItems) {
                const { medicine_id, quantity } = item;

                if (!medicine_id || !quantity || quantity < 1) {
                    throw new Error('Invalid medicine or quantity');
                }

                // Get medicine details
                const medResult = await client.query(
                    'SELECT * FROM medicines WHERE id = $1',
                    [medicine_id]
                );

                if (medResult.rows.length === 0) {
                    throw new Error(`Medicine not found`);
                }

                const medicine = medResult.rows[0];

                if (medicine.stock < quantity) {
                    throw new Error(`Not enough stock for ${medicine.name}. Available: ${medicine.stock}`);
                }

                totalAmount += medicine.price * quantity;
            }

            // Create order
            const orderResult = await client.query(
                `INSERT INTO orders (student_id, student_name, total, prescription_link)
                 VALUES ($1, $2, $3, $4) RETURNING id`,
                [studentId, studentName, totalAmount, prescription_link || null]
            );

            const orderId = orderResult.rows[0].id;

            // Insert all order items and update stock
            for (const item of medicineItems) {
                const { medicine_id, quantity } = item;

                // Insert into order_medicines
                await client.query(
                    `INSERT INTO order_medicines (order_id, medicine_id, quantity)
                     VALUES ($1, $2, $3)`,
                    [orderId, medicine_id, quantity]
                );

                // Decrease stock
                await client.query(
                    `UPDATE medicines SET stock = stock - $1 WHERE id = $2`,
                    [quantity, medicine_id]
                );
            }

            await client.query('COMMIT');

            console.log('Order created:', orderId);

            // Redirect back with success message
            res.redirect(`/users/${studentId}/orders?success=true`);
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error placing order:', error);
        res.status(500).send(`Error placing order: ${error.message}`);
    }
});

// Request referral page - for students
router.get('/referrals/:id/request', auth, async (req, res) => {
    try {
        const userId = req.params.id;
        
        if (req.user.id != userId) {
            return res.status(403).render('error/403');
        }

        res.render('student/request_referral', { 
            userid: userId,
            success: req.query.success === 'true' ? 'Referral request submitted successfully! A doctor will review it soon.' : null
        });
    } catch (error) {
        console.error('Error loading referral page:', error);
        res.status(500).send('Internal server error');
    }
});

// Request referral - handle form submission
router.post('/request-referral', auth, async (req, res) => {
    try {
        const studentId = req.user.id;
        const { reason, details } = req.body;

        console.log('Referral request:', { studentId, reason, details });

        // Validate input
        if (!reason || reason.trim() === '') {
            return res.status(400).send('Please provide a reason for the referral');
        }

        // Get student name
        const userResult = await pool.query('SELECT name FROM users WHERE id = $1', [studentId]);
        if (userResult.rows.length === 0) {
            return res.status(404).send('Student not found');
        }

        const studentName = userResult.rows[0].name;

        // Combine reason and details
        const fullReason = details ? `${reason}\n\nAdditional Details: ${details}` : reason;

        // Insert referral request
        const result = await pool.query(
            `INSERT INTO referrals (student_id, student_name, reason, status, requested_at)
             VALUES ($1, $2, $3, 'pending', CURRENT_TIMESTAMP)
             RETURNING id`,
            [studentId, studentName, fullReason]
        );

        console.log('Referral created:', result.rows[0].id);

        // Redirect back with success message
        res.redirect(`/referrals/${studentId}/request?success=true`);
    } catch (error) {
        console.error('Error creating referral:', error);
        res.status(500).send(`Error creating referral: ${error.message}`);
    }
});

// View referral status - for students
router.get('/referrals/:id/view', auth, async (req, res) => {
    try {
        const userId = req.params.id;
        
        if (req.user.id != userId) {
            return res.status(403).render('error/403');
        }

        // Fetch student's referrals
        const referralsResult = await pool.query(
            'SELECT * FROM referrals WHERE student_id = $1 ORDER BY requested_at DESC',
            [userId]
        );

        res.render('student/my_referrals', { 
            userId: userId,
            referrals: referralsResult.rows,
            success: req.query.success === 'true' ? 'Referral submitted successfully!' : null
        });
    } catch (error) {
        console.error('Error loading referrals:', error);
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

        // Fetch user's concerns with responder name (if responded)
        const concernsResult = await pool.query(
            `SELECT 
                c.*, 
                u.name AS replied_by_name
             FROM concerns c
             LEFT JOIN users u ON c.responded_by = u.id
             WHERE c.student_id = $1
             ORDER BY c.created_at DESC`,
            [userId]
        );

        res.render('student/anonymous_concern', { 
            userid: userId,
            concerns: concernsResult.rows,
            success: req.query.success === 'true' ? 'Concern submitted successfully!' : null
        });
    } catch (error) {
        console.error('Error loading concern page:', error);
        res.status(500).send('Internal server error');
    }
});

// Anonymous concern - new post form
router.get('/concerns/newconcern/:id', auth, async (req, res) => {
    try {
        const userId = req.params.id;

        if (req.user.id != userId || req.user.role !== 'student') {
            return res.status(403).render('error/403');
        }

        res.render('student/new_concern', { userid: userId });
    } catch (error) {
        console.error('Error loading new concern form:', error);
        res.status(500).send('Internal server error');
    }
});

// Anonymous concern - create (uses API controller)
router.post('/concerns/newconcern', auth, async (req, res) => {
    try {
        if (req.user.role !== 'student') {
            return res.status(403).render('error/403');
        }

        const concernController = require('../controllers/concernController');

        // Create mock req/res to call API controller
        const mockReq = {
            user: req.user,
            body: { category: req.body.category, message: req.body.message }
        };

        let success = false;
        const mockRes = {
            status: (code) => ({
                json: (data) => {
                    success = data.success;
                }
            })
        };

        await concernController.submitConcern(mockReq, mockRes);

        if (success) {
            return res.redirect(`/concerns/${req.user.id}?success=true`);
        }

        res.status(500).send('Failed to submit concern');
    } catch (error) {
        console.error('Error submitting concern:', error);
        res.status(500).send('Internal server error');
    }
});

// Doctor - respond to concerns (POST handler)
router.post('/respond-concerns', auth, async (req, res) => {
    try {
        if (req.user.role !== 'doctor') {
            return res.status(403).render('error/403');
        }

        const { concern_id, response } = req.body;
        const concernController = require('../controllers/concernController');

        const mockReq = {
            user: req.user,
            params: { id: concern_id },
            body: { reply: response }
        };

        let success = false;
        const mockRes = {
            status: (code) => ({
                json: (data) => {
                    success = data.success;
                }
            })
        };

        await concernController.replyToConcern(mockReq, mockRes);

        return res.redirect(`/concerns/doctor/${req.user.id}`);
    } catch (error) {
        console.error('Error responding to concern:', error);
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

        // Fetch doctor's appointments - sorted by date and time in ascending order (upcoming first)
        const appointmentsResult = await pool.query(
            'SELECT * FROM appointments WHERE doctor_id = $1 ORDER BY date ASC, time ASC',
            [doctorId]
        );

        res.render('doctor/view_appointments', { 
            userid: doctorId,
            appointments: appointmentsResult.rows,
            success: req.query.success
        });
    } catch (error) {
        console.error('Error loading appointments:', error);
        res.status(500).send('Internal server error');
    }
});

// Doctor - mark appointment as completed
router.post('/appointments/:appointmentId/complete', auth, async (req, res) => {
    try {
        if (req.user.role !== 'doctor') {
            return res.status(403).render('error/403');
        }

        const appointmentId = req.params.appointmentId;
        const doctorId = req.user.id;

        // Verify the appointment belongs to this doctor
        const appointmentCheck = await pool.query(
            'SELECT doctor_id FROM appointments WHERE id = $1',
            [appointmentId]
        );

        if (appointmentCheck.rows.length === 0) {
            return res.status(404).send('Appointment not found');
        }

        if (appointmentCheck.rows[0].doctor_id != doctorId) {
            return res.status(403).send('Unauthorized');
        }

        // Update appointment status to completed
        await pool.query(
            `UPDATE appointments SET status = 'completed' WHERE id = $1`,
            [appointmentId]
        );

        // Redirect back to appointments page with success message
        res.redirect(`/appointments/doctor/${doctorId}?success=appointment_completed`);
    } catch (error) {
        console.error('Error completing appointment:', error);
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

// Doctor - approve/reject referral - POST handler
router.post('/approve-referrals', auth, async (req, res) => {
    try {
        if (req.user.role !== 'doctor') {
            return res.status(403).render('error/403');
        }

        const { referral_id, action } = req.body;
        const doctorId = req.user.id;

        // Get doctor name
        const doctorResult = await pool.query('SELECT name FROM users WHERE id = $1', [doctorId]);
        const doctorName = doctorResult.rows[0]?.name || 'Doctor';

        // Update referral status
        const status = action === 'approve' ? 'approved' : 'rejected';
        const doctorNotes = `Reviewed by ${doctorName}`;

        await pool.query(
            `UPDATE referrals SET status = $1, doctor_notes = $2 WHERE id = $3`,
            [status, doctorNotes, referral_id]
        );

        // Redirect back to referrals page
        res.redirect(`/referrals/doctor/${doctorId}`);
    } catch (error) {
        console.error('Error updating referral:', error);
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

// Doctor - view student prescription history (uses API)
router.get('/prescriptions/student/:studentId/view', auth, async (req, res) => {
    try {
        if (req.user.role !== 'doctor') {
            return res.status(403).render('error/403');
        }

        const studentId = req.params.studentId;

        // Fetch student info
        const studentResult = await pool.query(
            'SELECT name FROM users WHERE id = $1',
            [studentId]
        );

        // Use the existing API to fetch prescriptions
        // This API already filters based on doctor's specialization
        const recordController = require('../controllers/recordController');
        
        // Create mock req/res for the API call
        const mockReq = {
            user: req.user,
            params: { studentId }
        };
        
        let prescriptionsData = [];
        const mockRes = {
            status: (code) => ({
                json: (data) => {
                    if (data.success) {
                        prescriptionsData = data.data;
                    }
                }
            })
        };

        await recordController.getStudentRecordForDoctor(mockReq, mockRes);

        res.render('doctor/student_prescriptions', { 
            userid: req.user.id,
            studentId: studentId,
            studentName: studentResult.rows[0]?.name || 'Student',
            prescriptions: prescriptionsData
        });
    } catch (error) {
        console.error('Error loading student prescriptions:', error);
        res.status(500).send('Internal server error');
    }
});

// Doctor - add prescription for specific student
router.get('/prescriptions/add', auth, async (req, res) => {
    try {
        if (req.user.role !== 'doctor') {
            return res.status(403).render('error/403');
        }

        const studentId = req.query.student_id;
        const studentName = req.query.student_name;

        // Fetch doctor name
        const userResult = await pool.query('SELECT name FROM users WHERE id = $1', [req.user.id]);
        const doctorName = userResult.rows[0]?.name || 'Doctor';

        res.render('doctor/add_prescription', { 
            userid: req.user.id,
            username: doctorName,
            studentId: studentId,
            studentName: studentName
        });
    } catch (error) {
        console.error('Error loading add prescription page:', error);
        res.status(500).send('Internal server error');
    }
});

// Doctor - add prescription POST handler (uses API)
router.post('/add-prescription', auth, async (req, res) => {
    try {
        if (req.user.role !== 'doctor') {
            return res.status(403).render('error/403');
        }

        const { student_id, diagnosis, medicines, notes, is_general } = req.body;

        // Use the existing API controller to add prescription
        const recordController = require('../controllers/recordController');
        
        // Prepare the request body for the API
        const apiReqBody = {
            student_id,
            diagnosis,
            medicines,
            notes
        };

        // If is_general checkbox is checked, set category to 'general'
        // Otherwise, the API will use doctor's specialization
        if (is_general === 'true') {
            apiReqBody.category = 'general';
        }

        // Create mock req/res for the API call
        const mockReq = {
            user: req.user,
            body: apiReqBody
        };
        
        let success = false;
        const mockRes = {
            status: (code) => ({
                json: (data) => {
                    success = data.success;
                }
            })
        };

        await recordController.addHealthRecord(mockReq, mockRes);

        if (success) {
            // Redirect back to appointments with success message
            res.redirect(`/appointments/doctor/${req.user.id}?success=prescription_added`);
        } else {
            res.status(500).send('Failed to add prescription');
        }
    } catch (error) {
        console.error('Error adding prescription:', error);
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

        // For each order, fetch the medicines
        const ordersWithMedicines = await Promise.all(
            ordersResult.rows.map(async (order) => {
                const medicinesResult = await pool.query(
                    `SELECT 
                        om.medicine_id,
                        om.quantity,
                        m.name,
                        m.price,
                        m.description
                     FROM order_medicines om
                     LEFT JOIN medicines m ON om.medicine_id = m.id
                     WHERE om.order_id = $1`,
                    [order.id]
                );
                return {
                    ...order,
                    medicines: medicinesResult.rows
                };
            })
        );

        res.render('pharmacy/view_orders', { 
            userid: pharmacistId,
            orders: ordersWithMedicines,
            success: req.query.success || null
        });
    } catch (error) {
        console.error('Error loading orders:', error);
        res.status(500).send('Internal server error');
    }
});

// Pharmacist - update order status (ready -> completed transitions)
router.post('/pharmacy/orders/:id/status', auth, async (req, res) => {
    try {
        const pharmacistId = req.params.id;
        
        if (req.user.id != pharmacistId || req.user.role !== 'pharmacy') {
            return res.status(403).render('error/403');
        }

        const { order_id, action } = req.body;

        // Validate order exists
        const orderRes = await pool.query('SELECT status FROM orders WHERE id = $1', [order_id]);
        if (orderRes.rows.length === 0) {
            return res.status(404).send('Order not found');
        }

        const currentStatus = orderRes.rows[0].status;
        let nextStatus = null;
    if (action === 'ready' && currentStatus === 'pending') nextStatus = 'ready';
    // Map 'completed' action to valid DB status 'collected'
    if (action === 'completed' && (currentStatus === 'ready' || currentStatus === 'pending')) nextStatus = 'collected';
    // Allow cancelling pending orders
    if (action === 'cancelled' && currentStatus === 'pending') nextStatus = 'cancelled';

        if (!nextStatus) {
            return res.redirect(`/pharmacy/orders/${pharmacistId}?success=invalid_transition`);
        }

        await pool.query('UPDATE orders SET status = $1 WHERE id = $2', [nextStatus, order_id]);

    const success = nextStatus === 'ready' ? 'ready' : (nextStatus === 'collected' ? 'completed' : 'cancelled');
        res.redirect(`/pharmacy/orders/${pharmacistId}?success=${success}`);
    } catch (error) {
        console.error('Error updating order status:', error);
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
            medicines: medicinesResult.rows,
            success: req.query.success || null,
            error: req.query.error || null
        });
    } catch (error) {
        console.error('Error loading stocks page:', error);
        res.status(500).send('Internal server error');
    }
});

// Pharmacist - update stock quantity and optionally price
router.post('/pharmacy/stocks/:id/update', auth, async (req, res) => {
    try {
        const pharmacistId = req.params.id;
        
        if (req.user.id != pharmacistId || req.user.role !== 'pharmacy') {
            return res.status(403).render('error/403');
        }

        const { medicine_id, quantity, price } = req.body;

        // Basic validation
        const medId = parseInt(medicine_id, 10);
        const qty = parseInt(quantity, 10);
        const newPrice = price !== undefined && price !== '' ? parseInt(price, 10) : null;

        if (!medId || isNaN(qty)) {
            return res.redirect(`/pharmacy/stocks/${pharmacistId}?error=invalid_input`);
        }

        // Ensure medicine exists
        const medRes = await pool.query('SELECT id FROM medicines WHERE id = $1', [medId]);
        if (medRes.rows.length === 0) {
            return res.redirect(`/pharmacy/stocks/${pharmacistId}?error=medicine_not_found`);
        }

        if (newPrice !== null && (isNaN(newPrice) || newPrice < 0)) {
            return res.redirect(`/pharmacy/stocks/${pharmacistId}?error=invalid_price`);
        }

        if (newPrice !== null) {
            await pool.query(
                'UPDATE medicines SET stock = GREATEST(stock + $1, 0), price = $2 WHERE id = $3',
                [qty, newPrice, medId]
            );
        } else {
            await pool.query(
                'UPDATE medicines SET stock = GREATEST(stock + $1, 0) WHERE id = $2',
                [qty, medId]
            );
        }

        return res.redirect(`/pharmacy/stocks/${pharmacistId}?success=updated`);
    } catch (error) {
        console.error('Error updating stock:', error);
        res.status(500).send('Internal server error');
    }
});

// Admin: Add Doctor page
router.get('/admin/change-password', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).render('error/403');
        }
        const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
        res.render('admin/change-password', { 
            user: userResult.rows[0],
            success: null,
            error: null
        });
    } catch (error) {
        console.error('Error loading change password page:', error);
        res.status(500).render('error/500');
    }
});

// Admin: Change Password - POST
router.post('/admin/change-password', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).render('error/403');
        }
        
        const { email, oldpassword, newpassword } = req.body;

        // Fetch user by email
        const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userResult.rows.length === 0) {
            const adminResult = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
            return res.render('admin/change-password', { 
                user: adminResult.rows[0], 
                error: 'User not found with that email.',
                success: null
            });
        }
        
        const user = userResult.rows[0];

        // Verify old password
        const match = await bcrypt.compare(oldpassword, user.password);
        if (!match) {
            const adminResult = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
            return res.render('admin/change-password', { 
                user: adminResult.rows[0], 
                error: 'Old password is incorrect.',
                success: null
            });
        }

        // Hash new password and update
        const hashedPassword = await bcrypt.hash(newpassword, 10);
        await pool.query('UPDATE users SET password = $1 WHERE email = $2', [hashedPassword, email]);
        
        // Fetch admin data again to pass to template
        const adminResult = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
        res.render('admin/change-password', { 
            user: adminResult.rows[0], 
            success: 'Password changed successfully!',
            error: null
        });

    } catch (error) {
        console.error('Error changing password:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            body: req.body
        });
        const adminResult = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
        res.render('admin/change-password', { 
            user: adminResult.rows[0], 
            error: `Failed to change password: ${error.message}`,
            success: null
        });
    }
});

// Admin: Reset any user's password to default 'start123'
router.get('/admin/reset-password', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).render('error/403');
        }
        const adminResult = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
        res.render('admin/reset-password', { user: adminResult.rows[0], success: null, error: null });
    } catch (error) {
        console.error('Error loading reset-password page:', error);
        res.status(500).render('error/500');
    }
});

router.post('/admin/reset-password', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).render('error/403');
        }
        const { email } = req.body;
        if (!email) {
            const adminResult = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
            return res.render('admin/reset-password', { user: adminResult.rows[0], success: null, error: 'Email is required.' });
        }
        const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (userResult.rows.length === 0) {
            const adminResult = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
            return res.render('admin/reset-password', { user: adminResult.rows[0], success: null, error: 'No user found with that email.' });
        }
        const defaultPassHash = await bcrypt.hash('start123', 10);
        await pool.query('UPDATE users SET password = $1 WHERE email = $2', [defaultPassHash, email]);
        const adminResult = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
        res.render('admin/reset-password', { user: adminResult.rows[0], success: 'Password reset to start123.', error: null });
    } catch (error) {
        console.error('Error resetting password:', error);
        const adminResult = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
        res.render('admin/reset-password', { user: adminResult.rows[0], success: null, error: 'Failed to reset password. Please try again.' });
    }
});

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

    const { name, email, password, specialization, timePerPatient } = req.body;

        // Call the API endpoint to create the user
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash(password, 10);

        const newDoctor = await pool.query(
            `INSERT INTO users (name, email, password, role, specialization, time_per_patient) 
             VALUES ($1, $2, $3, 'doctor', $4, $5) RETURNING id`,
            [name, email, hashedPassword, specialization, timePerPatient || 15]
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
            error: error.message || 'Failed to add doctor. Email may already exist.' 
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

    const { name, email, password } = req.body;

        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash(password, 10);

        const newPharmacist = await pool.query(
            `INSERT INTO users (name, email, password, role) 
             VALUES ($1, $2, $3, 'pharmacy') RETURNING id`,
            [name, email, hashedPassword]
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
            error: error.message || 'Failed to add pharmacist. Email may already exist.' 
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
            "SELECT id, name, email, specialization FROM users WHERE role = 'doctor' ORDER BY name"
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
            "SELECT id, name, email, specialization FROM users WHERE role = 'doctor' ORDER BY name"
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
            "SELECT id, name, email, specialization FROM users WHERE role = 'doctor' ORDER BY name"
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
            "SELECT id, name, email FROM users WHERE role = 'pharmacy' ORDER BY name"
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
            "SELECT id, name, email FROM users WHERE role = 'pharmacy' ORDER BY name"
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
            "SELECT id, name, email FROM users WHERE role = 'pharmacy' ORDER BY name"
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

        const success = req.query.success || null;
        const error = req.query.error || null;

        res.render('student/my_appointments', { 
            userid: userId,
            appointments: appointmentsResult.rows,
            success,
            error
        });
    } catch (error) {
        console.error('Error loading my appointments page:', error);
        res.status(500).render('error/500');
    }
});

// Student: Delete (Cancel) an appointment
router.post('/users/:id/appointments/:appointmentId/delete', auth, async (req, res) => {
    try {
        const userId = req.params.id;
        const appointmentId = req.params.appointmentId;

        if (req.user.id != userId) {
            return res.status(403).render('error/403');
        }

        // Ensure the appointment belongs to the student and is not completed
        const apptResult = await pool.query(
            `SELECT id, status, date FROM appointments WHERE id = $1 AND student_id = $2`,
            [appointmentId, userId]
        );

        if (apptResult.rows.length === 0) {
            return res.redirect(`/users/${userId}/appointments/view?error=Appointment%20not%20found`);
        }

        const appt = apptResult.rows[0];
        if (appt.status !== 'scheduled') {
            return res.redirect(`/users/${userId}/appointments/view?error=Only%20scheduled%20appointments%20can%20be%20deleted`);
        }

        // Soft delete: mark as cancelled to retain history
        await pool.query(
            `UPDATE appointments SET status = 'cancelled' WHERE id = $1 AND student_id = $2`,
            [appointmentId, userId]
        );

        return res.redirect(`/users/${userId}/appointments/view?success=Appointment%20deleted`);
    } catch (err) {
        console.error('Error deleting appointment:', err);
        const userId = req.params.id;
        return res.redirect(`/users/${userId}/appointments/view?error=Failed%20to%20delete%20appointment`);
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
                o.prescription_link,
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
                        om.medicine_id,
                        om.quantity,
                        m.name,
                        m.price,
                        m.description
                     FROM order_medicines om
                     LEFT JOIN medicines m ON om.medicine_id = m.id
                     WHERE om.order_id = $1`,
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
