const pool = require('../config/db');

// Set availability for a specific date
const setAvailability = async (req, res) => {
	try {
		const doctorId = req.user.id;
		// Support both camelCase and snake_case parameter names
		const { date, startTime, start_time, endTime, end_time, maxPatients, max_patients } = req.body;
		
		const finalStartTime = startTime || start_time;
		const finalEndTime = endTime || end_time;
		const finalMaxPatients = maxPatients || max_patients;

		// Validate input
		if (!date || !finalStartTime || !finalEndTime) {
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
			[doctorId, date, finalStartTime, finalEndTime, finalMaxPatients]
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
		// Get doctor's availability and current bookings for the specific time slot
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
			 AND $3::time >= da.start_time
			 AND $3::time < da.end_time`,
			[doctorId, date, time]
		);

		if (availabilityResult.rows.length === 0) {
			// no availability rows for this doctor/date/time
			return {
				available: false,
				message: 'Doctor is not available at this time'
			};
		}

		const availability = availabilityResult.rows[0];
		const currentBookings = parseInt(availability.current_bookings || '0');
		const timePerPatient = availability.time_per_patient;
		// Calculate max patients for this time slot if not explicitly set
		let maxPatients;
		if (availability.max_patients) {
			maxPatients = availability.max_patients;
		} else {
			// Convert duration to minutes and divide by time per patient
			const startMinutes = new Date(`2000-01-01 ${availability.start_time}`).getTime();
			const endMinutes = new Date(`2000-01-01 ${availability.end_time}`).getTime();
			const slotDurationMinutes = (endMinutes - startMinutes) / 60000;
			maxPatients = Math.floor(slotDurationMinutes / timePerPatient);
		}

		// debug logs for integration test troubleshooting
		console.log('calculateAvailableSlots -> availability rows:', availabilityResult.rows.length);
		console.log('calculateAvailableSlots -> availability:', availability);
		console.log('calculateAvailableSlots -> currentBookings:', currentBookings, 'maxPatients:', maxPatients, 'timePerPatient:', timePerPatient);

		return {
			available: currentBookings < maxPatients,
			maxPatients,
			currentBookings,
			timePerPatient: timePerPatient
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

		// Check if there are any booked appointments for THIS SLOT (exact time)
		const appointmentsCheck = await pool.query(
			`SELECT COUNT(*) 
			 FROM doctor_availability da
			 JOIN appointments a 
				ON a.doctor_id = da.doctor_id 
				AND a.date = da.date
				AND a.time = da.start_time::VARCHAR
				AND a.status = 'scheduled'
			 WHERE da.id = $1`,
			[id]
		);

		const hasScheduled = parseInt(appointmentsCheck.rows[0].count) > 0;

		const force = String(req.query.force || '').toLowerCase() === 'true';

		if (hasScheduled && !force) {
			return res.status(400).json({
				success: false,
				message: 'Cannot delete availability with booked appointments'
			});
		}

		// If forced deletion: cancel all appointments in this slot, notify students, and delete slot atomically
		if (hasScheduled && force) {
			const client = await pool.connect();
			try {
				await client.query('BEGIN');

				// Fetch slot details
				const slotRes = await client.query(
					'SELECT doctor_id, date, start_time FROM doctor_availability WHERE id = $1 AND doctor_id = $2 FOR UPDATE',
					[id, doctorId]
				);

				if (slotRes.rows.length === 0) {
					await client.query('ROLLBACK');
					return res.status(404).json({ success: false, message: 'Availability not found' });
				}

				const slot = slotRes.rows[0];

				// Get affected appointments
				const apptsRes = await client.query(
					`SELECT id, student_id FROM appointments 
					 WHERE doctor_id = $1 AND date = $2 AND time = $3 AND status = 'scheduled'`,
					[slot.doctor_id, slot.date, slot.start_time]
				);

				// Cancel them
				await client.query(
					`UPDATE appointments SET status = 'cancelled' 
					 WHERE doctor_id = $1 AND date = $2 AND time = $3 AND status = 'scheduled'`,
					[slot.doctor_id, slot.date, slot.start_time]
				);

				// Prepare notification message
				const doctorNameRes = await client.query('SELECT name FROM users WHERE id = $1', [doctorId]);
				const doctorName = doctorNameRes.rows[0]?.name || 'your doctor';

				const yyyy = slot.date.getFullYear?.() ? slot.date.getFullYear() : new Date(slot.date).getFullYear();
				const mm = String((slot.date.getMonth?.() ? slot.date.getMonth() : new Date(slot.date).getMonth()) + 1).padStart(2, '0');
				const dd = String((slot.date.getDate?.() ? slot.date.getDate() : new Date(slot.date).getDate())).padStart(2, '0');
				const dateStr = `${yyyy}-${mm}-${dd}`;
				const timeStr = String(slot.start_time).slice(0,5);
				const message = `Your appointment on ${dateStr} at ${timeStr} with ${doctorName} was cancelled by the doctor.`;

				// Insert notifications for affected students
				for (const row of apptsRes.rows) {
					await client.query(
						`INSERT INTO notifications (user_id, message, is_read, created_at) 
						 VALUES ($1, $2, false, NOW())`,
						[row.student_id, message]
					);
				}

				// Delete the availability
				const delRes = await client.query(
					'DELETE FROM doctor_availability WHERE id = $1 AND doctor_id = $2 RETURNING *',
					[id, doctorId]
				);

				await client.query('COMMIT');

				return res.status(200).json({
					success: true,
					message: `Slot deleted and ${apptsRes.rows.length} booking(s) cancelled and notified`,
					data: delRes.rows[0]
				});
			} catch (e) {
				await client.query('ROLLBACK');
				console.error('Error in forced deleteAvailability:', e);
				return res.status(500).json({ success: false, message: 'Error deleting availability (forced)' });
			} finally {
				client.release();
			}
		}

		// Normal delete path
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

