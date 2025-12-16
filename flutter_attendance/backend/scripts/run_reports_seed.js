const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

async function runReportsSeed() {
  const client = await pool.connect();
  
  try {
    console.log('Starting reports seed...');
    
    const sqlFile = path.join(__dirname, 'seed_reports_data.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    
    console.log(`✅ Reports seed completed successfully!`);
    console.log(`   Projects, employees, and attendance records have been populated with sample data.`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error running reports seed:', error);
    process.exit(1);
  } finally {
    client.release();
  }
}

runReportsSeed();
