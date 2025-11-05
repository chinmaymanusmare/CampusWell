-- =========================================
--  USERS TABLE
-- =========================================
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) CHECK (role IN ('student', 'doctor', 'admin', 'pharmacy')) NOT NULL,
    roll_number VARCHAR(50),
    specialization VARCHAR(255),
    time_per_patient INTEGER DEFAULT 15
);

-- =========================================
--  CONCERNS TABLE
-- =========================================
CREATE TABLE concerns (
    id SERIAL PRIMARY KEY,
    category VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(50) CHECK (status IN ('pending', 'responded')) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    response TEXT,
    responded_by INT REFERENCES users(id) ON DELETE SET NULL,
    responded_at TIMESTAMP
);

-- =========================================
--  APPOINTMENTS TABLE
-- =========================================
CREATE TABLE appointments (
    id SERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    student_name VARCHAR(255) NOT NULL,
    doctor_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    doctor_name VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    time VARCHAR(50) NOT NULL,
    status VARCHAR(50) CHECK (status IN ('scheduled', 'completed', 'cancelled')) DEFAULT 'scheduled',
    reason TEXT
);

-- =========================================
--  PRESCRIPTIONS TABLE
-- =========================================
CREATE TABLE prescriptions (
    id SERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    doctor_name VARCHAR(255) NOT NULL,
    date DATE DEFAULT CURRENT_DATE,
    medicines TEXT,
    diagnosis TEXT,
    notes TEXT
);

-- =========================================
--  REFERRALS TABLE
-- =========================================
CREATE TABLE referrals (
    id SERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    student_name VARCHAR(255) NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(50) CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    doctor_notes TEXT
);

-- =========================================
--  MEDICINES TABLE
-- =========================================
CREATE TABLE medicines (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    stock INT DEFAULT 0 CHECK (stock >= 0),
    price INT DEFAULT 0 CHECK (price >= 0)
);

-- =========================================
--  ORDERS TABLE
-- =========================================
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    student_name VARCHAR(255) NOT NULL,
    status VARCHAR(50) CHECK (status IN ('pending', 'ready', 'collected')) DEFAULT 'pending',
    ordered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total INT DEFAULT 0 CHECK (total >= 0)
    ,prescription_link TEXT
);

-- =========================================
--  ORDER_MEDICINES TABLE (Junction)
-- =========================================
CREATE TABLE order_medicines (
    order_id INT REFERENCES orders(id) ON DELETE CASCADE,
    medicine_id INT REFERENCES medicines(id) ON DELETE CASCADE,
    quantity INT NOT NULL CHECK (quantity > 0),
    PRIMARY KEY (order_id, medicine_id)
);


-- =========================================
--  INDEXES
-- =========================================
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_appointments_date ON appointments(date);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_referrals_status ON referrals(status);