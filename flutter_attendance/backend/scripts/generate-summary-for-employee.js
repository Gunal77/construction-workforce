/**
 * Script to generate monthly summary for a specific employee by name
 * Usage: node scripts/generate-summary-for-employee.js <employeeName> [month] [year]
 * Example: node scripts/generate-summary-for-employee.js arickiaraj 1 2026
 */

require('dotenv').config();
const env = require('../config/env');
const mongoose = require('mongoose');
const EmployeeMerged = require('../models/EmployeeMerged');
const User = require('../models/User');
const AttendanceMerged = require('../models/AttendanceMerged');
const Timesheet = require('../models/Timesheet');
const { LeaveRequest } = require('../models/LeaveMerged');
const MonthlySummary = require('../models/MonthlySummary');
const ProjectMerged = require('../models/ProjectMerged');

/**
 * Generate unique invoice number for a given month/year
 */
async function generateInvoiceNumber(month, year) {
  let sequenceNumber = 1;

  const lastInvoice = await MonthlySummary.findOne({
    month: month,
    year: year,
    invoice_number: { $ne: null },
  })
    .sort({ invoice_number: -1 })
    .lean();

  if (lastInvoice && lastInvoice.invoice_number) {
    const match = lastInvoice.invoice_number.match(/INV-\d{4}-\d{2}-(\d+)$/);
    if (match) {
      sequenceNumber = parseInt(match[1], 10) + 1;
    }
  }

  const monthStr = String(month).padStart(2, '0');
  const sequenceStr = String(sequenceNumber).padStart(4, '0');
  return `INV-${year}-${monthStr}-${sequenceStr}`;
}

/**
 * Generate monthly summary for a single employee
 */
async function generateSummaryForEmployee(employeeId, month, year, adminId, taxPercentage = null) {
  // Get employee
  const employee = await EmployeeMerged.findById(employeeId).lean();
  if (!employee) {
    throw new Error('Employee not found');
  }

  // Get employee user by email
  let user = null;
  if (employee.user_id) {
    user = await User.findById(employee.user_id).lean();
  }
  
  if (!user && employee.email) {
    user = await User.findOne({ email: employee.email.toLowerCase() }).lean();
    
    if (user) {
      await EmployeeMerged.updateOne(
        { _id: employee._id },
        { $set: { user_id: user._id.toString() } }
      );
    }
  }

  if (!user) {
    throw new Error('User not found for employee');
  }

  // Calculate date range for the month
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);
  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  // 1. Calculate total working days
  const workingDaysResult = await AttendanceMerged.aggregate([
    {
      $match: {
        user_id: user._id.toString(),
        check_in_time: {
          $gte: startDate,
          $lte: endDate,
        },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format: '%Y-%m-%d',
            date: '$check_in_time',
          },
        },
      },
    },
    {
      $count: 'working_days',
    },
  ]);

  const totalWorkingDays = workingDaysResult[0]?.working_days || 0;

  // 2. Calculate total worked hours and OT hours from timesheets
  const timesheetsResult = await Timesheet.aggregate([
    {
      $match: {
        staff_id: employee._id.toString(),
        work_date: {
          $gte: new Date(startDateStr),
          $lte: new Date(endDateStr),
        },
        approval_status: { $in: ['Draft', 'Submitted', 'Approved'] },
      },
    },
    {
      $group: {
        _id: null,
        total_hours: {
          $sum: {
            $cond: [
              { $ne: ['$total_hours', null] },
              { $toDouble: '$total_hours' },
              0,
            ],
          },
        },
        ot_hours: {
          $sum: {
            $cond: [
              { $ne: ['$overtime_hours', null] },
              { $toDouble: '$overtime_hours' },
              0,
            ],
          },
        },
      },
    },
  ]);

  const totalWorkedHours = timesheetsResult[0]?.total_hours || 0;
  const totalOtHours = timesheetsResult[0]?.ot_hours || 0;

  // 3. Calculate approved leaves
  const leaveResult = await LeaveRequest.aggregate([
    {
      $match: {
        employee_id: employee._id.toString(),
        status: 'approved',
        $or: [
          {
            start_date: {
              $gte: new Date(startDateStr),
              $lte: new Date(endDateStr),
            },
          },
          {
            end_date: {
              $gte: new Date(startDateStr),
              $lte: new Date(endDateStr),
            },
          },
          {
            $and: [
              { start_date: { $lte: new Date(startDateStr) } },
              { end_date: { $gte: new Date(endDateStr) } },
            ],
          },
        ],
      },
    },
    {
      $group: {
        _id: null,
        total_leaves: {
          $sum: {
            $cond: [
              { $ne: ['$number_of_days', null] },
              { $toDouble: '$number_of_days' },
              0,
            ],
          },
        },
      },
    },
  ]);

  const approvedLeaves = leaveResult[0]?.total_leaves || 0;

  // 4. Calculate absent days
  const daysInMonth = endDate.getDate();
  let weekendDays = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      weekendDays++;
    }
  }
  const workingDaysInMonth = daysInMonth - weekendDays;
  const absentDays = Math.max(0, workingDaysInMonth - totalWorkingDays - Math.floor(approvedLeaves));

  // 5. Calculate project-wise breakdown
  const projectBreakdownResult = await Timesheet.aggregate([
    {
      $match: {
        staff_id: employee._id.toString(),
        work_date: {
          $gte: new Date(startDateStr),
          $lte: new Date(endDateStr),
        },
        approval_status: { $in: ['Draft', 'Submitted', 'Approved'] },
      },
    },
    {
      $group: {
        _id: '$project_id',
        days_worked: { $addToSet: '$work_date' },
        total_hours: {
          $sum: {
            $cond: [
              { $ne: ['$total_hours', null] },
              { $toDouble: '$total_hours' },
              0,
            ],
          },
        },
        ot_hours: {
          $sum: {
            $cond: [
              { $ne: ['$overtime_hours', null] },
              { $toDouble: '$overtime_hours' },
              0,
            ],
          },
        },
      },
    },
  ]);

  const projectBreakdown = [];
  for (const proj of projectBreakdownResult) {
    const projectId = proj._id;
    if (projectId) {
      const project = await ProjectMerged.findById(projectId).lean();
      projectBreakdown.push({
        project_id: projectId,
        project_name: project?.name || 'Unassigned',
        days_worked: proj.days_worked?.length || 0,
        total_hours: proj.total_hours || 0,
        ot_hours: proj.ot_hours || 0,
      });
    }
  }

  projectBreakdown.sort((a, b) => b.total_hours - a.total_hours);

  // Calculate subtotal based on payment type
  const paymentType = employee.payment_type || 'hourly';
  let subtotal = 0;

  if (paymentType === 'hourly' && employee.hourly_rate) {
    const hourlyRate = parseFloat(employee.hourly_rate.toString());
    subtotal = (totalWorkedHours * hourlyRate) + (totalOtHours * hourlyRate * 1.5);
  } else if (paymentType === 'daily' && employee.daily_rate) {
    const dailyRate = parseFloat(employee.daily_rate.toString());
    subtotal = totalWorkingDays * dailyRate;
  } else if (paymentType === 'monthly' && employee.monthly_rate) {
    const monthlyRate = parseFloat(employee.monthly_rate.toString());
    const proratedRate = workingDaysInMonth > 0 ? (totalWorkingDays / workingDaysInMonth) * monthlyRate : 0;
    subtotal = proratedRate;
  } else if (paymentType === 'contract' && employee.contract_rate) {
    const contractRate = parseFloat(employee.contract_rate.toString());
    subtotal = contractRate;
  }

  // Calculate tax
  const finalTaxPercentage = taxPercentage !== null && taxPercentage !== undefined 
    ? parseFloat(taxPercentage) 
    : parseFloat(process.env.DEFAULT_TAX_PERCENTAGE || '0');
  const taxAmount = subtotal > 0 ? (subtotal * finalTaxPercentage / 100) : 0;
  const totalAmount = Math.round((subtotal + taxAmount) * 100) / 100;

  // Generate invoice number if subtotal > 0
  let invoiceNumber = null;
  if (subtotal > 0) {
    invoiceNumber = await generateInvoiceNumber(month, year);
  }

  // Create or update monthly summary
  const summaryData = {
    employee_id: employee._id.toString(),
    month: month,
    year: year,
    total_working_days: totalWorkingDays,
    total_worked_hours: mongoose.Types.Decimal128.fromString(totalWorkedHours.toFixed(2)),
    total_ot_hours: mongoose.Types.Decimal128.fromString(totalOtHours.toFixed(2)),
    approved_leaves: approvedLeaves,
    absent_days: absentDays,
    project_breakdown: projectBreakdown,
    payment_type: paymentType,
    subtotal: mongoose.Types.Decimal128.fromString(subtotal.toFixed(2)),
    tax_percentage: finalTaxPercentage,
    tax_amount: mongoose.Types.Decimal128.fromString(taxAmount.toFixed(2)),
    total_amount: mongoose.Types.Decimal128.fromString(totalAmount.toFixed(2)),
    invoice_number: invoiceNumber,
    status: 'DRAFT',
    admin_created_by: adminId,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const summary = await MonthlySummary.findOneAndUpdate(
    {
      employee_id: employee._id.toString(),
      month: month,
      year: year,
    },
    summaryData,
    { upsert: true, new: true, runValidators: false }
  ).lean();

  return summary;
}

async function main() {
  try {
    console.log('🚀 Starting monthly summary generation for employee...\n');

    // Get arguments
    const args = process.argv.slice(2);
    const employeeName = args[0];
    const month = args[1] ? parseInt(args[1]) : new Date().getMonth() + 1;
    const year = args[2] ? parseInt(args[2]) : new Date().getFullYear();

    if (!employeeName) {
      console.error('❌ Error: Employee name is required');
      console.log('\nUsage: node scripts/generate-summary-for-employee.js <employeeName> [month] [year]');
      console.log('Example: node scripts/generate-summary-for-employee.js arickiaraj 1 2026');
      process.exit(1);
    }

    // Connect to MongoDB
    if (mongoose.connection.readyState === 0) {
      console.log('🔌 Connecting to MongoDB...');
      await mongoose.connect(env.mongodbUri);
      console.log('✅ Connected to MongoDB\n');
    }

    // Find employee by name (case-insensitive)
    const employee = await EmployeeMerged.findOne({
      name: { $regex: new RegExp(employeeName, 'i') }
    }).lean();

    if (!employee) {
      console.error(`❌ Error: Employee "${employeeName}" not found`);
      console.log('\n💡 Tip: Try searching with a partial name or check the exact spelling');
      await mongoose.disconnect();
      process.exit(1);
    }

    console.log(`✅ Found employee: ${employee.name} (${employee.email || 'No email'})`);
    console.log(`📅 Generating summary for: ${getMonthName(month)} ${year}\n`);

    // Get admin user
    const adminUser = await User.findOne({ role: 'ADMIN' }).lean();
    const adminId = adminUser?._id?.toString() || null;

    // Check if summary already exists and is approved
    const existing = await MonthlySummary.findOne({
      employee_id: employee._id.toString(),
      month: month,
      year: year,
    }).lean();

    if (existing && existing.status === 'APPROVED') {
      console.log('⚠️  Summary already exists and is APPROVED. Cannot regenerate.');
      console.log(`   Summary ID: ${existing._id}`);
      await mongoose.disconnect();
      process.exit(0);
    }

    // Generate summary
    console.log('📊 Generating summary...');
    const summary = await generateSummaryForEmployee(
      employee._id.toString(),
      month,
      year,
      adminId
    );

    console.log('\n✅ Monthly summary generated successfully!');
    console.log(`\n📋 Summary Details:`);
    console.log(`   Employee: ${employee.name}`);
    console.log(`   Month/Year: ${getMonthName(month)} ${year}`);
    console.log(`   Working Days: ${summary.total_working_days}`);
    console.log(`   Worked Hours: ${parseFloat(summary.total_worked_hours.toString()).toFixed(2)}`);
    console.log(`   OT Hours: ${parseFloat(summary.total_ot_hours.toString()).toFixed(2)}`);
    console.log(`   Approved Leaves: ${summary.approved_leaves}`);
    console.log(`   Absent Days: ${summary.absent_days}`);
    console.log(`   Status: ${summary.status}`);
    if (summary.invoice_number) {
      console.log(`   Invoice Number: ${summary.invoice_number}`);
    }
    if (summary.total_amount) {
      console.log(`   Total Amount: $${parseFloat(summary.total_amount.toString()).toFixed(2)}`);
    }
    console.log(`   Summary ID: ${summary._id}\n`);

    await mongoose.disconnect();
    console.log('✅ Done!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

function getMonthName(month) {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[month - 1] || `Month ${month}`;
}

main();


