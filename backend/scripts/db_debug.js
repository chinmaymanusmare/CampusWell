require('dotenv').config();
const pool = require('../src/config/db');
(async () => {
  try {
    const users = await pool.query("SELECT id,email,time_per_patient FROM users WHERE role='doctor' ORDER BY id DESC LIMIT 10");
    console.log('doctors:', users.rows);
    const av = await pool.query('SELECT * FROM doctor_availability ORDER BY id DESC LIMIT 10');
    console.log('avail:', av.rows);
  } catch (e) {
    console.error('db debug error', e);
  } finally {
    await pool.end().catch(()=>{});
  }
})();
