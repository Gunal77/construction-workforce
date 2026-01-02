/**
 * Quick Migration Script: Users Only
 * 
 * Migrates only users from Supabase to MongoDB
 * Useful for initial setup before migrating other data
 * 
 * Usage:
 *   node scripts/migrate-users-only.js
 *   node scripts/migrate-users-only.js --dry-run
 */

const db = require('../config/db');
const { connectMongoDB, disconnectMongoDB } = require('../config/mongodb');
const User = require('../models/User');

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');

async function migrateUsers() {
  console.log('\n📦 Migrating Users to MongoDB...\n');
  
  try {
    // Fetch all users from different tables
    console.log('📥 Fetching users from Supabase...');
    
    const usersResult = await db.query(`
      SELECT id, name, email, password_hash, 'WORKER' as role, created_at, updated_at
      FROM users
      WHERE email IS NOT NULL
    `);
    
    const adminsResult = await db.query(`
      SELECT id, name, email, password_hash, 'ADMIN' as role, created_at, updated_at
      FROM admins
      WHERE email IS NOT NULL AND status = 'active'
    `);
    
    const supervisorsResult = await db.query(`
      SELECT id, name, email, password_hash, 'SUPERVISOR' as role, created_at, updated_at
      FROM supervisors
      WHERE email IS NOT NULL
    `);
    
    const usersRows = usersResult.rows || [];
    const adminsRows = adminsResult.rows || [];
    const supervisorsRows = supervisorsResult.rows || [];
    
    const allUsers = [...usersRows, ...adminsRows, ...supervisorsRows];
    
    console.log(`✅ Found ${allUsers.length} users:`);
    console.log(`   - Workers: ${usersRows.length}`);
    console.log(`   - Admins: ${adminsRows.length}`);
    console.log(`   - Supervisors: ${supervisorsRows.length}\n`);
    
    if (isDryRun) {
      console.log('⚠️  DRY RUN MODE - No data will be inserted\n');
      console.log('Users that would be migrated:');
      allUsers.forEach((u, i) => {
        console.log(`   ${i + 1}. ${u.email} (${u.role}) - ${u.name}`);
      });
      return;
    }
    
    let migrated = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const user of allUsers) {
      try {
        const normalizedEmail = user.email.toLowerCase().trim();
        
        // Check if user already exists by ID or email (to avoid duplicates)
        const existingById = await User.findById(user.id);
        const existingByEmail = await User.findOne({ email: normalizedEmail });
        
        if (existingById || existingByEmail) {
          console.log(`   ⏭️  ${user.email} already exists, skipping`);
          skipped++;
          continue;
        }
        
        // If password is already hashed, save directly to avoid re-hashing
        if (user.password_hash && user.password_hash.startsWith('$2')) {
          // Save directly to database bypassing pre-save hook
          await User.collection.insertOne({
            _id: user.id,
            name: user.name || 'Unknown',
            email: normalizedEmail,
            password: user.password_hash,
            role: user.role || 'WORKER',
            isActive: true,
            createdAt: user.created_at || new Date(),
            updatedAt: user.updated_at || new Date(),
          });
          migrated++;
          console.log(`   ✅ ${user.email} (${user.role})`);
          continue;
        }
        
        // Create user document (for non-hashed passwords - should not happen)
        const userDoc = new User({
          _id: user.id,
          name: user.name || 'Unknown',
          email: normalizedEmail,
          password: user.password_hash || 'changeme123', // Will be hashed by pre-save hook
          role: user.role || 'WORKER',
          isActive: true,
          createdAt: user.created_at || new Date(),
          updatedAt: user.updated_at || new Date(),
        });
        
        await userDoc.save();
        migrated++;
        console.log(`   ✅ ${user.email} (${user.role})`);
      } catch (error) {
        errors++;
        // Check if it's a duplicate key error
        if (error.code === 11000 || error.message.includes('duplicate key')) {
          console.log(`   ⏭️  ${user.email} already exists (duplicate), skipping`);
          skipped++;
        } else {
          console.error(`   ❌ Error migrating ${user.email}:`, error.message);
        }
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary');
    console.log('='.repeat(60));
    console.log(`Total Users: ${allUsers.length}`);
    console.log(`✅ Migrated: ${migrated}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    console.log(`❌ Errors: ${errors}`);
    console.log('='.repeat(60) + '\n');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

async function run() {
  try {
    console.log('🚀 Starting User Migration\n');
    
    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await connectMongoDB();
    console.log('✅ MongoDB connected\n');
    
    // Connect to Supabase
    console.log('📡 Connecting to Supabase...');
    await db.getClient();
    console.log('✅ Supabase connected\n');
    
    // Run migration
    await migrateUsers();
    
    console.log('✅ Migration completed!\n');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await disconnectMongoDB();
    await db.pool.end();
    console.log('👋 Disconnected from databases');
  }
}

if (require.main === module) {
  run();
}

module.exports = { migrateUsers };

