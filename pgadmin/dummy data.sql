-- =========================================
--  DUMMY DATA
-- =========================================

-- USERS
INSERT INTO users (name, email,password, role, roll_number, specialization) VALUES
('Alice Johnson', 'alice@student.com','$2b$10$PjmCR33UTSpamAjVqOfetOXh62WujsrYrkbd6RjVJvcy7kBd.5ncG', 'student', 'STU001', NULL),
('Bob Smith', 'bob@student.com','$2b$10$PjmCR33UTSpamAjVqOfetOXh62WujsrYrkbd6RjVJvcy7kBd.5ncG', 'student', 'STU002', NULL),
('Dr. Emily Carter', 'emily@hospital.com','$2b$10$PjmCR33UTSpamAjVqOfetOXh62WujsrYrkbd6RjVJvcy7kBd.5ncG', 'doctor', NULL, 'Cardiology'),
('Dr. David Lee', 'david@hospital.com','$2b$10$PjmCR33UTSpamAjVqOfetOXh62WujsrYrkbd6RjVJvcy7kBd.5ncG', 'doctor', NULL, 'Dermatology'),
('Admin User', 'admin@system.com','$2b$10$PjmCR33UTSpamAjVqOfetOXh62WujsrYrkbd6RjVJvcy7kBd.5ncG', 'admin', NULL, NULL),
('Pharmacy Staff', 'pharmacy@meds.com','$2b$10$PjmCR33UTSpamAjVqOfetOXh62WujsrYrkbd6RjVJvcy7kBd.5ncG', 'pharmacy', NULL, NULL);

-- CONCERNS
INSERT INTO concerns (category, message, status, created_at, response, responded_by, responded_at)
VALUES
('Medical', 'I have a fever for 3 days.', 'responded', NOW() - INTERVAL '3 days',
 'Please visit the doctor for a check-up.', 3, NOW() - INTERVAL '2 days'),
('System', 'Unable to book appointment.', 'pending', NOW() - INTERVAL '1 day', NULL, NULL, NULL);

-- APPOINTMENTS
INSERT INTO appointments (student_id, student_name, doctor_id, doctor_name, date, time, status, reason)
VALUES
(1, 'Alice Johnson', 3, 'Dr. Emily Carter', CURRENT_DATE + INTERVAL '1 day', '10:00 AM', 'scheduled', 'Chest pain'),
(2, 'Bob Smith', 4, 'Dr. David Lee', CURRENT_DATE - INTERVAL '2 days', '2:30 PM', 'completed', 'Skin rash');

-- PRESCRIPTIONS
INSERT INTO prescriptions (student_id, doctor_name, date, medicines, diagnosis, notes)
VALUES
(2, 'Dr. David Lee', CURRENT_DATE - INTERVAL '2 days', 'Antihistamine, Cream', 'Allergic reaction', 'Apply cream twice daily.'),
(1, 'Dr. Emily Carter', CURRENT_DATE, 'Paracetamol 500mg', 'Fever', 'Take one tablet every 6 hours.');

-- REFERRALS
INSERT INTO referrals (student_id, student_name, reason, status, requested_at, doctor_notes)
VALUES
(1, 'Alice Johnson', 'Requires specialist for cardiac test', 'approved', NOW() - INTERVAL '1 day', 'Referred to Cardiology department.'),
(2, 'Bob Smith', 'Needs dermatology follow-up', 'pending', NOW(), NULL);

-- MEDICINES
INSERT INTO medicines (name, description, stock, price) VALUES
('Paracetamol 500mg', 'Pain reliever and fever reducer', 200, 10),
('Antihistamine', 'Used for allergic reactions', 150, 15),
('Cough Syrup', 'For dry cough relief', 100, 25),
('Antibiotic 250mg', 'Used for bacterial infections', 80, 50);

-- ORDERS
INSERT INTO orders (student_id, student_name, status, ordered_at, total) VALUES
(1, 'Alice Johnson', 'pending', NOW() - INTERVAL '1 day', 50),
(2, 'Bob Smith', 'ready', NOW() - INTERVAL '3 hours', 75);

-- ORDER_MEDICINES
INSERT INTO order_medicines (order_id, medicine_id, quantity) VALUES
(1, 1, 2),
(1, 3, 1),
(2, 2, 3),
(2, 4, 1);