const express = require("express");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");
const { connectDB } = require("./config/db"); 
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(cors());

// Connect Database
connectDB();

// Swagger setup
const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "CampusWell API",
      version: "1.0.0",
      description: "API documentation for IIT Dharwad CampusWell system",
    },
    servers: [{ url: "http://localhost:5000" }],
  },
  apis: ["./src/routes/*.js"],
};

const swaggerSpec = swaggerJsdoc(options);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Test route
app.get("/", (req, res) => {
  res.send("CampusWell API is running ✅");
});

// ✅ Start server here
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
