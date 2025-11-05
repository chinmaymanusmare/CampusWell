const request = require('supertest');
const pool = require('../src/config/db');
const app = require('../src/app');

describe('Doctor Time Per Patient Integration Tests', () => {
    const timestamp = Date.now();
    const doctorEmail = `doctor${timestamp}@example.com`;
    const password = 'Passw0rd1';
    let doctorToken;

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

        // Login as doctor
        const dLogin = await request(app)
            .post('/login')
            .send({ email: doctorEmail, password });
        doctorToken = dLogin.body.token;
    });

    afterAll(async () => {
        // Clean up test data
        await pool.query('DELETE FROM users WHERE email = $1', [doctorEmail]);
    });

    describe('Update Time Per Patient', () => {
        test('doctor can update their time per patient', async () => {
            const res = await request(app)
                .put('/users/doctor/time-per-patient')
                .set('Authorization', `Bearer ${doctorToken}`)
                .send({
                    timePerPatient: 20
                });

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.time_per_patient).toBe(20);
        });

        test('rejects invalid time per patient value', async () => {
            const res = await request(app)
                .put('/users/doctor/time-per-patient')
                .set('Authorization', `Bearer ${doctorToken}`)
                .send({
                    timePerPatient: 0
                });

            expect(res.statusCode).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toContain('must be greater than 0');
        });

        test('rejects missing time per patient', async () => {
            const res = await request(app)
                .put('/users/doctor/time-per-patient')
                .set('Authorization', `Bearer ${doctorToken}`)
                .send({});

            expect(res.statusCode).toBe(400);
            expect(res.body.success).toBe(false);
        });

        test('updates affect availability calculation', async () => {
            // First set a 3-hour availability
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const date = tomorrow.toISOString().split('T')[0];

            await request(app)
                .post('/availability')
                .set('Authorization', `Bearer ${doctorToken}`)
                .send({
                    date,
                    startTime: '09:00',
                    endTime: '12:00',
                    maxPatients: null // Let it calculate based on time_per_patient
                });

            // Update time per patient to 30 minutes
            await request(app)
                .put('/users/doctor/time-per-patient')
                .set('Authorization', `Bearer ${doctorToken}`)
                .send({
                    timePerPatient: 30
                });

            // Try to book appointments
            let appointmentCount = 0;
            let lastResponse;

            // Should only allow 6 appointments (3 hours = 180 minutes / 30 minutes per patient)
            while (appointmentCount < 7) {
                lastResponse = await request(app)
                    .post('/appointments')
                    .set('Authorization', `Bearer ${doctorToken}`)
                    .send({
                        doctor_id: 1,
                        date,
                        time: '09:00'
                    });

                if (lastResponse.statusCode !== 201) break;
                appointmentCount++;
            }

            expect(appointmentCount).toBe(6);
            expect(lastResponse.statusCode).toBe(400);
            expect(lastResponse.body.message).toContain('fully booked');
        });
    });
});