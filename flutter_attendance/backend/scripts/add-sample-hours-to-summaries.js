/**
 * Script to add sample hours data to monthly summaries
 * Updates summaries that have 0 hours with realistic sample data
 */

require('dotenv').config();
const env = require('../config/env');
const mongoose = require('mongoose');
const MonthlySummary = require('../models/MonthlySummary');

async function addSampleHours() {
  try {
    console.log('🚀 Starting to add sample hours to monthly summaries...\n');
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

    // Find all summaries with 0 hours for December 2025
    const summaries = await MonthlySummary.find({
      month: 12,
      year: 2025,
      $or: [
        { total_worked_hours: { $exists: false } },
        { total_worked_hours: null },
        { total_worked_hours: mongoose.Types.Decimal128.fromString('0.00') },
        { total_worked_hours: 0 },
      ],
    }).lean();

    console.log(`📋 Found ${summaries.length} summaries with 0 hours\n`);

    if (summaries.length === 0) {
      console.log('✅ All summaries already have hours data!');
      await mongoose.disconnect();
      return;
    }

    let updatedCount = 0;

    // Update each summary with sample hours
    for (const summary of summaries) {
      // Generate realistic sample hours (between 120-200 hours per month)
      const totalHours = Math.floor(Math.random() * 80) + 120; // 120-200 hours
      const otHours = Math.floor(Math.random() * 20); // 0-20 OT hours
      
      // Convert to Decimal128
      const totalHoursDecimal = mongoose.Types.Decimal128.fromString(totalHours.toFixed(2));
      const otHoursDecimal = mongoose.Types.Decimal128.fromString(otHours.toFixed(2));

      // Update the summary
      await MonthlySummary.updateOne(
        { _id: summary._id },
        {
          $set: {
            total_worked_hours: totalHoursDecimal,
            total_ot_hours: otHoursDecimal,
            updated_at: new Date(),
          },
        }
      );

      updatedCount++;
      console.log(`   ✅ Updated summary ${summary._id.toString().substring(0, 8)}...: ${totalHours.toFixed(2)}h worked, ${otHours.toFixed(2)}h OT`);
    }

    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Updated: ${updatedCount} summaries`);
    console.log(`\n✨ Done! Refresh the admin portal to see the updated hours.`);

  } catch (error) {
    console.error('❌ Error adding sample hours:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the script
if (require.main === module) {
  addSampleHours()
    .then(() => {
      console.log('\n✅ Script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = addSampleHours;

