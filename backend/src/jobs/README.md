# Appointment Cron Job

This directory contains an automated background job for managing appointment statuses.

## Job Configured

### No-Show Checker
**Schedule:** Daily at 12:01 AM  
**Cron Expression:** `'1 0 * * *'`

Marks appointments as `'no_show'` if:
- Status is `'scheduled'`
- Appointment date has passed

## Cron Schedule Syntax

```
┌─────────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)
│ │ ┌─────────── day of month (1 - 31)
│ │ │ ┌───────── month (1 - 12)
│ │ │ │ ┌─────── day of week (0 - 6) (Sunday to Saturday)
│ │ │ │ │
* * * * *
```

### Examples:
- `'0 0 * * *'` - Daily at midnight
- `'*/15 * * * *'` - Every 15 minutes
- `'0 9 * * 1-5'` - 9 AM on weekdays
- `'0 0 1 * *'` - First day of every month at midnight

## Testing

To manually test the job logic without waiting:

```javascript
// In appointmentJobs.js, add immediate execution:
(async () => {
  console.log('Testing no-show job...');
  const result = await pool.query(`
    UPDATE appointments
    SET status = 'no_show'
    WHERE status = 'scheduled'
      AND date < CURRENT_DATE
  `);
  console.log('Test complete:', result.rowCount);
})();
```

## Logs

Job logs to console with timestamps:
```
[2025-11-20T00:01:00.000Z] Running no-show job...
[2025-11-20T00:01:00.100Z] No-show update complete ✔️ - Updated 5 appointments
```

## Disabling the Job

To disable the job, comment out the require in `server.js`:
```javascript
// require('./jobs/appointmentJobs');
```
