jest.mock('../../src/config/db', () => ({ query: jest.fn() }));

const { 
    setAvailability, 
    getAvailability, 
    calculateAvailableSlots, 
    deleteAvailability 
} = require('../../src/controllers/availabilityController');
const pool = require('../../src/config/db');

describe('Availability Controller', () => {
    let mockReq;
    let mockRes;

    beforeEach(() => {
        mockReq = {
            user: { id: 1 },
            body: {},
            params: {},
            query: {}
        };
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        pool.query.mockReset();
    });

    describe('setAvailability', () => {
        test('should create new availability successfully', async () => {
            mockReq.body = {
                date: '2025-12-01',
                startTime: '09:00',
                endTime: '12:00',
                maxPatients: 12,
                timePerPatient: 15
            };

            const mockResult = {
                rows: [{
                    id: 1,
                    doctor_id: 1,
                    date: '2025-12-01',
                    start_time: '09:00',
                    end_time: '12:00',
                    max_patients: 12,
                    time_per_patient: 15
                }]
            };

            pool.query.mockResolvedValueOnce(mockResult);

            await setAvailability(mockReq, mockRes);

            expect(pool.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO doctor_availability'),
                [1, '2025-12-01', '09:00', '12:00', 12]
            );
            expect(mockRes.status).toHaveBeenCalledWith(201);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                data: mockResult.rows[0]
            });
        });

        test('should return 400 when required fields are missing', async () => {
            mockReq.body = {
                date: '2025-12-01'
                // missing startTime and endTime
            };

            await setAvailability(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                message: expect.stringContaining('required')
            });
        });
    });

    describe('getAvailability', () => {
        test('should get doctor availability successfully', async () => {
            mockReq.params.doctorId = 1;
            mockReq.query = {
                startDate: '2025-12-01',
                endDate: '2025-12-31'
            };

            const mockResult = {
                rows: [{
                    id: 1,
                    doctor_id: 1,
                    date: '2025-12-01',
                    start_time: '09:00',
                    end_time: '12:00',
                    booked_appointments: '2'
                }]
            };

            pool.query.mockResolvedValueOnce(mockResult);

            await getAvailability(mockReq, mockRes);

            expect(pool.query).toHaveBeenCalledWith(
                expect.stringContaining('SELECT da.*, u.time_per_patient'),
                [1, '2025-12-01', '2025-12-31']
            );
            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                data: mockResult.rows
            });
        });
    });

    describe('calculateAvailableSlots', () => {
        test('should calculate available slots correctly', async () => {
            const mockAvailability = {
                rows: [{
                    start_time: '09:00',
                    end_time: '12:00',
                    time_per_patient: 15,
                    max_patients: 12,
                    current_bookings: '2'
                }]
            };

            pool.query.mockResolvedValueOnce(mockAvailability);

            const result = await calculateAvailableSlots(1, '2025-12-01', '09:30');

            expect(result).toEqual({
                available: true,
                maxPatients: 12,
                currentBookings: 2,
                timePerPatient: 15
            });
        });

        test('should return not available when slot is fully booked', async () => {
            const mockAvailability = {
                rows: [{
                    start_time: '09:00',
                    end_time: '12:00',
                    time_per_patient: 15,
                    max_patients: 12,
                    current_bookings: '12'
                }]
            };

            pool.query.mockResolvedValueOnce(mockAvailability);

            const result = await calculateAvailableSlots(1, '2025-12-01', '09:30');

            expect(result.available).toBeFalsy();
        });

        test('should return not available when no slot exists', async () => {
            pool.query.mockResolvedValueOnce({ rows: [] });

            const result = await calculateAvailableSlots(1, '2025-12-01', '09:30');

            expect(result.available).toBeFalsy();
            expect(result.message).toBe('Doctor is not available at this time');
        });
    });

    describe('deleteAvailability', () => {
        test('should delete availability successfully', async () => {
            mockReq.params.id = 1;
            
            // Mock no booked appointments
            pool.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
            // Mock successful deletion
            pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

            await deleteAvailability(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                message: 'Availability deleted successfully'
            });
        });

        test('should not delete availability with booked appointments', async () => {
            mockReq.params.id = 1;
            
            pool.query.mockResolvedValueOnce({ rows: [{ count: '2' }] });

            await deleteAvailability(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                message: 'Cannot delete availability with booked appointments'
            });
        });
    });
});