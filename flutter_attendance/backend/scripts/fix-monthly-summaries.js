/**
 * Script to fix monthly summaries - ensure _id and employee_id are strings
 * and summaries can be updated correctly
 */

require('dotenv').config();
const env = require('../config/env');
const mongoose = require('mongoose');
const MonthlySummary = require('../models/MonthlySummary');

async function fixMonthlySummaries() {
  try {
    console.log('🔧 Starting monthly summary fix...\n');
    console.log(`📊 Database Provider: ${env.dbProvider.toUpperCase()}\n`);

    if (env.dbProvider !== 'mongodb') {
      console.log('⚠️  This script is for MongoDB only.');
      return;
    }

    // Connect to MongoDB
    if (mongoose.connection.readyState === 0) {
      console.log('🔌 Connecting to MongoDB...');
      await mongoose.connect(env.mongodbUri);
      console.log('✅ Connected to MongoDB\n');
    }

    // Get all summaries
    const summaries = await MonthlySummary.find({}).lean();
    console.log(`📋 Found ${summaries.length} monthly summaries\n`);

    let fixedCount = 0;
    let errorCount = 0;

    for (const summary of summaries) {
      try {
        const summaryId = summary._id?.toString() || summary._id;
        const employeeId = summary.employee_id?.toString() || summary.employee_id;
        
        // Check if _id needs to be fixed (if it's not a string)
        let needsFix = false;
        const updates = {};
        
        // Ensure employee_id is a string
        if (employeeId && typeof employeeId !== 'string') {
          updates.employee_id = employeeId.toString();
          needsFix = true;
        }
        
        // If summary needs fixing, update it
        if (needsFix) {
          console.log(`   🔧 Fixing summary ${summaryId}...`);
          
          // Use updateOne to update the document
          const result = await MonthlySummary.updateOne(
            { _id: summaryId },
            { $set: updates }
          );
          
          if (result.modifiedCount > 0) {
            console.log(`   ✅ Fixed summary ${summaryId}`);
            fixedCount++;
          } else {
            console.log(`   ⚠️  Summary ${summaryId} already correct or not found`);
          }
        } else {
          console.log(`   ✓ Summary ${summaryId} is already correct`);
        }
      } catch (error) {
        console.error(`   ❌ Error fixing summary ${summary._id}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n📊 Summary:');
    console.log(`   ✅ Fixed: ${fixedCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   ✓ Already correct: ${summaries.length - fixedCount - errorCount}`);

  } catch (error) {
    console.error('❌ Error fixing monthly summaries:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the script
if (require.main === module) {
  fixMonthlySummaries()
    .then(() => {
      console.log('\n✨ Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = fixMonthlySummaries;

