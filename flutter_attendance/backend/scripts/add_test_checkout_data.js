/**
 * Test Script: Add Checkout Data to Existing Records
 * 
 * This script adds sample checkout data to a few existing attendance records
 * for testing purposes. It updates the most recent checked-out records.
 * 
 * Usage: node scripts/add_test_checkout_data.js
 */

const db = require('../config/db');

async function addTestCheckoutData() {
  const client = await db.getClient();
  
  try {
    console.log('🔧 Adding test checkout data to existing records...\n');
    
    // Get the 5 most recent checked-out records without checkout data
    const recordsToUpdate = await client.query(`
      SELECT id, user_id, check_out_time
      FROM attendance_logs 
      WHERE check_out_time IS NOT NULL 
        AND checkout_image_url IS NULL 
        AND checkout_latitude IS NULL 
        AND checkout_longitude IS NULL
      ORDER BY check_out_time DESC
      LIMIT 5;
    `);
    
    if (recordsToUpdate.rows.length === 0) {
      console.log('⚠️  No records found to update.');
      return;
    }
    
    console.log(`Found ${recordsToUpdate.rows.length} records to update:\n`);
    
    // Update each record with sample checkout data
    for (const record of recordsToUpdate.rows) {
      // Use the same image URL as check-in (for testing)
      const checkInData = await client.query(`
        SELECT image_url, latitude, longitude
        FROM attendance_logs
        WHERE id = $1
      `, [record.id]);
      
      const checkInImage = checkInData.rows[0]?.image_url;
      const checkInLat = checkInData.rows[0]?.latitude;
      const checkInLng = checkInData.rows[0]?.longitude;
      
      // For testing, use check-in image and slightly offset location
      const checkoutImageUrl = checkInImage || 'https://via.placeholder.com/400x300?text=Checkout+Photo';
      const checkoutLat = checkInLat ? checkInLat + 0.0001 : 10.758233;
      const checkoutLng = checkInLng ? checkInLng + 0.0001 : 79.100342;
      
      await client.query(`
        UPDATE attendance_logs
        SET checkout_image_url = $1,
            checkout_latitude = $2,
            checkout_longitude = $3
        WHERE id = $4
      `, [checkoutImageUrl, checkoutLat, checkoutLng, record.id]);
      
      console.log(`✅ Updated record ${record.id}`);
      console.log(`   Checkout Image: ${checkoutImageUrl ? 'Yes' : 'No'}`);
      console.log(`   Checkout Location: ${checkoutLat}, ${checkoutLng}`);
    }
    
    console.log('\n✅ Test checkout data added successfully!');
    console.log('   Refresh the attendance page to see the checkout images and locations.\n');
    
  } catch (error) {
    console.error('❌ Failed to add test checkout data:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

// Run the script
addTestCheckoutData()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });

