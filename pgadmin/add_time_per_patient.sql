-- Add time_per_patient column to users table
ALTER TABLE users
ADD COLUMN time_per_patient INT;

-- Set default value for existing doctors
UPDATE users 
SET time_per_patient = 15 
WHERE role = 'doctor';

-- Modify the column to make it required for doctors
ALTER TABLE users 
ADD CONSTRAINT doctor_time_per_patient 
CHECK ((role != 'doctor') OR (role = 'doctor' AND time_per_patient IS NOT NULL));