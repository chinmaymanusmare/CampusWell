const express = require('express');
const YAML = require('yamljs');
const path = require('path');
const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config(); 
const userRoutes = require('./routes/userRoutes');

const app = express();

// Enable CORS for all routes
app.use(cors());

// Parse cookies
app.use(cookieParser());

// Parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Set up EJS as view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../../frontend/views'));

// Serve static files (CSS, images, etc.)
app.use(express.static(path.join(__dirname, '../../frontend/public')));
app.use('/css', express.static(path.join(__dirname, '../../frontend/css')));
app.use('/images', express.static(path.join(__dirname, '../../frontend/images')));
const swaggerDocument = YAML.load(path.join(__dirname, 'swagger.yaml'));


app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Frontend routes (must come before API routes to serve pages)
const frontendRoutes = require('./routes/frontendRoutes');
app.use('/', frontendRoutes);

// Web authentication routes (for form-based login/signup)
const { webLogin, webSignup, webLogout } = require('./controllers/webAuthController');
app.post('/login', webLogin);
app.post('/signup', webSignup);
app.get('/logout', webLogout);

// API routes
app.use('/users', userRoutes);
const { signup, login, logout } = require('./controllers/userController');
app.post('/api/signup', signup);
app.post('/api/login', login);
app.post('/api/logout', logout);


const appointmentRoutes = require('./routes/appointmentRoutes');
app.use('/', appointmentRoutes);

const availabilityRoutes = require('./routes/availabilityRoutes');
app.use('/availability', availabilityRoutes);

const concernRoutes = require('./routes/concernRoutes');
app.use('/concerns', concernRoutes);

const recordRoutes = require('./routes/recordRoutes');
app.use('/records', recordRoutes);

const referralRoutes = require('./routes/referralRoutes');
app.use('/referrals', referralRoutes);

const pharmacyRoutes = require("./routes/pharmacyRoutes");
app.use("/pharmacy", pharmacyRoutes);

const adminRoutes = require("./routes/adminRoutes");
app.use("/admin", adminRoutes);

const notificationRoutes = require("./routes/notificationRoutes");
app.use("/notifications", notificationRoutes);

// 404 Error Handler - Must be after all other routes
app.use((req, res, next) => {
  res.status(404).render('error/404');
});

// 500 Error Handler - General error handler
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).render('error/500');
});

module.exports = app;