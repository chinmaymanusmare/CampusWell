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
const { signup, login } = require('./controllers/userController');
app.post('/signup', signup);
app.use('/login', login);


const appointmentRoutes = require('./routes/appointmentRoutes');
app.use('/', appointmentRoutes);

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Swagger docs available at http://localhost:${PORT}/api-docs`);
});
