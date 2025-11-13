const pool = require('../src/config/db');

// Global afterAll to close the database pool after all tests
afterAll(async () => {
  await pool.end();
});
