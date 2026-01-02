/**
 * Test script to verify monthly summary access
 */

require('dotenv').config();
const env = require('../config/env');
const mongoose = require('mongoose');
const User = require('../models/User');
const EmployeeMerged = require('../models/EmployeeMerged');
const MonthlySummary = require('../models/MonthlySummary');

async function testSummaryAccess() {
  try {
    console.log('🔍 Testing Monthly Summary Access...\n');
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

    console.log(`👤 Worker user: ${workerUser.name} (${workerUser.email})`);
    console.log(`   User ID: ${workerUser._id}\n`);

    // Find employee
    let employee = await EmployeeMerged.findOne({ user_id: workerUser._id.toString() }).lean();
    if (!employee) {
      employee = await EmployeeMerged.findOne({ email: workerUser.email.toLowerCase() }).lean();
    }

    if (!employee) {
      console.log(`❌ No employee found for user`);
      await mongoose.disconnect();
      return;
    }

    console.log(`👷 Employee: ${employee.name}`);
    console.log(`   Employee ID: ${employee._id}\n`);

    // Find monthly summaries
    const summaries = await MonthlySummary.find({
      employee_id: employee._id.toString()
    }).lean();

    console.log(`📊 Found ${summaries.length} monthly summaries\n`);

    if (summaries.length === 0) {
      console.log('⚠️  No summaries found. Run: npm run generate:monthly-summaries 12 2025');
      await mongoose.disconnect();
      return;
    }

    // Test accessing the first summary
    const testSummary = summaries[0];
    console.log(`🧪 Testing access to summary:`);
    console.log(`   Summary ID: ${testSummary._id}`);
    console.log(`   Summary ID (string): ${testSummary._id.toString()}`);
    console.log(`   Employee ID: ${testSummary.employee_id}`);
    console.log(`   Month: ${testSummary.month}, Year: ${testSummary.year}\n`);

    // Try to find by ID
    const foundById = await MonthlySummary.findById(testSummary._id).lean();
    if (foundById) {
      console.log('✅ Summary found by findById');
    } else {
      console.log('❌ Summary NOT found by findById');
    }

    // Try to find by string ID
    const foundByString = await MonthlySummary.findOne({ _id: testSummary._id.toString() }).lean();
    if (foundByString) {
      console.log('✅ Summary found by string ID');
    } else {
      console.log('❌ Summary NOT found by string ID');
    }

    // Show all summary IDs for reference
    console.log('\n📋 All summary IDs in database:');
    const allSummaries = await MonthlySummary.find({}).limit(5).select('_id employee_id month year').lean();
    allSummaries.forEach((s, i) => {
      console.log(`   ${i + 1}. ID: ${s._id.toString()}, Employee: ${s.employee_id}, ${s.month}/${s.year}`);
    });

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
  testSummaryAccess()
    .then(() => {
      console.log('\n✅ Test completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test failed:', error);
      process.exit(1);
    });
}

module.exports = testSummaryAccess;

