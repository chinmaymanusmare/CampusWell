-- Populate sample availability data for doctors
-- This creates availability slots for the next 7 days for all doctors

-- First, let's check if doctor_availability table exists and create if needed
-- (This part should already exist from your schema)

-- Clear existing future availability (optional - remove if you want to keep existing data)
-- DELETE FROM doctor_availability WHERE date >= CURRENT_DATE;

-- Insert sample availability for all doctors
-- Morning slots: 9:00 - 12:00
-- Afternoon slots: 14:00 - 17:00

DO $$
DECLARE
    doctor_record RECORD;
    date_offset INT;
    current_date_iter DATE;
BEGIN
    -- Loop through all doctors
    FOR doctor_record IN 
        SELECT id, time_per_patient 
        FROM users 
        WHERE role = 'doctor'
    LOOP
        -- Create slots for next 7 days
        FOR date_offset IN 0..6 LOOP
            current_date_iter := CURRENT_DATE + date_offset;
            
            -- Skip Sundays (day of week = 0)
            IF EXTRACT(DOW FROM current_date_iter) != 0 THEN
                
                -- Morning Slot 1: 9:00 - 10:00
                INSERT INTO doctor_availability (
                    doctor_id, 
                    date, 
                    start_time, 
                    end_time, 
                    max_patients
                ) VALUES (
                    doctor_record.id,
                    current_date_iter,
                    '09:00:00',
                    '10:00:00',
                    FLOOR(60 / COALESCE(doctor_record.time_per_patient, 15))::INT
                ) ON CONFLICT (doctor_id, date, start_time) DO NOTHING;
                
                -- Morning Slot 2: 10:00 - 11:00
                INSERT INTO doctor_availability (
                    doctor_id, 
                    date, 
                    start_time, 
                    end_time, 
                    max_patients
                ) VALUES (
                    doctor_record.id,
                    current_date_iter,
                    '10:00:00',
                    '11:00:00',
                    FLOOR(60 / COALESCE(doctor_record.time_per_patient, 15))::INT
                ) ON CONFLICT (doctor_id, date, start_time) DO NOTHING;
                
                -- Morning Slot 3: 11:00 - 12:00
                INSERT INTO doctor_availability (
                    doctor_id, 
                    date, 
                    start_time, 
                    end_time, 
                    max_patients
                ) VALUES (
                    doctor_record.id,
                    current_date_iter,
                    '11:00:00',
                    '12:00:00',
                    FLOOR(60 / COALESCE(doctor_record.time_per_patient, 15))::INT
                ) ON CONFLICT (doctor_id, date, start_time) DO NOTHING;
                
                -- Afternoon Slot 1: 14:00 - 15:00
                INSERT INTO doctor_availability (
                    doctor_id, 
                    date, 
                    start_time, 
                    end_time, 
                    max_patients
                ) VALUES (
                    doctor_record.id,
                    current_date_iter,
                    '14:00:00',
                    '15:00:00',
                    FLOOR(60 / COALESCE(doctor_record.time_per_patient, 15))::INT
                ) ON CONFLICT (doctor_id, date, start_time) DO NOTHING;
                
                -- Afternoon Slot 2: 15:00 - 16:00
                INSERT INTO doctor_availability (
                    doctor_id, 
                    date, 
                    start_time, 
                    end_time, 
                    max_patients
                ) VALUES (
                    doctor_record.id,
                    current_date_iter,
                    '15:00:00',
                    '16:00:00',
                    FLOOR(60 / COALESCE(doctor_record.time_per_patient, 15))::INT
                ) ON CONFLICT (doctor_id, date, start_time) DO NOTHING;
                
                -- Afternoon Slot 3: 16:00 - 17:00
                INSERT INTO doctor_availability (
                    doctor_id, 
                    date, 
                    start_time, 
                    end_time, 
                    max_patients
                ) VALUES (
                    doctor_record.id,
                    current_date_iter,
                    '16:00:00',
                    '17:00:00',
                    FLOOR(60 / COALESCE(doctor_record.time_per_patient, 15))::INT
                ) ON CONFLICT (doctor_id, date, start_time) DO NOTHING;
                
            END IF;
        END LOOP;
    END LOOP;
END $$;

-- Verify the data
SELECT 
    u.name as doctor_name,
    u.specialization,
    u.time_per_patient,
    da.date,
    da.start_time,
    da.end_time,
    da.max_patients
FROM doctor_availability da
JOIN users u ON da.doctor_id = u.id
WHERE da.date >= CURRENT_DATE
ORDER BY da.date, da.start_time, u.name;
