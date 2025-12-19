/**
 * Verification Script for Checkout Columns
 * 
 * This script verifies that:
 * 1. The checkout columns exist in the attendance_logs table
 * 2. Any records have checkout data
 * 
 * Usage: node scripts/verify_checkout_columns.js
 */

const db = require('../config/db');

async function verifyCheckoutColumns() {
  const client = await db.getClient();
  
  try {
    console.log('🔍 Verifying checkout columns...\n');
    
    // Check if columns exist
    const columnCheck = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'attendance_logs' 
      AND column_name IN ('checkout_image_url', 'checkout_latitude', 'checkout_longitude')
      ORDER BY column_name;
    `);
    
    console.log('📊 Column Check:');
    if (columnCheck.rows.length === 3) {
      console.log('✅ All checkout columns exist:');
      columnCheck.rows.forEach(col => {
        console.log(`   - ${col.column_name}: ${col.data_type}`);
      });
    } else {
      console.log('❌ Missing columns! Found:', columnCheck.rows.length);
      columnCheck.rows.forEach(col => {
        console.log(`   - ${col.column_name}: ${col.data_type}`);
      });
      console.log('\n⚠️  Please run migration 024_add_checkout_image_location.sql');
      return;
    }
    
    console.log('\n📈 Data Check:');
    
    // Check total records
    const totalRecords = await client.query(`
      SELECT COUNT(*) as total FROM attendance_logs;
    `);
    console.log(`Total attendance records: ${totalRecords.rows[0].total}`);
    
    // Check records with checkout data
    const recordsWithCheckout = await client.query(`
      SELECT COUNT(*) as count 
      FROM attendance_logs 
      WHERE checkout_image_url IS NOT NULL 
         OR checkout_latitude IS NOT NULL 
         OR checkout_longitude IS NOT NULL;
    `);
    console.log(`Records with checkout data: ${recordsWithCheckout.rows[0].count}`);
    
    // Check records with check_out_time but no checkout data
    const recordsWithoutCheckoutData = await client.query(`
      SELECT COUNT(*) as count 
      FROM attendance_logs 
      WHERE check_out_time IS NOT NULL 
        AND checkout_image_url IS NULL 
        AND checkout_latitude IS NULL 
        AND checkout_longitude IS NULL;
    `);
    console.log(`Records checked out but without checkout data: ${recordsWithoutCheckoutData.rows[0].count}`);
    
    // Show sample records with checkout data
    const sampleRecords = await client.query(`
      SELECT 
        id,
        user_id,
        check_in_time,
        check_out_time,
        CASE WHEN checkout_image_url IS NOT NULL THEN 'Yes' ELSE 'No' END as has_checkout_image,
        CASE WHEN checkout_latitude IS NOT NULL THEN 'Yes' ELSE 'No' END as has_checkout_lat,
        CASE WHEN checkout_longitude IS NOT NULL THEN 'Yes' ELSE 'No' END as has_checkout_lng
      FROM attendance_logs 
      WHERE checkout_image_url IS NOT NULL 
         OR checkout_latitude IS NOT NULL 
         OR checkout_longitude IS NOT NULL
      ORDER BY check_out_time DESC
      LIMIT 5;
    `);
    
    if (sampleRecords.rows.length > 0) {
      console.log('\n📋 Sample records with checkout data:');
      sampleRecords.rows.forEach((record, index) => {
        console.log(`\n   Record ${index + 1}:`);
        console.log(`   - ID: ${record.id}`);
        console.log(`   - Check In: ${record.check_in_time}`);
        console.log(`   - Check Out: ${record.check_out_time}`);
        console.log(`   - Has Checkout Image: ${record.has_checkout_image}`);
        console.log(`   - Has Checkout Lat: ${record.has_checkout_lat}`);
        console.log(`   - Has Checkout Lng: ${record.has_checkout_lng}`);
      });
    } else {
      console.log('\n⚠️  No records found with checkout data.');
      console.log('   This means:');
      console.log('   1. Users need to check out using the mobile app with photo capture');
      console.log('   2. Existing records were created before the feature was implemented');
    }
    
    console.log('\n✅ Verification complete!\n');
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

// Run verification
verifyCheckoutColumns()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Verification script failed:', error);
    process.exit(1);
  });

