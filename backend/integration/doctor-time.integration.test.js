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
        // Clean up all test data including appointments and all test users
        await pool.query("DELETE FROM appointments WHERE student_id IN (SELECT id FROM users WHERE email LIKE 'student%@example.com')");
        await pool.query("DELETE FROM doctor_availability WHERE doctor_id IN (SELECT id FROM users WHERE email LIKE 'doctor%@example.com')");
        await pool.query("DELETE FROM users WHERE email LIKE 'student%@example.com' OR email LIKE 'doctor%@example.com'");
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

            // ensure availability created
            const availCheck = await pool.query('SELECT * FROM doctor_availability WHERE doctor_id = $1 AND date = $2', [
                (await pool.query('SELECT id FROM users WHERE email = $1', [doctorEmail])).rows[0].id,
                date
            ]);
            expect(availCheck.rows.length).toBeGreaterThan(0);

            // Update time per patient to 30 minutes
            await request(app)
                .put('/users/doctor/time-per-patient')
                .set('Authorization', `Bearer ${doctorToken}`)
                .send({
                    timePerPatient: 30
                });

            // Get doctor ID from the database
            const doctorResult = await pool.query(
                'SELECT id FROM users WHERE email = $1',
                [doctorEmail]
            );
            const doctorId = doctorResult.rows[0].id;

            // Create a test student to book appointments
            const studentEmail = `student${timestamp}@example.com`;
            await request(app)
                .post('/signup')
                .send({
                    name: 'Test Student',
                    email: studentEmail,
                    password,
                    role: 'student',
                    roll_no: 'TEST123'
                });

            const studentLogin = await request(app)
                .post('/login')
                .send({ email: studentEmail, password });
            const studentToken = studentLogin.body.token;

            // Try to book appointments
            let appointmentCount = 0;
            let lastResponse;

            // Should only allow 6 appointments (3 hours = 180 minutes / 30 minutes per patient)
            // Create multiple students to test max capacity
            for (let i = 0; i < 7; i++) {
                const studentEmail = `student${i}${timestamp}@example.com`;
                await request(app)
                    .post('/signup')
                    .send({
                        name: `Test Student ${i}`,
                        email: studentEmail,
                        password,
                        role: 'student',
                        roll_no: `TEST${i}`
                    });

                const studLogin = await request(app)
                    .post('/login')
                    .send({ email: studentEmail, password });

                lastResponse = await request(app)
                    .post('/appointments')
                    .set('Authorization', `Bearer ${studLogin.body.token}`)
                    .send({
                        doctor_id: doctorId,
                        date,
                        time: '09:00'
                    });

                if (lastResponse.statusCode === 201) {
                    appointmentCount++;
                } else {
                    break;
                }
            }

            // Clean up test students
            for (let i = 0; i < 7; i++) {
                await pool.query('DELETE FROM users WHERE email = $1', [`student${i}${timestamp}@example.com`]);
            }

            expect(appointmentCount).toBe(6);
            expect(lastResponse.statusCode).toBe(400);
            // controller now returns a unified 'Doctor not available at this time' message when no slots
            expect(lastResponse.body.message).toContain('Doctor not available');
        });
    });
});