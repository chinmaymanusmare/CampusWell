# CampusWell Project Documentation

## Core Functionalities

### 1. User Management
- User registration and authentication
- Role-based access control (Admin, Doctor, Student, Pharmacy Staff)
- User profile management
- JWT-based authentication

### 2. Appointment System
- Schedule doctor appointments
- View available time slots
- Book appointments within time constraints
- Cancel appointments
- Time per patient management
- Maximum patients per slot calculation
- Concurrent booking handling

### 3. Doctor Availability Management
- Set doctor availability schedules
- Define time slots
- Set time per patient
- Maximum patients per slot
- Manage working hours

### 4. Medical Records
- Create and maintain medical records
- View patient history
- Record management by doctors
- Patient access to own records

### 5. Pharmacy System
- Prescription management
- Medicine inventory
- Prescription fulfillment tracking
- Pharmacy notifications

### 6. Referral System
- Create referrals between doctors
- Track referral status
- Manage referral appointments

### 7. Concern Management
- Submit medical concerns
- Anonymous concern submission
- Concern tracking and resolution
- Referral based on concerns

### 8. Notification System
- Appointment reminders
- Prescription notifications
- Referral notifications
- General system notifications

## Test Cases

### 1. Authentication Tests (auth.integration.test.js)
- User registration
- User login
- Token validation
- Invalid credentials handling
- Password reset functionality

### 2. Appointment Tests (appointments.integration.test.js)
- Book new appointment
- Cancel appointment
- View appointments
- Slot availability checking
- Appointment conflict prevention

### 3. Doctor Time Management Tests (doctor-time.integration.test.js)
- Time per patient calculation
- Maximum patients per slot
- Concurrent booking handling
- Slot availability calculation
- Booking limits enforcement

### 4. Pharmacy Tests (pharmacy.integration.test.js & pharmacy-flow.integration.test.js)
- Add prescription
- View prescriptions
- Update prescription status
- Pharmacy workflow
- Medicine inventory management

### 5. Concern and Referral Tests (concern-referral.integration.test.js)
- Submit concern
- Process concern
- Create referral
- Track referral status
- Anonymous concern handling

### 6. Scenario Tests (scenarios.integration.test.js)
- Multiple appointment bookings
- Different time slot configurations
- Maximum patient limits
- Concurrent access scenarios
- Edge case handling

## API Endpoints

### User Routes
- POST /api/users/register
- POST /api/users/login
- GET /api/users/profile
- PUT /api/users/profile

### Appointment Routes
- POST /api/appointments
- GET /api/appointments
- PUT /api/appointments/:id
- DELETE /api/appointments/:id

### Availability Routes
- POST /api/availability
- GET /api/availability
- PUT /api/availability/:id
- DELETE /api/availability/:id

### Medical Record Routes
- POST /api/records
- GET /api/records
- GET /api/records/:id
- PUT /api/records/:id

### Pharmacy Routes
- POST /api/pharmacy/prescriptions
- GET /api/pharmacy/prescriptions
- PUT /api/pharmacy/prescriptions/:id
- GET /api/pharmacy/inventory

### Referral Routes
- POST /api/referrals
- GET /api/referrals
- PUT /api/referrals/:id
- GET /api/referrals/:id

### Concern Routes
- POST /api/concerns
- GET /api/concerns
- PUT /api/concerns/:id
- GET /api/concerns/:id

### Notification Routes
- GET /api/notifications
- PUT /api/notifications/:id
- DELETE /api/notifications/:id

## Database Schema

### Users Table
- id (Primary Key)
- username
- password (hashed)
- role
- email
- created_at

### Appointments Table
- id (Primary Key)
- doctor_id (Foreign Key)
- patient_id (Foreign Key)
- date
- time_slot
- status
- created_at

### Availability Table
- id (Primary Key)
- doctor_id (Foreign Key)
- date
- start_time
- end_time
- time_per_patient
- max_patients
- current_bookings

### Medical Records Table
- id (Primary Key)
- patient_id (Foreign Key)
- doctor_id (Foreign Key)
- diagnosis
- prescription
- notes
- created_at

### Pharmacy Table
- id (Primary Key)
- prescription_id (Foreign Key)
- status
- notes
- created_at

### Referrals Table
- id (Primary Key)
- from_doctor_id (Foreign Key)
- to_doctor_id (Foreign Key)
- patient_id (Foreign Key)
- reason
- status
- created_at

### Concerns Table
- id (Primary Key)
- patient_id (Foreign Key, nullable for anonymous)
- description
- status
- is_anonymous
- created_at

### Notifications Table
- id (Primary Key)
- user_id (Foreign Key)
- type
- message
- read_status
- created_at

## Security Features
1. JWT-based authentication
2. Password hashing
3. Role-based access control
4. Input validation
5. SQL injection prevention
6. XSS protection
7. Rate limiting
8. Session management

## Error Handling
1. Custom error middleware
2. Standardized error responses
3. Validation error handling
4. Database error handling
5. Authentication error handling
6. Authorization error handling

## Performance Optimizations
1. Database query optimization
2. Connection pooling
3. Caching strategies
4. Async/await implementation
5. Proper indexing
6. Request throttling