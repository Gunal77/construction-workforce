const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

async function runTimesheetSeed() {
  const client = await pool.connect();
  
  try {
    console.log('Starting timesheet seed...');
    
    const sqlFile = path.join(__dirname, 'seed_timesheets.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    
    // Get count of created timesheets
    const result = await client.query('SELECT COUNT(*) as count FROM timesheets');
    console.log(`✅ Timesheet seed completed successfully!`);
    console.log(`   Total timesheets: ${result.rows[0].count}`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error running timesheet seed:', error);
    process.exit(1);
  } finally {
    client.release();
  }
}

runTimesheetSeed();

