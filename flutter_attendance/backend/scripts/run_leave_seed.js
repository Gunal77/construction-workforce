/**
 * Script to seed leave management data
 * Run this after the migration 015_create_leave_management_tables.sql has been executed
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
});

async function runSeed() {
  const client = await pool.connect();
  
  try {
    console.log('🌱 Starting leave management data seed...');
    
    // Read the SQL file
    const sqlFile = path.join(__dirname, 'seed_leave_management_data.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    
    // Execute the SQL
    console.log('📝 Executing seed script...');
    await client.query(sql);
    
    console.log('✅ Leave management data seeded successfully!');
    console.log('\n📊 Summary:');
    console.log('   - Leave balances initialized for all employees');
    console.log('   - Sample leave requests created with various statuses');
    console.log('   - Approved requests have been deducted from balances');
    
  } catch (error) {
    console.error('❌ Error seeding leave management data:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  runSeed()
    .then(() => {
      console.log('\n✨ Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { runSeed };

