-- =========================================
--  DOCTOR_AVAILABILITY TABLE
-- =========================================
CREATE TABLE doctor_availability (
    id SERIAL PRIMARY KEY,
    doctor_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    max_patients INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(doctor_id, date, start_time, end_time)
);

-- Index for quick lookup of doctor availability
CREATE INDEX idx_doctor_availability ON doctor_availability(doctor_id, date);