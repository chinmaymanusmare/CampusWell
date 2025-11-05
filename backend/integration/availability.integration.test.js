const request = require('supertest');
const pool = require('../src/config/db');
const app = require('../src/app');

describe('Doctor Availability Integration Tests', () => {
    const timestamp = Date.now();
    const doctorEmail = `doctor${timestamp}@example.com`;
    const studentEmail = `student${timestamp}@example.com`;
    const password = 'Passw0rd1';
    let doctorToken;
    let studentToken;
    let availabilityId;

    beforeAll(async () => {
        // Create a test doctor
        const dRes = await request(app)
            .post('/signup')
            .send({
                name: 'Test Doctor',
                email: doctorEmail,
                password,
                role: 'doctor',
                timePerPatient: 15
            });
        expect(dRes.statusCode).toBe(201);

        // Create a test student
        const sRes = await request(app)
            .post('/signup')
            .send({
                name: 'Test Student',
                email: studentEmail,
                password,
                role: 'student',
                roll_no: 'TEST123'
            });
        expect(sRes.statusCode).toBe(201);

        // Login as doctor
        const dLogin = await request(app)
            .post('/login')
            .send({ email: doctorEmail, password });
        doctorToken = dLogin.body.token;

        // Login as student
        const sLogin = await request(app)
            .post('/login')
            .send({ email: studentEmail, password });
        studentToken = sLogin.body.token;
    });

    afterAll(async () => {
        // Clean up test data
        await pool.query('DELETE FROM users WHERE email IN ($1, $2)', [doctorEmail, studentEmail]);
    });

    describe('Setting Availability', () => {
        test('doctor can set availability', async () => {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const date = tomorrow.toISOString().split('T')[0];

            const res = await request(app)
                .post('/availability')
                .set('Authorization', `Bearer ${doctorToken}`)
                .send({
                    date,
                    startTime: '09:00',
                    endTime: '12:00',
                    maxPatients: 12,
                    timePerPatient: 15
                });

            expect(res.statusCode).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveProperty('id');
            availabilityId = res.body.data.id;
        });

        test('student cannot set availability', async () => {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const date = tomorrow.toISOString().split('T')[0];

            const res = await request(app)
                .post('/availability')
                .set('Authorization', `Bearer ${studentToken}`)
                .send({
                    date,
                    startTime: '09:00',
                    endTime: '12:00'
                });

            expect(res.statusCode).toBe(403);
        });
    });

    describe('Getting Availability', () => {
        test('can get doctor availability', async () => {
            const startDate = new Date();
            const endDate = new Date();
            endDate.setDate(endDate.getDate() + 7);

            // First get the doctor's ID from the availabilityId
            const doctorId = (await pool.query(
                'SELECT doctor_id FROM doctor_availability WHERE id = $1',
                [availabilityId]
            )).rows[0].doctor_id;

            const res = await request(app)
                .get(`/availability/${doctorId}`)
                .set('Authorization', `Bearer ${studentToken}`)
                .query({
                    startDate: startDate.toISOString().split('T')[0],
                    endDate: endDate.toISOString().split('T')[0]
                });

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
        });
    });

    describe('Booking with Availability', () => {
        test('cannot book appointment when slot is full', async () => {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const date = tomorrow.toISOString().split('T')[0];

            // Book maximum number of appointments
            const maxAppointments = 12;
            for (let i = 0; i < maxAppointments; i++) {
                const res = await request(app)
                    .post('/appointments')
                    .set('Authorization', `Bearer ${studentToken}`)
                    .send({
                        doctor_id: 1,
                        date,
                        time: '09:00'
                    });
                
                if (i < maxAppointments - 1) {
                    expect(res.statusCode).toBe(201);
                } else {
                    expect(res.statusCode).toBe(400);
                    expect(res.body.message).toContain('fully booked');
                }
            }
        });
    });

    describe('Deleting Availability', () => {
        test('doctor can delete availability', async () => {
            const res = await request(app)
                .delete(`/availability/${availabilityId}`)
                .set('Authorization', `Bearer ${doctorToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
        });

        test('student cannot delete availability', async () => {
            const res = await request(app)
                .delete(`/availability/${availabilityId}`)
                .set('Authorization', `Bearer ${studentToken}`);

            expect(res.statusCode).toBe(403);
        });
    });
});