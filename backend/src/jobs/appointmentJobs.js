const cron = require('node-cron');
const pool = require('../config/db');

/**
 * Cron job to mark past scheduled appointments as 'no_show'
 * Runs daily at 12:01 AM
 */
cron.schedule('1 0 * * *', async () => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Running no-show job...`);

  try {
    // Mark appointments as no_show if they're scheduled but the date has passed
    const result = await pool.query(`
      UPDATE appointments
      SET status = 'no_show'
      WHERE status = 'scheduled'
        AND date < CURRENT_DATE
    `);

    console.log(`[${timestamp}] No-show update complete ✔️ - Updated ${result.rowCount} appointments`);
  } catch (err) {
    console.error(`[${timestamp}] Error running no-show job:`, err.message);
  }
});


module.exports = {};
