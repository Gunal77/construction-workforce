/**
 * Test Database Connection Script
 * 
 * This script tests the database connection based on DB_PROVIDER
 * 
 * Usage: node scripts/test-connection.js
 */

require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env') });
const env = require('../config/env');
const { connectMongoDB, isConnected, disconnectMongoDB } = require('../config/mongodb');
const db = require('../config/db');

async function testConnection() {
  console.log('\n🔍 Testing Database Connection...\n');
  console.log(`📊 Configuration:`);
  console.log(`   DB_PROVIDER: ${env.dbProvider}`);
  console.log(`   NODE_ENV: ${env.nodeEnv}`);
  console.log('');

  try {
    if (env.dbProvider === 'mongodb') {
      console.log('🔌 Testing MongoDB Connection...');
      
      if (!env.mongodbUri) {
        console.error('❌ MONGODB_URI is not set in environment variables!');
        console.error('   Please add MONGODB_URI to your .env file');
        process.exit(1);
      }
      
      // Mask password in URI for display
      const maskedUri = env.mongodbUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
      console.log(`   URI: ${maskedUri}`);
      
      await connectMongoDB();
      
      if (isConnected()) {
        console.log('✅ MongoDB connection successful!');
        console.log(`   Database: ${env.mongodbUri.split('/').pop().split('?')[0]}`);
        console.log(`   Status: Connected`);
        
        // Test a simple query
        const mongoose = require('mongoose');
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log(`   Collections: ${collections.length} found`);
        if (collections.length > 0) {
          console.log(`   Collection names: ${collections.map(c => c.name).join(', ')}`);
        }
        
        await disconnectMongoDB();
        console.log('\n✅ Connection test completed successfully!');
      } else {
        console.error('❌ MongoDB connection failed!');
        process.exit(1);
      }
    } else {
      console.log('🔌 Testing Supabase (PostgreSQL) Connection...');
      console.log(`   DATABASE_URL: ${env.databaseUrl ? 'configured' : 'not set'}`);
      
      const client = await db.getClient();
      try {
        const result = await client.query('SELECT NOW() as current_time, version() as version');
        console.log('✅ Supabase connection successful!');
        console.log(`   Current Time: ${result.rows[0].current_time}`);
        console.log(`   PostgreSQL Version: ${result.rows[0].version.split(' ')[0]} ${result.rows[0].version.split(' ')[1]}`);
        
        // Test if employees table exists
        const tableCheck = await client.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name IN ('employees', 'attendance_logs', 'leave_requests')
          ORDER BY table_name
        `);
        
        console.log(`   Tables found: ${tableCheck.rows.length}`);
        if (tableCheck.rows.length > 0) {
          console.log(`   Table names: ${tableCheck.rows.map(r => r.table_name).join(', ')}`);
        }
        
        console.log('\n✅ Connection test completed successfully!');
      } finally {
        client.release();
      }
    }
  } catch (error) {
    console.error('\n❌ Connection test failed!');
    console.error(`   Error: ${error.message}`);
    
    if (env.dbProvider === 'mongodb') {
      console.error('\n💡 Troubleshooting tips:');
      console.error('   1. Check if MONGODB_URI is correct');
      console.error('   2. Verify your MongoDB Atlas cluster is running');
      console.error('   3. Check if your IP is whitelisted in MongoDB Atlas');
      console.error('   4. Verify your database password is correct');
    } else {
      console.error('\n💡 Troubleshooting tips:');
      console.error('   1. Check if DATABASE_URL is correct');
      console.error('   2. Verify your Supabase project is active');
      console.error('   3. Check if your database password is correct');
      console.error('   4. Try using connection pooling URL');
    }
    
    process.exit(1);
  }
}

// Run the test
testConnection()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });

