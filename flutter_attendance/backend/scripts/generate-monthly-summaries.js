/**
 * Script to generate monthly summaries for all employees
 * Supports MongoDB
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

async function generateMonthlySummaries() {
  try {
    console.log('🚀 Starting monthly summary generation...\n');
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

    // Get month and year from command line args or use current month
    const args = process.argv.slice(2);
    const month = args[0] ? parseInt(args[0]) : new Date().getMonth() + 1; // 1-12
    const year = args[1] ? parseInt(args[1]) : new Date().getFullYear();

    console.log(`📅 Generating summaries for: ${getMonthName(month)} ${year}\n`);

    // Get all active employees
    const employees = await EmployeeMerged.find({}).lean();
    console.log(`👥 Found ${employees.length} employees\n`);

    if (employees.length === 0) {
      console.log('⚠️  No employees found. Please create employees first.');
      await mongoose.disconnect();
      return;
    }

    // Get admin user for admin_created_by
    const adminUser = await User.findOne({ role: 'ADMIN' }).lean();
    const adminId = adminUser?._id?.toString() || null;

    if (!adminId) {
      console.log('⚠️  No admin user found. Using null for admin_created_by.');
    }

    let successCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // Generate summary for each employee
    for (const employee of employees) {
      try {
        // Check if summary already exists
        const existing = await MonthlySummary.findOne({
          employee_id: employee._id.toString(),
          month: month,
          year: year,
        }).lean();

        if (existing && existing.status === 'APPROVED') {
          console.log(`   ⏭️  Skipped ${employee.name}: Summary already approved`);
          skippedCount++;
          continue;
        }

        // Get employee user by email (since user_id might not be set)
        let user = null;
        if (employee.user_id) {
          user = await User.findById(employee.user_id).lean();
        }
        
        // If no user found by ID, try finding by email
        if (!user && employee.email) {
          user = await User.findOne({ email: employee.email.toLowerCase() }).lean();
          
          // Update employee with user_id if found
          if (user) {
            await EmployeeMerged.updateOne(
              { _id: employee._id },
              { $set: { user_id: user._id.toString() } }
            );
          }
        }

        if (!user) {
          console.log(`   ⚠️  Skipped ${employee.name}: No user found (email: ${employee.email || 'N/A'})`);
          skippedCount++;
          continue;
        }

        // Calculate date range for the month
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59);
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];

        // 1. Calculate total working days (days with check-in)
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
        // Include all timesheets (Draft, Submitted, Approved) to match timesheet page totals
        const timesheetsResult = await Timesheet.aggregate([
          {
            $match: {
              staff_id: employee._id.toString(),
              work_date: {
                $gte: new Date(startDateStr),
                $lte: new Date(endDateStr),
              },
              // Include all statuses: Draft, Submitted, Approved
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
              // Include OT hours from all timesheets (not just approved OT)
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
              // Include all statuses: Draft, Submitted, Approved
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
              // Include all OT hours (not just approved OT)
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

        // Get project names
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

        // Sort by total_hours descending
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
        const taxPercentage = parseFloat(process.env.DEFAULT_TAX_PERCENTAGE || '0');
        const taxAmount = subtotal > 0 ? (subtotal * taxPercentage / 100) : 0;
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
          tax_percentage: taxPercentage,
          tax_amount: mongoose.Types.Decimal128.fromString(taxAmount.toFixed(2)),
          total_amount: mongoose.Types.Decimal128.fromString(totalAmount.toFixed(2)),
          invoice_number: invoiceNumber,
          status: 'DRAFT',
          admin_created_by: adminId,
          created_at: new Date(),
          updated_at: new Date(),
        };

        await MonthlySummary.findOneAndUpdate(
          {
            employee_id: employee._id.toString(),
            month: month,
            year: year,
          },
          summaryData,
          { upsert: true, new: true }
        );

        console.log(`   ✅ Generated summary for ${employee.name}: ${totalWorkedHours.toFixed(2)}h worked, ${totalOtHours.toFixed(2)}h OT`);
        successCount++;
      } catch (error) {
        console.error(`   ❌ Error generating summary for ${employee.name}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n📊 Summary:');
    console.log(`   ✅ Successfully generated: ${successCount}`);
    console.log(`   ⏭️  Skipped: ${skippedCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);

  } catch (error) {
    console.error('❌ Error generating monthly summaries:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

function getMonthName(month) {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[month - 1];
}

async function generateInvoiceNumber(month, year) {
  // Format: INV-YYYYMM-XXX (e.g., INV-202412-001)
  const prefix = `INV-${year}${String(month).padStart(2, '0')}`;
  
  // Find the highest invoice number with this prefix
  const lastInvoice = await MonthlySummary.findOne({
    invoice_number: { $regex: `^${prefix}-` }
  })
    .sort({ invoice_number: -1 })
    .lean();

  let sequence = 1;
  if (lastInvoice && lastInvoice.invoice_number) {
    const lastSeq = parseInt(lastInvoice.invoice_number.split('-')[2] || '0');
    sequence = lastSeq + 1;
  }

  return `${prefix}-${String(sequence).padStart(3, '0')}`;
}

// Run the script
if (require.main === module) {
  generateMonthlySummaries()
    .then(() => {
      console.log('\n✅ Script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = generateMonthlySummaries;

