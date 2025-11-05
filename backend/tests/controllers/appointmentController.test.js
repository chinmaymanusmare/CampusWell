jest.mock('../../src/config/db', () => ({ query: jest.fn(), connect: jest.fn() }));

const { getDoctors, bookAppointment, getStudentAppointments, getDoctorAppointments, rescheduleAppointment, cancelAppointment } = require('../../src/controllers/appointmentController');
const pool = require('../../src/config/db');

describe('Appointment Controller', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    mockReq = {
      body: {},
      user: { id: 1 },
      query: {},
      params: {}
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    pool.query.mockReset();
  });

  describe('getDoctors', () => {
    test('should return list of doctors successfully', async () => {
      const mockDoctors = [
        { id: 1, name: 'Dr. Smith', specialization: 'General' }
      ];
      pool.query.mockResolvedValueOnce({ rows: mockDoctors });

      await getDoctors(mockReq, mockRes);

      expect(pool.query).toHaveBeenCalledWith(
        "SELECT id, name, specialization FROM users WHERE role = 'doctor';"
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ success: true, data: mockDoctors });
    });
  });

  describe('bookAppointment', () => {
    test('should book appointment successfully', async () => {
      mockReq.body = { doctor_id: 2, date: '2025-12-01', time: '10:00' };
      const mockConflict = { rows: [] };
      const mockDoctor = { rows: [{ name: 'Dr. Smith' }] };
      const mockStudent = { rows: [{ name: 'John Doe' }] };
      const mockAppointment = { rows: [{ id: 1, student_id: 1, doctor_id: 2 }] };

      pool.query.mockResolvedValueOnce(mockConflict)
        .mockResolvedValueOnce(mockDoctor)
        .mockResolvedValueOnce(mockStudent)
        .mockResolvedValueOnce(mockAppointment);

      await bookAppointment(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({ success: true, data: mockAppointment.rows[0] });
    });

    test('should reject when slot is not available', async () => {
      mockReq.body = { doctor_id: 2, date: '2025-12-01', time: '10:00' };
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await bookAppointment(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ success: false, message: 'Doctor not available at this slot' });
    });

    test('should handle non-existent doctor', async () => {
      mockReq.body = { doctor_id: 999, date: '2025-12-01', time: '10:00' };
      pool.query.mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await bookAppointment(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ success: false, message: 'Doctor not found' });
    });
  });

  describe('getStudentAppointments', () => {
    test('should return student appointments successfully', async () => {
      const mockAppointments = { rows: [{ id: 1, student_id: 1 }] };
      pool.query.mockResolvedValueOnce(mockAppointments);

      await getStudentAppointments(mockReq, mockRes);

      expect(pool.query).toHaveBeenCalledWith(
        "SELECT * FROM appointments WHERE student_id = $1 ORDER BY date, time;",
        [1]
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ success: true, data: mockAppointments.rows });
    });
  });

  describe('getDoctorAppointments', () => {
    test('should return doctor appointments using query param', async () => {
      mockReq.query.doctor_id = 2;
      const mockAppointments = { rows: [{ id: 1, doctor_id: 2 }] };
      pool.query.mockResolvedValueOnce(mockAppointments);

      await getDoctorAppointments(mockReq, mockRes);

      expect(pool.query).toHaveBeenCalledWith(
        "SELECT * FROM appointments WHERE doctor_id = $1 ORDER BY date, time;",
        [2]
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    test('should return doctor appointments using authenticated user', async () => {
      mockReq.user = { id: 2 };
      const mockAppointments = { rows: [{ id: 1, doctor_id: 2 }] };
      pool.query.mockResolvedValueOnce(mockAppointments);

      await getDoctorAppointments(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    test('should handle missing doctor id', async () => {
      mockReq.user = null;
      mockReq.query = {};

      await getDoctorAppointments(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ success: false, message: 'Doctor id is required' });
    });
  });

  describe('rescheduleAppointment', () => {
    test('should reschedule appointment successfully', async () => {
      mockReq.params.id = 1;
      mockReq.body = { date: '2025-12-02', time: '11:00' };
      
      const mockAppointment = { rows: [{ id: 1, status: 'scheduled', doctor_id: 2 }] };
      const mockConflict = { rows: [] };
      const mockUpdate = { rows: [{ id: 1, date: '2025-12-02', time: '11:00' }] };

      pool.query.mockResolvedValueOnce(mockAppointment)
        .mockResolvedValueOnce(mockConflict)
        .mockResolvedValueOnce(mockUpdate);

      await rescheduleAppointment(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ success: true, data: mockUpdate.rows[0] });
    });

    test('returns 400 when date or time missing', async () => {
      mockReq.params.id = 1;
      mockReq.body = {};

      await rescheduleAppointment(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ 
        success: false, 
        message: expect.stringContaining('Both date and time are required') 
      }));
    });

    test('should reject when appointment not found', async () => {
      mockReq.params.id = 999;
      mockReq.body = { date: '2025-12-02', time: '11:00' };
      
      pool.query.mockResolvedValueOnce({ rows: [] });

      await rescheduleAppointment(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ success: false, message: 'Appointment not found' });
    });

    test('should reject when new slot is not available', async () => {
      mockReq.params.id = 1;
      mockReq.body = { date: '2025-12-02', time: '11:00' };
      
      const mockAppointment = { rows: [{ id: 1, status: 'scheduled', doctor_id: 2 }] };
      const mockConflict = { rows: [{ id: 2 }] };

      pool.query.mockResolvedValueOnce(mockAppointment)
        .mockResolvedValueOnce(mockConflict);

      await rescheduleAppointment(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ success: false, message: 'Doctor not available at this slot' });
    });

  });

  describe('cancelAppointment', () => {
    test('should cancel appointment successfully', async () => {
      mockReq.params.id = 1;
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1, status: 'cancelled' }] });

      await cancelAppointment(mockReq, mockRes);

      expect(pool.query).toHaveBeenCalledWith(
        "UPDATE appointments SET status = 'cancelled' WHERE id = $1;",
        [1]
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ success: true, message: 'Appointment cancelled' });
    });
  });
});
