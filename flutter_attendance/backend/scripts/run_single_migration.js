const db = require('../config/db');
const fs = require('fs');
const path = require('path');

const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error('Usage: node run_single_migration.js <migration_file_name>');
  process.exit(1);
}

async function runMigration() {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');
    console.log(`🔄 Running migration: ${migrationFile}...\n`);

    const filePath = path.join(__dirname, '../migrations', migrationFile);
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`Migration file not found: ${filePath}`);
    }

    const sql = fs.readFileSync(filePath, 'utf8');
    
    await client.query(sql);
    console.log(`✅ ${migrationFile} completed successfully!\n`);

    await client.query('COMMIT');
    console.log('✅ Migration completed!\n');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

runMigration()
  .then(() => {
    console.log('✅ Migration script finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration script failed:', error);
    process.exit(1);
  });

