const express = require('express');
const YAML = require('yamljs');
const path = require('path');
const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
require('dotenv').config(); 
const userRoutes = require('./routes/userRoutes');

const app = express();
app.use(express.json());
const swaggerDocument = YAML.load(path.join(__dirname, 'swagger.yaml'));


app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use('/users', userRoutes);
const { signup, login, logout } = require('./controllers/userController');
app.post('/signup', signup);
app.use('/login', login);


app.post('/logout', logout);


const appointmentRoutes = require('./routes/appointmentRoutes');
app.use('/', appointmentRoutes);

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



const PORT = 3000;
app.listen(PORT,'127.0.0.1', () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Swagger docs available at http://localhost:${PORT}/api-docs`);
});
