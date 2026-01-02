/**
 * Test script to verify monthly summary lookup
 */

require('dotenv').config();
const env = require('../config/env');
const mongoose = require('mongoose');
const User = require('../models/User');
const EmployeeMerged = require('../models/EmployeeMerged');
const MonthlySummary = require('../models/MonthlySummary');

async function testMonthlySummaryLookup() {
  try {
    console.log('🔍 Testing Monthly Summary Lookup...\n');
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

    // Get a sample worker user
    const workerUser = await User.findOne({ role: 'WORKER' }).lean();
    if (!workerUser) {
      console.log('❌ No worker user found');
      await mongoose.disconnect();
      return;
    }

    console.log(`👤 Found worker user: ${workerUser.name} (${workerUser.email})`);
    console.log(`   User ID: ${workerUser._id}\n`);

    // Find employee by email
    const employee = await EmployeeMerged.findOne({ email: workerUser.email.toLowerCase() }).lean();
    if (!employee) {
      console.log(`❌ No employee found for email: ${workerUser.email}`);
      await mongoose.disconnect();
      return;
    }

    console.log(`👷 Found employee: ${employee.name}`);
    console.log(`   Employee ID: ${employee._id}`);
    console.log(`   Employee email: ${employee.email}`);
    console.log(`   Employee user_id: ${employee.user_id || 'NOT SET'}\n`);

    // Find monthly summaries for this employee
    const summaries = await MonthlySummary.find({
      employee_id: employee._id.toString()
    }).lean();

    console.log(`📊 Found ${summaries.length} monthly summaries for this employee\n`);

    if (summaries.length === 0) {
      console.log('⚠️  No monthly summaries found. Run: npm run generate:monthly-summaries');
      await mongoose.disconnect();
      return;
    }

    // Test lookup for first summary
    const testSummary = summaries[0];
    console.log(`🧪 Testing lookup for summary ID: ${testSummary._id}`);
    console.log(`   Summary employee_id: ${testSummary.employee_id}`);
    console.log(`   Employee _id: ${employee._id}`);
    console.log(`   Match: ${testSummary.employee_id === employee._id.toString()}\n`);

    // Test findById
    const foundSummary = await MonthlySummary.findById(testSummary._id).lean();
    if (foundSummary) {
      console.log('✅ Summary found by ID');
      console.log(`   ID: ${foundSummary._id}`);
      console.log(`   Employee ID: ${foundSummary.employee_id}`);
      console.log(`   Month: ${foundSummary.month}, Year: ${foundSummary.year}`);
    } else {
      console.log('❌ Summary NOT found by ID');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the script
if (require.main === module) {
  testMonthlySummaryLookup()
    .then(() => {
      console.log('\n✅ Test completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test failed:', error);
      process.exit(1);
    });
}

module.exports = testMonthlySummaryLookup;

