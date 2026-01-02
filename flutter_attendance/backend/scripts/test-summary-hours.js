require('dotenv').config();
const mongoose = require('mongoose');
const env = require('../config/env');
const MonthlySummary = require('../models/MonthlySummary');
const EmployeeMerged = require('../models/EmployeeMerged');

async function testSummaryHours() {
  try {
    await mongoose.connect(env.mongodbUri);
    console.log('✅ Connected to MongoDB\n');

    // Get a sample summary
    const summary = await MonthlySummary.findOne({ month: 12, year: 2025 }).lean();
    
    if (!summary) {
      console.log('❌ No summary found');
      await mongoose.disconnect();
      return;
    }

    console.log('📊 Raw Summary Data:');
    console.log('ID:', summary._id.toString());
    console.log('total_worked_hours (raw):', summary.total_worked_hours);
    console.log('total_worked_hours type:', typeof summary.total_worked_hours);
    console.log('total_worked_hours constructor:', summary.total_worked_hours?.constructor?.name);
    console.log('total_ot_hours (raw):', summary.total_ot_hours);
    console.log('total_ot_hours type:', typeof summary.total_ot_hours);
    console.log('total_ot_hours constructor:', summary.total_ot_hours?.constructor?.name);
    console.log('');

    // Test conversion
    let totalHours = 0;
    let otHours = 0;

    if (summary.total_worked_hours !== null && summary.total_worked_hours !== undefined) {
      if (summary.total_worked_hours.toString) {
        totalHours = parseFloat(summary.total_worked_hours.toString());
      } else {
        totalHours = parseFloat(summary.total_worked_hours);
      }
    }

    if (summary.total_ot_hours !== null && summary.total_ot_hours !== undefined) {
      if (summary.total_ot_hours.toString) {
        otHours = parseFloat(summary.total_ot_hours.toString());
      } else {
        otHours = parseFloat(summary.total_ot_hours);
      }
    }

    console.log('📊 Converted Values:');
    console.log('total_worked_hours (converted):', totalHours);
    console.log('total_ot_hours (converted):', otHours);
    console.log('');

    // Get employee name
    const employee = await EmployeeMerged.findById(summary.employee_id).lean();
    console.log('👤 Employee:', employee?.name || 'Unknown');
    console.log('');

    // Test the actual format that would be sent
    const formatted = {
      id: summary._id.toString(),
      employee_id: summary.employee_id,
      month: summary.month,
      year: summary.year,
      total_worked_hours: totalHours,
      total_ot_hours: otHours,
      employee_name: employee?.name || 'Unknown',
      employee_email: employee?.email || null,
    };

    console.log('📤 Formatted for API Response:');
    console.log(JSON.stringify(formatted, null, 2));

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testSummaryHours();

