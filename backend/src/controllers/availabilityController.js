const pool = require('../config/db');

// Set availability for a specific date
const setAvailability = async (req, res) => {
    try {
        const doctorId = req.user.id;
        const { date, startTime, endTime, maxPatients } = req.body;

        // Validate input
        if (!date || !startTime || !endTime) {
            return res.status(400).json({
                success: false,
                message: 'Date, start time, and end time are required'
            });
        }

        // Insert or update availability
        const result = await pool.query(
            `INSERT INTO doctor_availability 
            (doctor_id, date, start_time, end_time, max_patients) 
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (doctor_id, date, start_time, end_time) 
            DO UPDATE SET 
                max_patients = $5
            RETURNING *`,
            [doctorId, date, startTime, endTime, maxPatients]
        );

        res.status(201).json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error in setAvailability:', error);
        res.status(500).json({
            success: false,
            message: 'Error setting availability'
        });
    }
};

// Get doctor's availability for a date range
const getAvailability = async (req, res) => {
    try {
        const doctorId = req.params.doctorId || req.user.id;
        const { startDate, endDate } = req.query;

        const result = await pool.query(
            `SELECT da.*, u.time_per_patient,
                    COUNT(a.id) as booked_appointments
             FROM doctor_availability da
             JOIN users u ON u.id = da.doctor_id
             LEFT JOIN appointments a 
                ON a.doctor_id = da.doctor_id 
                AND a.date = da.date 
                AND a.status = 'scheduled'
             WHERE da.doctor_id = $1
                AND da.date BETWEEN $2 AND $3
             GROUP BY da.id, u.time_per_patient
             ORDER BY da.date, da.start_time`,
            [doctorId, startDate, endDate]
        );

        res.status(200).json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error in getAvailability:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching availability'
        });
    }
};

// Calculate available slots
const calculateAvailableSlots = async (doctorId, date, time) => {
    try {
        // Get doctor's availability for the specified date and time
        const availabilityResult = await pool.query(
            `SELECT da.*, u.time_per_patient,
                    (SELECT COUNT(*) 
                     FROM appointments 
                     WHERE doctor_id = $1 
                     AND date = $2
                     AND time = $3
                     AND status = 'scheduled') as current_bookings
             FROM doctor_availability da
             JOIN users u ON u.id = da.doctor_id
             WHERE da.doctor_id = $1 
             AND da.date = $2
             AND $3::time BETWEEN da.start_time AND da.end_time`,
            [doctorId, date, time]
        );

        if (availabilityResult.rows.length === 0) {
            return {
                available: false,
                message: 'Doctor is not available at this time'
            };
        }

        const availability = availabilityResult.rows[0];
        const currentBookings = parseInt(availability.current_bookings);
        const maxPatients = availability.max_patients || 
            Math.floor(
                (new Date(`2000-01-01 ${availability.end_time}`) - 
                 new Date(`2000-01-01 ${availability.start_time}`)) / 
                (availability.time_per_patient * 60000)
            );

        return {
            available: currentBookings < maxPatients,
            maxPatients,
            currentBookings,
            timePerPatient: availability.time_per_patient
        };
    } catch (error) {
        console.error('Error calculating available slots:', error);
        throw error;
    }
};

// Delete availability
const deleteAvailability = async (req, res) => {
    try {
        const doctorId = req.user.id;
        const { id } = req.params;

        // Check if there are any booked appointments
        const appointmentsCheck = await pool.query(
            `SELECT COUNT(*) 
             FROM doctor_availability da
             JOIN appointments a 
                ON a.doctor_id = da.doctor_id 
                AND a.date = da.date
                AND a.status = 'scheduled'
             WHERE da.id = $1`,
            [id]
        );

        if (parseInt(appointmentsCheck.rows[0].count) > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete availability with booked appointments'
            });
        }

        // Delete availability
        const result = await pool.query(
            'DELETE FROM doctor_availability WHERE id = $1 AND doctor_id = $2 RETURNING *',
            [id, doctorId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Availability not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Availability deleted successfully'
        });
    } catch (error) {
        console.error('Error in deleteAvailability:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting availability'
        });
    }
};

module.exports = {
    setAvailability,
    getAvailability,
    calculateAvailableSlots,
    deleteAvailability
};