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
