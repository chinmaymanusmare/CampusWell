const pool = require('../../src/config/db');
const {
	setAvailability,
	getAvailability,
	calculateAvailableSlots,
	deleteAvailability,
} = require('../../src/controllers/availabilityController');

jest.mock('../../src/config/db');

describe('availabilityController', () => {
	let consoleErrorSpy;
	beforeAll(() => {
		// suppress controller error logs during tests (we still assert responses)
		consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterAll(() => {
		consoleErrorSpy.mockRestore();
	});
	beforeEach(() => {
		pool.query = jest.fn();
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('setAvailability', () => {
		test('returns 400 when missing fields', async () => {
			const req = { user: { id: 1 }, body: {} };
			const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

			await setAvailability(req, res);

			expect(res.status).toHaveBeenCalledWith(400);
			expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
		});

		test('inserts availability and returns 201', async () => {
			const req = {
				user: { id: 2 },
				body: { date: '2025-01-01', startTime: '09:00', endTime: '10:00', maxPatients: 5 },
			};
			const fakeRow = { id: 10, doctor_id: 2, date: '2025-01-01' };
			pool.query.mockResolvedValueOnce({ rows: [fakeRow] });

			const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

			await setAvailability(req, res);

			expect(pool.query).toHaveBeenCalled();
			expect(res.status).toHaveBeenCalledWith(201);
			expect(res.json).toHaveBeenCalledWith({ success: true, data: fakeRow });
		});
	});

	describe('getAvailability', () => {
		test('returns availability rows', async () => {
			const req = { params: { doctorId: 3 }, query: { startDate: '2025-01-01', endDate: '2025-01-07' }, user: { id: 3 } };
			const rows = [{ id: 1 }, { id: 2 }];
			pool.query.mockResolvedValueOnce({ rows });

			const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

			await getAvailability(req, res);

			expect(pool.query).toHaveBeenCalled();
			expect(res.status).toHaveBeenCalledWith(200);
			expect(res.json).toHaveBeenCalledWith({ success: true, data: rows });
		});

		test('handles errors with 500', async () => {
			const req = { params: {}, query: {}, user: { id: 1 } };
			pool.query.mockRejectedValueOnce(new Error('db error'));
			const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

			await getAvailability(req, res);

			expect(res.status).toHaveBeenCalledWith(500);
			expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
		});
	});

	describe('calculateAvailableSlots', () => {
		test('returns not available when no availability', async () => {
			pool.query.mockResolvedValueOnce({ rows: [] });
			const result = await calculateAvailableSlots(1, '2025-01-01', '09:00');
			expect(result.available).toBe(false);
			expect(result.message).toMatch(/not available/);
		});

		test('calculates availability and maxPatients', async () => {
			const availability = {
				current_bookings: '1',
				max_patients: null,
				start_time: '09:00',
				end_time: '10:00',
				time_per_patient: 15,
			};
			pool.query.mockResolvedValueOnce({ rows: [availability] });

			const result = await calculateAvailableSlots(1, '2025-01-01', '09:15');
			expect(result.available).toBe(true);
			expect(result.maxPatients).toBeGreaterThan(0);
			expect(result.timePerPatient).toBe(availability.time_per_patient);
		});
	});

	describe('deleteAvailability', () => {
		test('returns 400 when appointments exist', async () => {
			const req = { user: { id: 2 }, params: { id: 5 } };
			pool.query.mockResolvedValueOnce({ rows: [{ count: '2' }] }); // appointments check
			const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

			await deleteAvailability(req, res);

			expect(res.status).toHaveBeenCalledWith(400);
			expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
		});

		test('deletes availability and returns 200', async () => {
			const req = { user: { id: 2 }, params: { id: 6 } };
			// appointments check -> 0
			pool.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
			// delete query -> return deleted row
			pool.query.mockResolvedValueOnce({ rows: [{ id: 6 }] });

			const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

			await deleteAvailability(req, res);

			expect(pool.query).toHaveBeenCalled();
			expect(res.status).toHaveBeenCalledWith(200);
			expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
		});
	});
});
