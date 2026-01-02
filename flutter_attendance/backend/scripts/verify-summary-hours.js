require('dotenv').config();
const mongoose = require('mongoose');
const env = require('../config/env');
const MonthlySummary = require('../models/MonthlySummary');
const EmployeeMerged = require('../models/EmployeeMerged');

async function verifySummaryHours() {
  try {
    await mongoose.connect(env.mongodbUri);
    console.log('✅ Connected to MongoDB\n');

    const summaries = await MonthlySummary.find({ month: 12, year: 2025 })
      .sort({ total_worked_hours: -1 })
      .limit(10)
      .lean();

    console.log('📊 Top 10 summaries by total hours:\n');
    
    for (const summary of summaries) {
      const employee = await EmployeeMerged.findById(summary.employee_id).lean();
      const totalHours = summary.total_worked_hours ? parseFloat(summary.total_worked_hours.toString()) : 0;
      const otHours = summary.total_ot_hours ? parseFloat(summary.total_ot_hours.toString()) : 0;
      
      console.log(`${employee?.name || 'Unknown'}: ${totalHours.toFixed(2)}h worked, ${otHours.toFixed(2)}h OT`);
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

verifySummaryHours();

