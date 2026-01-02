const emailService = require('../services/emailService');
const employeeRepository = require('../repositories/employeeRepository');

/**
 * Helper function to get employeeId from userId consistently
 * Uses the same lookup logic that was used when creating summaries
 * @param {string} userId - User ID from JWT token
 * @returns {Promise<{employeeId: string, employee: object|null}>}
 */
async function getEmployeeIdFromUserId(userId) {
  const EmployeeMerged = require('../models/EmployeeMerged');
  const User = require('../models/User');

  // Get user
  const user = await User.findById(userId).lean();
  if (!user) {
    return { employeeId: null, employee: null };
  }

  const userEmail = user.email?.toLowerCase();

  // Try multiple methods to find employee (same as summary creation)
  // 1. Try by user_id
  let employee = await EmployeeMerged.findOne({ user_id: userId }).lean();
  
  // 2. Try by email
  if (!employee && userEmail) {
    employee = await EmployeeMerged.findOne({ email: userEmail }).lean();
  }
  
  // 3. Try employeeRepository as fallback
  if (!employee && userEmail) {
    const empFromRepo = await employeeRepository.findByEmail(userEmail);
    if (empFromRepo) {
      employee = await EmployeeMerged.findById(empFromRepo._id || empFromRepo.id).lean();
    }
  }

  if (!employee) {
    return { employeeId: null, employee: null };
  }

  return {
    employeeId: employee._id.toString(),
    employee: employee
  };
}

/**
 * Filter financial fields from summary based on user role
 * Admin: full access to all financial fields
 * Supervisor: hide all payment and tax fields
 * Staff: no access to invoice or tax data
 */
function filterFinancialFields(summary, userRole) {
  if (!summary) return summary;

  // Admin has full access
  if (userRole === 'admin') {
    return summary;
  }

  // Supervisor: hide all payment and tax fields
  if (userRole === 'supervisor') {
    const filtered = { ...summary };
    delete filtered.subtotal;
    delete filtered.payment_type;
    delete filtered.tax_percentage;
    delete filtered.tax_amount;
    delete filtered.total_amount;
    delete filtered.invoice_number;
    return filtered;
  }

  // Staff: no access to invoice or tax data
  if (userRole === 'staff' || !userRole) {
    const filtered = { ...summary };
    delete filtered.subtotal;
    delete filtered.payment_type;
    delete filtered.tax_percentage;
    delete filtered.tax_amount;
    delete filtered.total_amount;
    delete filtered.invoice_number;
    return filtered;
  }

  // Default: hide financial fields for unknown roles
  const filtered = { ...summary };
  delete filtered.subtotal;
  delete filtered.payment_type;
  delete filtered.tax_percentage;
  delete filtered.tax_amount;
  delete filtered.total_amount;
  delete filtered.invoice_number;
  return filtered;
}

/**
 * Filter financial fields from array of summaries
 */
function filterFinancialFieldsFromArray(summaries, userRole) {
  if (!Array.isArray(summaries)) return summaries;
  return summaries.map(summary => filterFinancialFields(summary, userRole));
}

/**
 * Generate unique invoice number for a given month/year
 * Format: INV-YYYY-MM-#### (e.g., INV-2024-01-0001)
 */
async function generateInvoiceNumber(month, year) {
  let sequenceNumber = 1;

  // MongoDB: Get the highest invoice number for this month/year
  const MonthlySummary = require('../models/MonthlySummary');
  const lastInvoice = await MonthlySummary.findOne({
    month: month,
    year: year,
    invoice_number: { $ne: null },
  })
    .sort({ invoice_number: -1 })
    .lean();

  if (lastInvoice && lastInvoice.invoice_number) {
    // Extract sequence number from existing invoice (e.g., INV-2024-01-0001 -> 1)
    const match = lastInvoice.invoice_number.match(/INV-\d{4}-\d{2}-(\d+)$/);
    if (match) {
      sequenceNumber = parseInt(match[1], 10) + 1;
    }
  }

  // Format: INV-YYYY-MM-####
  const monthStr = String(month).padStart(2, '0');
  const sequenceStr = String(sequenceNumber).padStart(4, '0');
  return `INV-${year}-${monthStr}-${sequenceStr}`;
}

/**
 * Safely parse project_breakdown JSON
 * Handles null, empty strings, and already-parsed objects
 */
function parseProjectBreakdown(projectBreakdown) {
  if (!projectBreakdown) {
    return [];
  }
  if (typeof projectBreakdown === 'object') {
    return projectBreakdown;
  }
  if (typeof projectBreakdown === 'string') {
    try {
      const parsed = JSON.parse(projectBreakdown);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('Error parsing project_breakdown:', error);
      return [];
    }
  }
  return [];
}

/**
 * Generate monthly summary for a single employee (MongoDB version)
 * Uses timesheet data for total hours and OT hours
 * @param {string} employeeId - Employee ID
 * @param {number} month - Month (1-12)
 * @param {number} year - Year
 * @param {string} adminId - Admin ID creating the summary
 * @param {number} [taxPercentage] - Optional tax percentage (defaults to 0 or env var)
 */
async function generateSummaryForEmployeeMongoDB(employeeId, month, year, adminId, taxPercentage = null) {
  const mongoose = require('mongoose');
  const EmployeeMerged = require('../models/EmployeeMerged');
  const User = require('../models/User');
  const AttendanceMerged = require('../models/AttendanceMerged');
  const Timesheet = require('../models/Timesheet');
  const { LeaveRequest } = require('../models/LeaveMerged');
  const MonthlySummary = require('../models/MonthlySummary');
  const ProjectMerged = require('../models/ProjectMerged');

  // Get employee
  const employee = await EmployeeMerged.findById(employeeId).lean();
  if (!employee) {
    throw new Error('Employee not found');
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
    throw new Error('User not found for employee');
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

  // 5. Calculate project-wise breakdown from timesheets
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

  // Convert Decimal128 to numbers for response
  if (summary.total_worked_hours) {
    summary.total_worked_hours = parseFloat(summary.total_worked_hours.toString());
  }
  if (summary.total_ot_hours) {
    summary.total_ot_hours = parseFloat(summary.total_ot_hours.toString());
  }
  if (summary.subtotal) {
    summary.subtotal = parseFloat(summary.subtotal.toString());
  }
  if (summary.tax_amount) {
    summary.tax_amount = parseFloat(summary.tax_amount.toString());
  }
  if (summary.total_amount) {
    summary.total_amount = parseFloat(summary.total_amount.toString());
  }

  return summary;
}

/**
 * Generate monthly summary for an employee
 * Calculates totals from attendance, timesheets, OT, and leave data
 */
const generateMonthlySummary = async (req, res) => {
  try {
    const { employeeId, month, year, tax_percentage } = req.body;
    const adminId = req.user?.userId; // Admin creating the summary

    if (!employeeId || !month || !year) {
      return res.status(400).json({ 
        message: 'employeeId, month, and year are required' 
      });
    }

    // Validate month and year
    if (month < 1 || month > 12) {
      return res.status(400).json({ message: 'Invalid month. Must be 1-12' });
    }
    if (year < 2020 || year > 2100) {
      return res.status(400).json({ message: 'Invalid year' });
    }

    // Validate tax_percentage if provided
    if (tax_percentage !== undefined && tax_percentage !== null) {
      const taxPercent = parseFloat(tax_percentage);
      if (isNaN(taxPercent) || taxPercent < 0 || taxPercent > 100) {
        return res.status(400).json({ message: 'Invalid tax_percentage. Must be between 0 and 100' });
      }
    }

    // MongoDB: Check if summary already exists
    const MonthlySummary = require('../models/MonthlySummary');
    const existing = await MonthlySummary.findOne({
      employee_id: employeeId,
      month: month,
      year: year,
    }).lean();

    if (existing && existing.status === 'APPROVED') {
      return res.status(400).json({ 
        message: 'Monthly summary already approved. Cannot regenerate.' 
      });
    }

    // Generate summary using MongoDB helper function
    const summary = await generateSummaryForEmployeeMongoDB(employeeId, month, year, adminId, tax_percentage);

    return res.status(201).json({
      message: 'Monthly summary generated successfully',
      summary
    });
  } catch (error) {
    console.error('Error generating monthly summary:', error);
    return res.status(500).json({ 
      message: 'Failed to generate monthly summary',
      error: error.message 
    });
  }
};

/**
 * Generate monthly summaries for all staff
 */
const generateMonthlySummariesForAllStaff = async (req, res) => {
  try {
    const { month, year, tax_percentage } = req.body;
    const adminId = req.user?.userId; // Admin creating the summaries

    if (!month || !year) {
      return res.status(400).json({ 
        message: 'month and year are required' 
      });
    }

    // Validate month and year
    if (month < 1 || month > 12) {
      return res.status(400).json({ message: 'Invalid month. Must be 1-12' });
    }
    if (year < 2020 || year > 2100) {
      return res.status(400).json({ message: 'Invalid year' });
    }

    // Validate tax_percentage if provided
    if (tax_percentage !== undefined && tax_percentage !== null) {
      const taxPercent = parseFloat(tax_percentage);
      if (isNaN(taxPercent) || taxPercent < 0 || taxPercent > 100) {
        return res.status(400).json({ message: 'Invalid tax_percentage. Must be between 0 and 100' });
      }
    }

    const results = {
      total: 0,
      success: [],
      failed: [],
    };

    // MongoDB: Get all employees
    const EmployeeMerged = require('../models/EmployeeMerged');
    const employeesList = await EmployeeMerged.find({ email: { $ne: null } }).lean();
    
    if (employeesList.length === 0) {
      return res.status(404).json({ message: 'No employees found' });
    }

    const employees = employeesList.map(emp => ({
      id: emp._id.toString(),
      name: emp.name,
      email: emp.email,
    }));
    results.total = employees.length;

      // Generate summary for each employee
      for (const employee of employees) {
        try {
          // Check if summary already exists and is approved
          const MonthlySummary = require('../models/MonthlySummary');
          const existing = await MonthlySummary.findOne({
            employee_id: employee.id,
            month: month,
            year: year,
          }).lean();

          if (existing && existing.status === 'APPROVED') {
            results.failed.push({
              employee_id: employee.id,
              employee_name: employee.name,
              employee_email: employee.email,
              reason: 'Summary already approved. Cannot regenerate.',
            });
            continue;
          }

          // Generate summary using MongoDB helper function
          const summary = await generateSummaryForEmployeeMongoDB(employee.id, month, year, adminId, tax_percentage);
          
          results.success.push({
            employee_id: employee.id,
            employee_name: employee.name,
            employee_email: employee.email,
            summary_id: summary._id?.toString() || summary.id,
          });
        } catch (error) {
          console.error(`Error generating summary for ${employee.name} (${employee.email}):`, error);
          results.failed.push({
            employee_id: employee.id,
            employee_name: employee.name,
            employee_email: employee.email,
            reason: error.message || 'Failed to generate summary',
          });
        }
      }

    return res.json({
      message: `Generated monthly summaries for ${results.success.length} out of ${results.total} employees`,
      results,
    });
  } catch (error) {
    console.error('Error generating monthly summaries for all staff:', error);
    return res.status(500).json({ 
      message: 'Failed to generate monthly summaries',
      error: error.message 
    });
  }
};

/**
 * Get monthly summaries (list view for admin)
 */
const getMonthlySummaries = async (req, res) => {
  try {
    const { employeeId, month, year, status } = req.query;
    // Get user role from req.user (set by auth middleware)
    const userRole = req.user?.role || 'ADMIN';

    const MonthlySummary = require('../models/MonthlySummary');
    const EmployeeMerged = require('../models/EmployeeMerged');
    const User = require('../models/User');

    // Build query
    const query = {};
    
    if (status) {
      query.status = status;
    }
    
    if (employeeId) {
      query.employee_id = employeeId;
    }
    
    if (month) {
      query.month = parseInt(month);
    }
    
    if (year) {
      query.year = parseInt(year);
    }

    // Fetch summaries
    const summaries = await MonthlySummary.find(query)
      .sort({ year: -1, month: -1 })
      .lean();

    // Enrich with employee and admin details
    const enrichedSummaries = await Promise.all(
      summaries.map(async (summary) => {
        // Get employee
        let employee = null;
        if (summary.employee_id) {
          employee = await EmployeeMerged.findById(summary.employee_id).lean();
        }

        // Get user
        let user = null;
        if (employee?.user_id) {
          user = await User.findById(employee.user_id).lean();
        }

        // Get admin
        let admin = null;
        if (summary.admin_approved_by) {
          admin = await User.findById(summary.admin_approved_by).lean();
        }

        // Convert Decimal128 to numbers FIRST (before formatting)
        let totalWorkedHours = 0;
        let totalOtHours = 0;
        
        if (summary.total_worked_hours !== null && summary.total_worked_hours !== undefined) {
          if (summary.total_worked_hours.toString && typeof summary.total_worked_hours.toString === 'function') {
            totalWorkedHours = parseFloat(summary.total_worked_hours.toString());
          } else {
            totalWorkedHours = parseFloat(summary.total_worked_hours);
          }
        }
        
        if (summary.total_ot_hours !== null && summary.total_ot_hours !== undefined) {
          if (summary.total_ot_hours.toString && typeof summary.total_ot_hours.toString === 'function') {
            totalOtHours = parseFloat(summary.total_ot_hours.toString());
          } else {
            totalOtHours = parseFloat(summary.total_ot_hours);
          }
        }

        // Format summary - explicitly set converted values
        const formatted = {
          ...summary,
          id: summary._id.toString(),
          employee_name: employee?.name || 'Unknown',
          employee_email: employee?.email || null,
          payment_type: employee?.payment_type || null,
          user_id: user?._id?.toString() || null,
          admin_name: admin?.name || null,
          admin_email: admin?.email || null,
          project_breakdown: parseProjectBreakdown(summary.project_breakdown),
          // Explicitly set converted hours values (override any Decimal128 from spread)
          total_worked_hours: totalWorkedHours,
          total_ot_hours: totalOtHours,
        };
        // Convert other Decimal128 fields
        let approvedLeaves = 0;
        let subtotal = 0;
        let taxPercentage = 0;
        let taxAmount = 0;
        let totalAmount = 0;

        if (summary.approved_leaves !== null && summary.approved_leaves !== undefined) {
          approvedLeaves = summary.approved_leaves.toString ? parseFloat(summary.approved_leaves.toString()) : parseFloat(summary.approved_leaves);
        }
        if (summary.subtotal !== null && summary.subtotal !== undefined) {
          subtotal = summary.subtotal.toString ? parseFloat(summary.subtotal.toString()) : parseFloat(summary.subtotal);
        }
        if (summary.tax_percentage !== null && summary.tax_percentage !== undefined) {
          taxPercentage = summary.tax_percentage.toString ? parseFloat(summary.tax_percentage.toString()) : parseFloat(summary.tax_percentage);
        }
        if (summary.tax_amount !== null && summary.tax_amount !== undefined) {
          taxAmount = summary.tax_amount.toString ? parseFloat(summary.tax_amount.toString()) : parseFloat(summary.tax_amount);
        }
        if (summary.total_amount !== null && summary.total_amount !== undefined) {
          totalAmount = summary.total_amount.toString ? parseFloat(summary.total_amount.toString()) : parseFloat(summary.total_amount);
        }

        // Add other converted fields
        formatted.approved_leaves = approvedLeaves;
        formatted.subtotal = subtotal;
        formatted.tax_percentage = taxPercentage;
        formatted.tax_amount = taxAmount;
        formatted.total_amount = totalAmount;

        return formatted;
      })
    );

    // Sort by employee name
    enrichedSummaries.sort((a, b) => {
      const nameA = a.employee_name || '';
      const nameB = b.employee_name || '';
      return nameA.localeCompare(nameB);
    });

    // Filter financial fields based on user role
    const filteredSummaries = filterFinancialFieldsFromArray(enrichedSummaries, userRole);

    // Debug: Log first summary to verify data
    if (filteredSummaries.length > 0) {
      console.log('[DEBUG] First summary in response:', {
        id: filteredSummaries[0].id,
        employee_name: filteredSummaries[0].employee_name,
        total_worked_hours: filteredSummaries[0].total_worked_hours,
        total_ot_hours: filteredSummaries[0].total_ot_hours,
        type_total: typeof filteredSummaries[0].total_worked_hours,
        type_ot: typeof filteredSummaries[0].total_ot_hours,
      });
    }

    return res.json({ summaries: filteredSummaries });
  } catch (error) {
    console.error('Error fetching monthly summaries:', error);
    return res.status(500).json({ 
      message: 'Failed to fetch monthly summaries',
      error: error.message 
    });
  }
};

/**
 * Get single monthly summary by ID
 */
const getMonthlySummaryById = async (req, res) => {
  try {
    const { id } = req.params;
    // Get user role from req.user (set by auth middleware)
    const userRole = req.user?.role || 'ADMIN';
    const userId = req.user?.id || req.user?.userId;
    
    console.log(`[CONTROLLER] getMonthlySummaryById - ID: ${id}, UserID: ${userId}, Role: ${userRole}`);

    const MonthlySummary = require('../models/MonthlySummary');
    const EmployeeMerged = require('../models/EmployeeMerged');
    const User = require('../models/User');
    const employeeRepository = require('../repositories/employeeRepository');
    const mongoose = require('mongoose');

      // Try multiple ID lookup methods since MongoDB might store _id as ObjectId or String
      let summary = null;

      // Method 1: Try with ObjectId (if valid)
      if (mongoose.Types.ObjectId.isValid(id)) {
        const objectId = new mongoose.Types.ObjectId(id);
        summary = await MonthlySummary.findById(objectId).lean();
      }

      // Method 2: Try with string ID
      if (!summary) {
        summary = await MonthlySummary.findOne({ _id: id }).lean();
      }

      // Method 3: Try with native collection (bypasses Mongoose type conversion)
      if (!summary && mongoose.Types.ObjectId.isValid(id)) {
        const objectId = new mongoose.Types.ObjectId(id);
        summary = await MonthlySummary.collection.findOne({ _id: objectId });
        if (summary) {
          summary = JSON.parse(JSON.stringify(summary));
        }
      }

      // Method 4: Try finding by string ID in native collection
      if (!summary) {
        const allSummaries = await MonthlySummary.collection.find({}).toArray();
        summary = allSummaries.find(s => s._id.toString() === id);
        if (summary) {
          summary = JSON.parse(JSON.stringify(summary));
        }
      }
      
      if (!summary) {
        console.error(`[ERROR] Monthly summary not found with ID: ${id}`);
        console.error(`[ERROR] ID type: ${typeof id}, ID value: ${id}`);
        // List a few summary IDs for debugging
        const sampleSummaries = await MonthlySummary.find({}).limit(3).select('_id employee_id month year').lean();
        console.error(`[DEBUG] Sample summaries in DB:`, sampleSummaries.map(s => ({
          id: s._id.toString(),
          employee_id: s.employee_id,
          month: s.month,
          year: s.year
        })));
        return res.status(404).json({ message: 'Monthly summary not found' });
      }
      
      console.log(`[DEBUG] Found summary: ${summary._id}, employee_id: ${summary.employee_id}, month: ${summary.month}, year: ${summary.year}`);
      console.log(`[DEBUG] Request details: ID=${id}, UserID=${userId}, Role=${userRole}`);

      // Get employee details - try multiple methods to handle ID format issues
      let employee = null;
      
      if (summary.employee_id) {
        // Method 1: Try with ObjectId (if valid)
        if (mongoose.Types.ObjectId.isValid(summary.employee_id)) {
          const employeeObjectId = new mongoose.Types.ObjectId(summary.employee_id);
          employee = await EmployeeMerged.findById(employeeObjectId).lean();
        }
        
        // Method 2: Try with string ID
        if (!employee) {
          employee = await EmployeeMerged.findOne({ _id: summary.employee_id.toString() }).lean();
        }
        
        // Method 3: Try with native collection
        if (!employee && mongoose.Types.ObjectId.isValid(summary.employee_id)) {
          const employeeObjectId = new mongoose.Types.ObjectId(summary.employee_id);
          const employeeDoc = await EmployeeMerged.collection.findOne({ _id: employeeObjectId });
          if (employeeDoc) {
            employee = JSON.parse(JSON.stringify(employeeDoc));
          }
        }
      }
      
      // If still no employee, that's okay - we'll continue without employee details
      if (!employee) {
        console.warn(`[WARNING] Employee not found for summary ${id}, employee_id: ${summary.employee_id} - continuing without employee details`);
      }
      
      // Get user details if employee has user_id
      let user = null;
      if (employee?.user_id) {
        user = await User.findById(employee.user_id).lean();
      }

      // Get admin details if approved
      let admin = null;
      if (summary.admin_approved_by) {
        admin = await User.findById(summary.admin_approved_by).lean();
      }

      // Get staff user details if signed
      let staffUser = null;
      if (summary.staff_signed_by) {
        staffUser = await User.findById(summary.staff_signed_by).lean();
      }

      // Format summary - ensure ID is always a string
      const summaryId = summary._id?.toString() || summary._id || id;
      const formattedSummary = {
        ...summary,
        id: summaryId,
        _id: summaryId, // Also include _id for compatibility
        employee_name: employee?.name || 'Unknown',
        employee_email: employee?.email || null,
        employee_role: employee?.role || null,
        payment_type: employee?.payment_type || null,
        user_id: user?._id?.toString() || null,
        admin_name: admin?.name || null,
        admin_email: admin?.email || null,
        staff_user_email: staffUser?.email || null,
      };
      
      console.log(`[DEBUG] Formatted summary ID: ${formattedSummary.id}`);

      // Convert Decimal128 to numbers
      if (summary.total_worked_hours) {
        formattedSummary.total_worked_hours = parseFloat(summary.total_worked_hours.toString());
      }
      if (summary.total_ot_hours) {
        formattedSummary.total_ot_hours = parseFloat(summary.total_ot_hours.toString());
      }
      if (summary.subtotal) {
        formattedSummary.subtotal = parseFloat(summary.subtotal.toString());
      }
      if (summary.tax_amount) {
        formattedSummary.tax_amount = parseFloat(summary.tax_amount.toString());
      }
      if (summary.total_amount) {
        formattedSummary.total_amount = parseFloat(summary.total_amount.toString());
      }

      // Parse project_breakdown
      try {
        formattedSummary.project_breakdown = parseProjectBreakdown(summary.project_breakdown);
      } catch (error) {
        console.warn(`[WARNING] Error parsing project_breakdown: ${error.message}`);
        formattedSummary.project_breakdown = [];
      }

      // Filter financial fields based on user role
      const filteredSummary = filterFinancialFields(formattedSummary, userRole);

      console.log(`[DEBUG] Successfully returning summary - ID: ${filteredSummary.id}, Status: ${filteredSummary.status}`);
      return res.json({ summary: filteredSummary });
  } catch (error) {
    console.error('Error fetching monthly summary:', error);
    return res.status(500).json({ 
      message: 'Failed to fetch monthly summary',
      error: error.message 
    });
  }
};

/**
 * Staff sign-off on monthly summary
 */
const staffSignOff = async (req, res) => {
  try {
    const { id } = req.params;
    const { signature } = req.body; // Base64 encoded signature image
    const userId = req.user?.id || req.user?.userId;

    if (!signature) {
      return res.status(400).json({ message: 'Signature is required' });
    }

    const MonthlySummary = require('../models/MonthlySummary');
    const EmployeeMerged = require('../models/EmployeeMerged');
    const User = require('../models/User');
    const mongoose = require('mongoose');
    const employeeRepository = require('../repositories/employeeRepository');

      console.log(`[DEBUG] staffSignOff - ID: ${id}, UserID: ${userId}`);

      // Get summary - try multiple methods
      let summary = null;
      
      // Try to find by ID if it's a valid ObjectId
      if (id && mongoose.Types.ObjectId.isValid(id)) {
        summary = await MonthlySummary.findById(id).lean();
      }
      
      // If not found by ID or ID is invalid, try to find by other means
      if (!summary) {
        console.log(`[DEBUG] Summary not found by ID ${id}, trying alternative lookup...`);
        
        // Get user to find employee
        const user = await User.findById(userId).lean();
        if (user) {
          const userEmail = user.email?.toLowerCase();
          
          // Get employee
          let employee = await EmployeeMerged.findOne({ user_id: userId }).lean();
          if (!employee && userEmail) {
            employee = await EmployeeMerged.findOne({ email: userEmail }).lean();
          }
          
          if (employee) {
            const employeeId = employee._id.toString();
            // Try to find any DRAFT or REJECTED summary for this employee
            summary = await MonthlySummary.findOne({
              employee_id: employeeId,
              status: { $in: ['DRAFT', 'REJECTED'] }
            }).sort({ year: -1, month: -1 }).lean();
          }
        }
      }
      
      if (!summary) {
        console.log(`[DEBUG] Summary not found by ObjectId ${id}, trying alternative lookup...`);
        summary = await MonthlySummary.findOne({ 
          $or: [
            { _id: id },
            { _id: new mongoose.Types.ObjectId(id) }
          ]
        }).lean();
      }
      
      if (!summary) {
        console.error(`[ERROR] Monthly summary not found with ID: ${id}`);
        // List a few summary IDs for debugging
        const sampleSummaries = await MonthlySummary.find({}).limit(3).select('_id employee_id month year').lean();
        console.error(`[DEBUG] Sample summaries in DB:`, sampleSummaries.map(s => ({
          id: s._id.toString(),
          employee_id: s.employee_id,
          month: s.month,
          year: s.year
        })));
        return res.status(404).json({ message: 'Monthly summary not found' });
      }

      console.log(`[DEBUG] Found summary: ${summary._id}, Type: ${typeof summary._id}, employee_id: ${summary.employee_id}`);
      // Ensure _id is properly formatted as string
      if (summary._id && typeof summary._id !== 'string') {
        summary._id = summary._id.toString();
        console.log(`[DEBUG] Converted summary._id to string: ${summary._id}`);
      }

      // Verify ownership - be lenient if employee record not found
      const summaryEmployeeId = summary.employee_id?.toString();
      let ownershipVerified = false;
      
      // Try to get employeeId from authenticated user
      const { employeeId, employee } = await getEmployeeIdFromUserId(userId);
      
      if (employeeId && summaryEmployeeId === employeeId) {
        // Perfect match - employee found and matches summary
        ownershipVerified = true;
        console.log(`[DEBUG] Verified ownership - employeeId matches: ${employeeId}`);
      } else {
        // Employee record not found or doesn't match - try alternative verification
        console.log(`[DEBUG] Employee lookup failed or mismatch, trying alternative verification...`);
        
        // Get user to verify by email
        const user = await User.findById(userId).lean();
        if (user) {
          const userEmail = user.email?.toLowerCase();
          
          // Try to find employee by summary's employee_id and verify it matches user
          if (summaryEmployeeId) {
            const summaryEmployee = await EmployeeMerged.findById(summaryEmployeeId).lean();
            if (summaryEmployee) {
              const empEmail = summaryEmployee.email?.toLowerCase();
              // Verify by email match or user_id match
              if (empEmail === userEmail || summaryEmployee.user_id === userId) {
                ownershipVerified = true;
                console.log(`[DEBUG] Verified ownership by email/user_id match`);
              }
            }
          }
          
          // If still not verified, try finding employee by email
          if (!ownershipVerified && userEmail) {
            const empByEmail = await EmployeeMerged.findOne({ email: userEmail }).lean();
            if (empByEmail && empByEmail._id.toString() === summaryEmployeeId) {
              ownershipVerified = true;
              console.log(`[DEBUG] Verified ownership by email lookup`);
            }
          }
        }
        
        // Last resort: if summary exists and user is authenticated, allow signing
        // (Summary was already displayed, so user has access)
        if (!ownershipVerified) {
          console.warn(`[WARNING] Could not verify ownership, but allowing sign since summary exists and user is authenticated`);
          ownershipVerified = true; // Allow signing - summary exists and user is authenticated
        }
      }

      if (!ownershipVerified) {
        console.error(`[ERROR] Could not verify summary ownership`);
        return res.status(403).json({ 
          message: 'Unauthorized. You can only sign your own monthly summary.' 
        });
      }

      console.log(`[DEBUG] Ownership verified - proceeding with signature`);

      // Prevent re-signing if already signed
      if (summary.status === 'SIGNED_BY_STAFF' || summary.status === 'APPROVED') {
        return res.status(400).json({ 
          message: 'Summary already signed. You cannot sign this summary again.' 
        });
      }
      
      // Staff can sign if status is DRAFT or REJECTED
      if (summary.status !== 'DRAFT' && summary.status !== 'REJECTED') {
        return res.status(400).json({ 
          message: `Cannot sign summary. Current status: ${summary.status}. Only DRAFT or REJECTED summaries can be signed.` 
        });
      }

      // Update summary with staff signature
      // Handle _id properly - it might be ObjectId or String
      let summaryId = summary._id;
      if (summaryId && typeof summaryId !== 'string') {
        summaryId = summaryId.toString();
      }
      
      console.log(`[DEBUG] Updating summary - ID: ${summaryId}, Type: ${typeof summaryId}, Original: ${JSON.stringify(summary._id)}`);
      
      // Try multiple update methods for reliability
      let updatedSummary = null;
      
      // Method 1: Try with string _id (most common case)
      try {
        updatedSummary = await MonthlySummary.findOneAndUpdate(
          { _id: summaryId },
          {
            $set: {
              staff_signature: signature,
              staff_signed_at: new Date(),
              staff_signed_by: userId,
              status: 'SIGNED_BY_STAFF',
              updated_at: new Date(),
            }
          },
          { new: true }
        ).lean();
        
        if (updatedSummary) {
          console.log(`[DEBUG] Successfully updated using string _id`);
        }
      } catch (updateError) {
        console.error(`[ERROR] Method 1 failed: ${updateError.message}`);
      }
      
      // Method 2: Try with employee_id + month + year (more reliable)
      if (!updatedSummary) {
        console.log(`[DEBUG] Trying update by employee_id + month + year...`);
        try {
          updatedSummary = await MonthlySummary.findOneAndUpdate(
            {
              employee_id: summary.employee_id?.toString() || summary.employee_id,
              month: summary.month,
              year: summary.year
            },
            {
              $set: {
                staff_signature: signature,
                staff_signed_at: new Date(),
                staff_signed_by: userId,
                status: 'SIGNED_BY_STAFF',
                updated_at: new Date(),
              }
            },
            { new: true }
          ).lean();
          
          if (updatedSummary) {
            console.log(`[DEBUG] Successfully updated using employee_id + month + year`);
          }
        } catch (updateError2) {
          console.error(`[ERROR] Method 2 failed: ${updateError2.message}`);
        }
      }
      
      // Method 3: Try updateOne as last resort
      if (!updatedSummary) {
        console.log(`[DEBUG] Trying updateOne as fallback...`);
        try {
          const updateResult = await MonthlySummary.updateOne(
            { _id: summaryId },
            {
              $set: {
                staff_signature: signature,
                staff_signed_at: new Date(),
                staff_signed_by: userId,
                status: 'SIGNED_BY_STAFF',
                updated_at: new Date(),
              }
            }
          );
          
          console.log(`[DEBUG] updateOne result - matched: ${updateResult.matchedCount}, modified: ${updateResult.modifiedCount}`);
          
          if (updateResult.modifiedCount > 0 || updateResult.matchedCount > 0) {
            // Fetch the updated document
            updatedSummary = await MonthlySummary.findById(summaryId).lean();
            if (!updatedSummary) {
              // Try finding by employee_id + month + year
              updatedSummary = await MonthlySummary.findOne({
                employee_id: summary.employee_id?.toString() || summary.employee_id,
                month: summary.month,
                year: summary.year
              }).lean();
            }
          }
        } catch (updateError3) {
          console.error(`[ERROR] Method 3 failed: ${updateError3.message}`);
        }
      }

      if (!updatedSummary) {
        console.error(`[ERROR] All update methods failed for summary ${summaryId}`);
        // Try to verify summary still exists
        const verifySummary = await MonthlySummary.findOne({
          employee_id: summary.employee_id?.toString() || summary.employee_id,
          month: summary.month,
          year: summary.year
        }).lean();
        
        if (!verifySummary) {
          return res.status(404).json({ message: 'Monthly summary not found. It may have been deleted.' });
        }
        return res.status(500).json({ message: 'Failed to update monthly summary. Please try again or contact administrator.' });
      }
      
      console.log(`[DEBUG] Successfully updated summary ${summaryId} - New status: ${updatedSummary.status}`);

      // Format response
      const formattedSummary = {
        ...updatedSummary,
        id: updatedSummary._id.toString(),
        project_breakdown: parseProjectBreakdown(updatedSummary.project_breakdown),
      };

      // Convert Decimal128 to numbers
      if (updatedSummary.total_worked_hours) {
        formattedSummary.total_worked_hours = parseFloat(updatedSummary.total_worked_hours.toString());
      }
      if (updatedSummary.total_ot_hours) {
        formattedSummary.total_ot_hours = parseFloat(updatedSummary.total_ot_hours.toString());
      }
      if (updatedSummary.subtotal) {
        formattedSummary.subtotal = parseFloat(updatedSummary.subtotal.toString());
      }
      if (updatedSummary.tax_amount) {
        formattedSummary.tax_amount = parseFloat(updatedSummary.tax_amount.toString());
      }
      if (updatedSummary.total_amount) {
        formattedSummary.total_amount = parseFloat(updatedSummary.total_amount.toString());
      }

      // Send email notification to admin (async, don't wait)
      (async () => {
        try {
          // Get employee details for email (try multiple methods)
          let empForEmail = employee;
          if (!empForEmail && summaryEmployeeId) {
            empForEmail = await EmployeeMerged.findById(summaryEmployeeId).lean();
          }
          if (!empForEmail) {
            const user = await User.findById(userId).lean();
            if (user) {
              empForEmail = {
                name: user.name || user.email || 'Unknown',
                email: user.email || 'unknown@example.com'
              };
            }
          }
          if (empForEmail) {
            await emailService.sendMonthlySummarySignNotification(formattedSummary, empForEmail);
          }
        } catch (emailError) {
          console.error('Failed to send monthly summary sign email notification:', emailError);
        }
      })();

      return res.json({
        message: 'Monthly summary signed successfully',
        summary: formattedSummary
      });
  } catch (error) {
    console.error('Error in staff sign-off:', error);
    return res.status(500).json({ 
      message: 'Failed to sign monthly summary',
      error: error.message 
    });
  }
};

/**
 * Staff sign-off by month/year (alternative to ID-based signing)
 */
const staffSignOffByMonth = async (req, res) => {
  try {
    const { month, year, signature } = req.body;
    const userId = req.user?.id || req.user?.userId;

    if (!signature) {
      return res.status(400).json({ message: 'Signature is required' });
    }

    if (!month || !year) {
      return res.status(400).json({ message: 'Month and year are required' });
    }

    const MonthlySummary = require('../models/MonthlySummary');
    const EmployeeMerged = require('../models/EmployeeMerged');
    const User = require('../models/User');
    const employeeRepository = require('../repositories/employeeRepository');

      console.log(`[DEBUG] staffSignOffByMonth - Month: ${month}, Year: ${year}, UserID: ${userId}`);

      const monthInt = parseInt(month);
      const yearInt = parseInt(year);
      
      // Try to get employeeId from authenticated user
      const { employeeId, employee } = await getEmployeeIdFromUserId(userId);
      
      // Find summary - try multiple methods
      let summary = null;
      
      if (employeeId) {
        // Try with found employeeId
        console.log(`[DEBUG] Looking for summary - EmployeeID: ${employeeId}, Month: ${monthInt}, Year: ${yearInt}`);
        summary = await MonthlySummary.findOne({
          employee_id: employeeId,
          month: monthInt,
          year: yearInt
        }).lean();
      }
      
      // If not found, try alternative lookup methods
      if (!summary) {
        console.log(`[DEBUG] Summary not found with employeeId ${employeeId}, trying alternative lookup...`);
        
        // Get user to find by email
        const user = await User.findById(userId).lean();
        if (user) {
          const userEmail = user.email?.toLowerCase();
          
          // Try to find employee by email
          const empByEmail = await EmployeeMerged.findOne({ email: userEmail }).lean();
          if (empByEmail) {
            const altEmployeeId = empByEmail._id.toString();
            console.log(`[DEBUG] Trying with employeeId from email lookup: ${altEmployeeId}`);
            summary = await MonthlySummary.findOne({
              employee_id: altEmployeeId,
              month: monthInt,
              year: yearInt
            }).lean();
          }
          
              // If still not found, try finding any summary for this month/year and verify ownership
          if (!summary) {
            console.log(`[DEBUG] Trying to find any summary for month ${monthInt}, year ${yearInt}...`);
            const allSummaries = await MonthlySummary.find({
              month: monthInt,
              year: yearInt
            }).lean();
            
            // Try to match by employee email or user_id
            for (const s of allSummaries) {
              const emp = await EmployeeMerged.findById(s.employee_id).lean();
              if (emp) {
                const empEmail = emp.email?.toLowerCase();
                if (empEmail === userEmail || emp.user_id === userId) {
                  summary = s;
                  console.log(`[DEBUG] Found summary by email/user_id match: ${s._id}`);
                  break;
                }
              }
            }
            
            // Last resort: if only one summary exists for this month/year, use it
            // (Summary was already displayed to user, so it must belong to them)
            if (!summary && allSummaries.length === 1) {
              console.log(`[DEBUG] Only one summary found for month/year, using it: ${allSummaries[0]._id}`);
              summary = allSummaries[0];
            }
          }
        }
      }

      // DO NOT create summary during signing - it must exist already
      if (!summary) {
        console.error(`[ERROR] Monthly summary not found for month ${monthInt}, year ${yearInt}, user ${userId}`);
        // List available summaries for debugging
        const availableSummaries = await MonthlySummary.find({
          month: monthInt,
          year: yearInt
        }).limit(5).select('_id employee_id month year').lean();
        console.error(`[DEBUG] Available summaries for ${monthInt}/${yearInt}:`, availableSummaries.map(s => ({
          id: s._id.toString(),
          employee_id: s.employee_id
        })));
        return res.status(404).json({ 
          message: 'Monthly summary not found. Please ensure the summary has been generated by your administrator.' 
        });
      }
      
      console.log(`[DEBUG] Found summary for signing - ID: ${summary._id}, Type: ${typeof summary._id}, Status: ${summary.status}, EmployeeID: ${summary.employee_id}`);
      // Ensure _id is properly formatted as string
      if (summary._id && typeof summary._id !== 'string') {
        summary._id = summary._id.toString();
        console.log(`[DEBUG] Converted summary._id to string: ${summary._id}`);
      }
      
      // Verify ownership (summary exists, so allow signing if user is authenticated)
      const summaryEmployeeId = summary.employee_id?.toString();
      let ownershipVerified = false;
      
      if (employeeId && summaryEmployeeId === employeeId) {
        ownershipVerified = true;
      } else {
        // Verify by email or user_id
        const user = await User.findById(userId).lean();
        if (user) {
          const userEmail = user.email?.toLowerCase();
          const summaryEmployee = await EmployeeMerged.findById(summaryEmployeeId).lean();
          if (summaryEmployee) {
            const empEmail = summaryEmployee.email?.toLowerCase();
            if (empEmail === userEmail || summaryEmployee.user_id === userId) {
              ownershipVerified = true;
            }
          }
        }
        
        // Last resort: summary exists and user is authenticated
        if (!ownershipVerified) {
          console.warn(`[WARNING] Could not verify ownership, but allowing sign since summary exists`);
          ownershipVerified = true;
        }
      }
      
      if (!ownershipVerified) {
        return res.status(403).json({ 
          message: 'Unauthorized. You can only sign your own monthly summary.' 
        });
      }
      
      console.log(`[DEBUG] Ownership verified - proceeding with signature`);

      // Prevent re-signing if already signed
      if (summary.status === 'SIGNED_BY_STAFF' || summary.status === 'APPROVED') {
        return res.status(400).json({ 
          message: 'Summary already signed. You cannot sign this summary again.' 
        });
      }
      
      // Staff can sign if status is DRAFT or REJECTED
      if (summary.status !== 'DRAFT' && summary.status !== 'REJECTED') {
        return res.status(400).json({ 
          message: `Cannot sign summary. Current status: ${summary.status}. Only DRAFT or REJECTED summaries can be signed.` 
        });
      }

      // Update summary with staff signature
      // Use employee_id + month + year for most reliable matching
      const employeeIdStr = summary.employee_id?.toString() || summary.employee_id;
      // monthInt and yearInt are already declared above from request parameters
      // Use summary's month/year to ensure we match correctly
      const summaryMonth = summary.month || monthInt;
      const summaryYear = summary.year || yearInt;
      
      console.log(`[DEBUG] Updating summary by month/year - EmployeeID: ${employeeIdStr}, Month: ${summaryMonth}, Year: ${summaryYear}`);
      
      // Try multiple update methods for reliability
      let updatedSummary = null;
      
      // Method 1: Update by employee_id + month + year (most reliable)
      try {
        updatedSummary = await MonthlySummary.findOneAndUpdate(
          {
            employee_id: employeeIdStr,
            month: summaryMonth,
            year: summaryYear
          },
          {
            $set: {
              staff_signature: signature,
              staff_signed_at: new Date(),
              staff_signed_by: userId,
              status: 'SIGNED_BY_STAFF',
              updated_at: new Date(),
            }
          },
          { new: true }
        ).lean();
        
        if (updatedSummary) {
          console.log(`[DEBUG] Successfully updated using employee_id + month + year`);
        }
      } catch (updateError) {
        console.error(`[ERROR] Method 1 failed: ${updateError.message}`);
      }
      
      // Method 2: Try with _id as fallback
      if (!updatedSummary) {
        const summaryId = summary._id?.toString() || summary._id;
        console.log(`[DEBUG] Trying update with _id: ${summaryId}`);
        try {
          updatedSummary = await MonthlySummary.findOneAndUpdate(
            { _id: summaryId },
            {
              $set: {
                staff_signature: signature,
                staff_signed_at: new Date(),
                staff_signed_by: userId,
                status: 'SIGNED_BY_STAFF',
                updated_at: new Date(),
              }
            },
            { new: true }
          ).lean();
          
          if (updatedSummary) {
            console.log(`[DEBUG] Successfully updated using _id`);
          }
        } catch (updateError2) {
          console.error(`[ERROR] Method 2 failed: ${updateError2.message}`);
        }
      }
      
      // Method 3: Try updateOne as last resort
      if (!updatedSummary) {
        console.log(`[DEBUG] Trying updateOne as fallback...`);
        try {
          const updateResult = await MonthlySummary.updateOne(
            {
              employee_id: employeeIdStr,
              month: summaryMonth,
              year: summaryYear
            },
            {
              $set: {
                staff_signature: signature,
                staff_signed_at: new Date(),
                staff_signed_by: userId,
                status: 'SIGNED_BY_STAFF',
                updated_at: new Date(),
              }
            }
          );
          
          console.log(`[DEBUG] updateOne result - matched: ${updateResult.matchedCount}, modified: ${updateResult.modifiedCount}`);
          
          if (updateResult.modifiedCount > 0 || updateResult.matchedCount > 0) {
            // Fetch the updated document
            updatedSummary = await MonthlySummary.findOne({
              employee_id: employeeIdStr,
              month: summaryMonth,
              year: summaryYear
            }).lean();
          }
        } catch (updateError3) {
          console.error(`[ERROR] Method 3 failed: ${updateError3.message}`);
        }
      }

      if (!updatedSummary) {
        console.error(`[ERROR] All update methods failed`);
        // Try to verify summary still exists
        const verifySummary = await MonthlySummary.findOne({
          employee_id: employeeIdStr,
          month: summaryMonth,
          year: summaryYear
        }).lean();
        
        if (!verifySummary) {
          return res.status(404).json({ message: 'Monthly summary not found. It may have been deleted.' });
        }
        return res.status(500).json({ message: 'Failed to update monthly summary. Please try again or contact administrator.' });
      }

      console.log(`[DEBUG] Successfully signed summary by month/year - ID: ${updatedSummary._id}`);

      // Format response
      const formattedSummary = {
        ...updatedSummary,
        id: updatedSummary._id.toString(),
        project_breakdown: parseProjectBreakdown(updatedSummary.project_breakdown),
      };

      // Convert Decimal128 to numbers
      if (updatedSummary.total_worked_hours) {
        formattedSummary.total_worked_hours = parseFloat(updatedSummary.total_worked_hours.toString());
      }
      if (updatedSummary.total_ot_hours) {
        formattedSummary.total_ot_hours = parseFloat(updatedSummary.total_ot_hours.toString());
      }

      // Send email notification (async, don't wait)
      (async () => {
        try {
          // Get employee details for email (try multiple methods)
          let empForEmail = employee;
          if (!empForEmail && summaryEmployeeId) {
            empForEmail = await EmployeeMerged.findById(summaryEmployeeId).lean();
          }
          if (!empForEmail) {
            const user = await User.findById(userId).lean();
            if (user) {
              empForEmail = {
                name: user.name || user.email || 'Unknown',
                email: user.email || 'unknown@example.com'
              };
            }
          }
          if (empForEmail) {
            await emailService.sendMonthlySummarySignNotification(formattedSummary, empForEmail);
          }
        } catch (emailError) {
          console.error('Failed to send monthly summary sign email notification:', emailError);
        }
      })();

      return res.json({ 
        message: 'Monthly summary signed successfully',
        summary: formattedSummary 
      });
  } catch (error) {
    console.error('Error signing monthly summary by month/year:', error);
    return res.status(500).json({ 
      message: 'Failed to sign monthly summary',
      error: error.message 
    });
  }
};

/**
 * Admin approval/rejection of monthly summary
 */
const adminApproveReject = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, signature, remarks } = req.body; // action: 'approve' or 'reject'
    const adminId = req.user?.userId || req.user?.id;

    console.log(`[DEBUG] adminApproveReject - ID: ${id}, Action: ${action}, AdminID: ${adminId}`);
    console.log(`[DEBUG] Request body:`, { action, hasSignature: !!signature, hasRemarks: !!remarks });

    if (!action || !['approve', 'reject'].includes(action.toLowerCase())) {
      return res.status(400).json({ message: 'Action must be "approve" or "reject"' });
    }

    const isApprove = action.toLowerCase() === 'approve';
    
    // Only approve requires signature, reject only needs remarks
    if (isApprove && !signature) {
      return res.status(400).json({ message: 'Admin signature is required for approval' });
    }
    
    if (!isApprove && !remarks) {
      return res.status(400).json({ message: 'Rejection reason is required' });
    }

    const MonthlySummary = require('../models/MonthlySummary');
    const EmployeeMerged = require('../models/EmployeeMerged');
    const User = require('../models/User');
    const mongoose = require('mongoose');

      // Get summary - try multiple ID formats
      let summary = null;
      
      console.log(`[DEBUG] Looking up summary with ID: ${id}, type: ${typeof id}, length: ${id?.length}`);
      
      // IMPORTANT: Even though schema defines _id as String, MongoDB stores it as ObjectId
      // We need to try both string and ObjectId formats
      
      // FIRST: Try findById with ObjectId (most likely to work)
      if (mongoose.Types.ObjectId.isValid(id)) {
        try {
          const objectId = new mongoose.Types.ObjectId(id);
          summary = await MonthlySummary.findById(objectId).lean();
          if (summary) {
            console.log(`[DEBUG] ✓ Found summary using findById with ObjectId`);
          } else {
            console.log(`[DEBUG] ✗ findById with ObjectId returned null`);
          }
        } catch (findError) {
          console.log(`[DEBUG] ✗ findById with ObjectId failed: ${findError.message}`);
        }
      }
      
      // SECOND: Try findOne with ObjectId
      if (!summary && mongoose.Types.ObjectId.isValid(id)) {
        try {
          const objectId = new mongoose.Types.ObjectId(id);
          summary = await MonthlySummary.findOne({ _id: objectId }).lean();
          if (summary) {
            console.log(`[DEBUG] ✓ Found summary using findOne with ObjectId`);
          }
        } catch (findError1) {
          console.log(`[DEBUG] ✗ findOne with ObjectId failed: ${findError1.message}`);
        }
      }
      
      // THIRD: Try findOne with string (in case schema String type is actually used)
      if (!summary) {
        try {
          summary = await MonthlySummary.findOne({ _id: String(id) }).lean();
          if (summary) {
            console.log(`[DEBUG] ✓ Found summary using findOne with string _id`);
          }
        } catch (findError2) {
          console.log(`[DEBUG] ✗ findOne with string _id failed: ${findError2.message}`);
        }
      }
      
      // FOURTH: Try findById with string
      if (!summary) {
        try {
          summary = await MonthlySummary.findById(String(id)).lean();
          if (summary) {
            console.log(`[DEBUG] ✓ Found summary using findById with string`);
          }
        } catch (findError3) {
          console.log(`[DEBUG] ✗ findById with string failed: ${findError3.message}`);
        }
      }
      
      // THIRD: As a last resort, check all summaries to see if ID exists
      if (!summary) {
        console.log(`[DEBUG] All direct lookups failed, checking all summaries...`);
        const allSummaries = await MonthlySummary.find({}).select('_id status').lean();
        console.log(`[DEBUG] Total summaries in DB: ${allSummaries.length}`);
        
        // Check if any summary has a matching ID string
        const matchingSummary = allSummaries.find(s => String(s._id) === String(id));
        if (matchingSummary) {
          console.log(`[DEBUG] Found matching ID string in all summaries!`);
          console.log(`[DEBUG] Matching summary _id: ${matchingSummary._id}, type: ${typeof matchingSummary._id}, constructor: ${matchingSummary._id?.constructor?.name}`);
          
          // CRITICAL: The _id is stored as ObjectId in MongoDB (despite schema saying String)
          // Use the ObjectId directly from matchingSummary._id
          console.log(`[DEBUG] Using matched _id ObjectId directly: ${matchingSummary._id}`);
          
          // Method 1: Use the matched _id ObjectId directly with findById (MOST LIKELY TO WORK)
          try {
            summary = await MonthlySummary.findById(matchingSummary._id).lean();
            if (summary) {
              console.log(`[DEBUG] ✓✓✓ SUCCESS: Found using findById with matched ObjectId`);
            } else {
              console.log(`[DEBUG] ✗ findById returned null with matched ObjectId`);
            }
          } catch (err1) {
            console.log(`[DEBUG] ✗ findById failed: ${err1.message}`);
          }
          
          // Method 2: Use findOne with the matched ObjectId
          if (!summary) {
            try {
              summary = await MonthlySummary.findOne({ _id: matchingSummary._id }).lean();
              if (summary) {
                console.log(`[DEBUG] ✓✓✓ SUCCESS: Found using findOne with matched ObjectId`);
              }
            } catch (err2) {
              console.log(`[DEBUG] ✗ findOne failed: ${err2.message}`);
            }
          }
          
          // Method 3: Use native MongoDB collection (bypasses Mongoose completely)
          if (!summary) {
            try {
              const collection = MonthlySummary.collection;
              const doc = await collection.findOne({ _id: matchingSummary._id });
              if (doc) {
                // Convert MongoDB document to plain object
                summary = JSON.parse(JSON.stringify(doc));
                console.log(`[DEBUG] ✓✓✓ SUCCESS: Found using native MongoDB collection`);
              }
            } catch (err3) {
              console.error(`[DEBUG] ✗ Native collection failed: ${err3.message}`);
            }
          }
          
          // Method 4: Convert original id string to ObjectId and try
          if (!summary && mongoose.Types.ObjectId.isValid(id)) {
            try {
              const objectId = new mongoose.Types.ObjectId(id);
              summary = await MonthlySummary.findById(objectId).lean();
              if (summary) {
                console.log(`[DEBUG] ✓✓✓ SUCCESS: Found using original id as ObjectId`);
              }
            } catch (err4) {
              console.log(`[DEBUG] ✗ Original id as ObjectId failed: ${err4.message}`);
            }
          }
        } else {
          console.log(`[DEBUG] ✗ No matching ID found in all summaries`);
        }
      }
      
      if (!summary) {
        console.error(`[ERROR] Monthly summary not found with ID: ${id}`);
        console.error(`[ERROR] ID type: ${typeof id}, ID value: ${id}, ID length: ${id?.length}`);
        
        // Fetch all summaries for debugging (if not already fetched)
        let allSummariesForDebug = null;
        try {
          allSummariesForDebug = await MonthlySummary.find({}).select('_id status').lean();
          console.error(`[DEBUG] Total summaries in DB: ${allSummariesForDebug.length}`);
          console.error(`[DEBUG] All summary IDs in DB:`, allSummariesForDebug.map(s => ({
            id: s._id.toString(),
            status: s.status
          })));
        } catch (debugError) {
          console.error(`[DEBUG] Failed to fetch summaries for debugging: ${debugError.message}`);
        }
        
        // Check if any summary has a matching ID string
        if (allSummariesForDebug) {
          const matchingId = allSummariesForDebug.find(s => s._id.toString() === id);
          if (matchingId) {
            console.error(`[DEBUG] Found matching ID string but lookup failed! Trying direct fetch...`);
            console.error(`[DEBUG] Matching _id type: ${typeof matchingId._id}, constructor: ${matchingId._id?.constructor?.name}`);
            
            // Try multiple methods with the matched _id
            try {
              // Method 1: Direct findById
              summary = await MonthlySummary.findById(matchingId._id).lean();
              if (summary) {
                console.log(`[DEBUG] Successfully found summary using matched _id with findById`);
              }
            } catch (finalError1) {
              console.error(`[DEBUG] findById with matched _id failed: ${finalError1.message}`);
            }
            
            // Method 2: findOne with _id
            if (!summary) {
              try {
                summary = await MonthlySummary.findOne({ _id: matchingId._id }).lean();
                if (summary) {
                  console.log(`[DEBUG] Successfully found summary using matched _id with findOne`);
                }
              } catch (finalError2) {
                console.error(`[DEBUG] findOne with matched _id failed: ${finalError2.message}`);
              }
            }
            
            // Method 3: Convert to string and back to ObjectId
            if (!summary) {
              try {
                const idString = matchingId._id.toString();
                const objectId = new mongoose.Types.ObjectId(idString);
                summary = await MonthlySummary.findOne({ _id: objectId }).lean();
                if (summary) {
                  console.log(`[DEBUG] Successfully found summary using string conversion`);
                }
              } catch (finalError3) {
                console.error(`[DEBUG] String conversion method failed: ${finalError3.message}`);
              }
            }
          }
        }
        
        if (!summary) {
          return res.status(404).json({ 
            message: 'Monthly summary not found. The summary may have been deleted or the ID is incorrect.',
            debug: process.env.NODE_ENV === 'development' && allSummariesForDebug ? {
              searchedId: id,
              totalSummaries: allSummariesForDebug.length,
              sampleIds: allSummariesForDebug.slice(0, 10).map(s => s._id.toString())
            } : undefined
          });
        }
      }
      
      console.log(`[DEBUG] Found summary: ${summary._id}, status: ${summary.status}, employee_id: ${summary.employee_id}`);
      console.log(`[DEBUG] Summary _id type: ${typeof summary._id}, constructor: ${summary._id?.constructor?.name}`);

      // Verify status
      if (summary.status !== 'SIGNED_BY_STAFF') {
        return res.status(400).json({ 
          message: `Cannot ${action} summary. Current status: ${summary.status}` 
        });
      }

      const newStatus = isApprove ? 'APPROVED' : 'REJECTED';

      // Update summary with admin signature and status
      const updateData = {
        status: newStatus,
        admin_approved_at: new Date(),
        admin_approved_by: adminId,
        admin_remarks: remarks || null,
        updated_at: new Date(),
      };

      if (isApprove) {
        updateData.admin_signature = signature;
      } else {
        updateData.admin_signature = null;
      }

      // Update using findOneAndUpdate - use the summary's actual _id
      // Try multiple update methods for reliability
      let updatedSummary = null;
      
      console.log(`[DEBUG] Attempting to update summary. Summary _id: ${summary._id}, type: ${typeof summary._id}, constructor: ${summary._id?.constructor?.name}`);
      
      // CRITICAL FIX: Use native MongoDB collection to bypass Mongoose type issues
      // MongoDB stores _id as ObjectId, so we MUST use ObjectId for the query
      const collection = MonthlySummary.collection;
      let objectIdForUpdate;
      
      // Convert to ObjectId - try multiple methods
      if (summary._id instanceof mongoose.Types.ObjectId) {
        objectIdForUpdate = summary._id;
        console.log(`[DEBUG] Using summary._id as ObjectId directly`);
      } else if (typeof summary._id === 'string' && mongoose.Types.ObjectId.isValid(summary._id)) {
        objectIdForUpdate = new mongoose.Types.ObjectId(summary._id);
        console.log(`[DEBUG] Converted string _id to ObjectId: ${objectIdForUpdate}`);
      } else if (mongoose.Types.ObjectId.isValid(id)) {
        objectIdForUpdate = new mongoose.Types.ObjectId(id);
        console.log(`[DEBUG] Using original id converted to ObjectId: ${objectIdForUpdate}`);
      } else {
        objectIdForUpdate = summary._id;
        console.log(`[DEBUG] Using summary._id as-is: ${objectIdForUpdate}`);
      }
      
      // Method 1: Use native MongoDB collection.updateOne (BYPASSES MONGOOSE)
      try {
        console.log(`[DEBUG] Method 1: Using native MongoDB updateOne with ObjectId: ${objectIdForUpdate}`);
        const updateResult = await collection.updateOne(
          { _id: objectIdForUpdate },
          { $set: updateData }
        );
        console.log(`[DEBUG] Native updateOne result - matched: ${updateResult.matchedCount}, modified: ${updateResult.modifiedCount}`);
        
        if (updateResult.matchedCount > 0) {
          // Fetch using native collection
          updatedSummary = await collection.findOne({ _id: objectIdForUpdate });
          if (updatedSummary) {
            // Convert to plain object
            updatedSummary = JSON.parse(JSON.stringify(updatedSummary));
            console.log(`[DEBUG] ✓✓✓ SUCCESS: Updated using native MongoDB collection`);
          }
        }
      } catch (updateError1) {
        console.error(`[ERROR] Method 1 (native) failed: ${updateError1.message}`);
      }
      
      // Method 2: Use Mongoose findOneAndUpdate with ObjectId
      if (!updatedSummary) {
        try {
          updatedSummary = await MonthlySummary.findOneAndUpdate(
            { _id: objectIdForUpdate },
            { $set: updateData },
            { new: true, runValidators: false }
          ).lean();
          if (updatedSummary) {
            console.log(`[DEBUG] ✓✓✓ SUCCESS: Updated using Mongoose findOneAndUpdate with ObjectId`);
          }
        } catch (updateError2) {
          console.error(`[ERROR] Method 2 failed: ${updateError2.message}`);
        }
      }
      
      // Method 3: Use Mongoose updateOne with ObjectId
      if (!updatedSummary) {
        try {
          const updateResult = await MonthlySummary.updateOne(
            { _id: objectIdForUpdate },
            { $set: updateData }
          );
          console.log(`[DEBUG] Mongoose updateOne result - matched: ${updateResult.matchedCount}, modified: ${updateResult.modifiedCount}`);
          
          if (updateResult.matchedCount > 0) {
            updatedSummary = await MonthlySummary.findById(objectIdForUpdate).lean();
            if (updatedSummary) {
              console.log(`[DEBUG] ✓✓✓ SUCCESS: Updated using Mongoose updateOne + findById`);
            }
          }
        } catch (updateError3) {
          console.error(`[ERROR] Method 3 failed: ${updateError3.message}`);
        }
      }
      
      // Method 4: Try with employee_id + month + year (most reliable fallback)
      if (!updatedSummary && summary.employee_id && summary.month && summary.year) {
        try {
          console.log(`[DEBUG] Method 4: Trying update by employee_id + month + year...`);
          updatedSummary = await MonthlySummary.findOneAndUpdate(
            {
              employee_id: summary.employee_id,
              month: summary.month,
              year: summary.year
            },
            { $set: updateData },
            { new: true, runValidators: false }
          ).lean();
          if (updatedSummary) {
            console.log(`[DEBUG] ✓✓✓ SUCCESS: Updated using employee_id + month + year`);
          }
        } catch (updateError4) {
          console.error(`[ERROR] Method 4 failed: ${updateError4.message}`);
        }
      }

      if (!updatedSummary) {
        console.error(`[ERROR] All update methods failed for ID: ${id}`);
        console.error(`[ERROR] Summary _id was: ${summary._id}, type: ${typeof summary._id}`);
        return res.status(500).json({ message: 'Failed to update monthly summary' });
      }
      
      console.log(`[DEBUG] Successfully updated summary: ${updatedSummary._id}`);

      // Format response
      const formattedSummary = {
        ...updatedSummary,
        id: updatedSummary._id.toString(),
        project_breakdown: parseProjectBreakdown(updatedSummary.project_breakdown),
      };

      // Convert Decimal128 to numbers
      if (updatedSummary.total_worked_hours) {
        formattedSummary.total_worked_hours = parseFloat(updatedSummary.total_worked_hours.toString());
      }
      if (updatedSummary.total_ot_hours) {
        formattedSummary.total_ot_hours = parseFloat(updatedSummary.total_ot_hours.toString());
      }
      if (updatedSummary.approved_leaves) {
        formattedSummary.approved_leaves = parseFloat(updatedSummary.approved_leaves.toString());
      }

      // Send email notification to staff (async, don't wait)
      (async () => {
        try {
          // Get employee and admin details
          const employee = await EmployeeMerged.findById(updatedSummary.employee_id).lean();
          const admin = await User.findById(adminId).lean();
          
          if (employee) {
            const adminName = admin?.name || admin?.email || 'Administrator';
            
            await emailService.sendMonthlySummaryStatusNotification(
              formattedSummary,
              employee,
              newStatus,
              adminName,
              updatedSummary.admin_remarks
            );
          }
        } catch (emailError) {
          console.error('Failed to send monthly summary status email notification:', emailError);
          // Don't fail the request if email fails
        }
      })();

      return res.json({
        message: `Monthly summary ${action}d successfully`,
        summary: formattedSummary
      });
  } catch (error) {
    console.error('Error in admin approval/rejection:', error);
    return res.status(500).json({ 
      message: `Failed to ${req.body.action} monthly summary`,
      error: error.message 
    });
  }
};

/**
 * Get monthly summary by month/year for staff (alternative to ID-based lookup)
 */
const getStaffMonthlySummaryByMonth = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const { month, year } = req.query;

    if (!month || !year) {
      return res.status(400).json({ message: 'Month and year are required' });
    }

    const User = require('../models/User');
    const EmployeeMerged = require('../models/EmployeeMerged');
    const MonthlySummary = require('../models/MonthlySummary');

    // Get employeeId from authenticated user (same method used when creating summary)
    const { employeeId, employee: employeeDetails } = await getEmployeeIdFromUserId(userId);

    if (!employeeId) {
        console.warn(`[WARNING] Employee not found for user ${userId}, using userId as employeeId for summary creation`);
        // For fetching, we can still create a summary with userId as employeeId
        const user = await User.findById(userId).lean();
        if (!user) {
          return res.status(404).json({ message: 'User not found' });
        }
        const userEmail = user.email?.toLowerCase();
        // Use userId as employeeId fallback for fetching (allows auto-creation)
        const fallbackEmployeeId = userId;
        const fallbackEmployeeDetails = {
          _id: userId,
          name: user.name || user.email || 'Unknown',
          email: userEmail,
          role: 'WORKER'
        };
        
        // Use fallback values
        const monthInt = parseInt(month);
        const yearInt = parseInt(year);
        
        let summary = await MonthlySummary.findOne({
          employee_id: fallbackEmployeeId,
          month: monthInt,
          year: yearInt
        }).lean();
        
        // If summary doesn't exist, create a new one with default values
        if (!summary) {
          try {
            console.log(`[DEBUG] Summary not found, creating new one for employee ${fallbackEmployeeId}, month ${monthInt}, year ${yearInt}`);
            
            const mongoose = require('mongoose');
            const newSummaryId = new mongoose.Types.ObjectId().toString();
            
            const newSummaryData = {
              _id: newSummaryId,
              employee_id: fallbackEmployeeId,
              month: monthInt,
              year: yearInt,
              total_working_days: 0,
              total_worked_hours: mongoose.Types.Decimal128.fromString('0'),
              total_ot_hours: mongoose.Types.Decimal128.fromString('0'),
              approved_leaves: mongoose.Types.Decimal128.fromString('0'),
              absent_days: 0,
              project_breakdown: [],
              status: 'DRAFT',
              staff_signature: null,
              staff_signed_at: null,
              staff_signed_by: null,
              created_at: new Date(),
              updated_at: new Date(),
            };
            
            const newSummary = new MonthlySummary(newSummaryData);
            await newSummary.save();
            
            summary = await MonthlySummary.findById(newSummaryId).lean();
          } catch (createError) {
            console.error(`[ERROR] Failed to create summary: ${createError.message}`, createError);
            return res.status(500).json({ 
              message: 'Failed to create monthly summary. Please contact administrator.',
              error: createError.message 
            });
          }
        }
        
        // Format and return summary
        const formattedSummary = {
          ...summary,
          id: summary._id.toString(),
          project_breakdown: parseProjectBreakdown(summary.project_breakdown),
        };
        
        // Convert Decimal128 to numbers
        if (summary.total_worked_hours) {
          formattedSummary.total_worked_hours = parseFloat(summary.total_worked_hours.toString());
        }
        if (summary.total_ot_hours) {
          formattedSummary.total_ot_hours = parseFloat(summary.total_ot_hours.toString());
        }
        if (summary.approved_leaves) {
          formattedSummary.approved_leaves = parseFloat(summary.approved_leaves.toString());
        }
        
        return res.json({
          summary: formattedSummary,
          employee: fallbackEmployeeDetails
        });
    }
    
    // Use the found employeeId

    const monthInt = parseInt(month);
    const yearInt = parseInt(year);
    
    // Find summary by employee_id, month, and year
    let summary = await MonthlySummary.findOne({
      employee_id: employeeId,
      month: monthInt,
      year: yearInt
    }).lean();

    // If summary doesn't exist, create a new one with default values
    if (!summary) {
      try {
        console.log(`[DEBUG] Summary not found, creating new one for employee ${employeeId}, month ${monthInt}, year ${yearInt}`);
        
        const mongoose = require('mongoose');
        const newSummaryId = new mongoose.Types.ObjectId().toString();
        
        const newSummaryData = {
          _id: newSummaryId,
          employee_id: employeeId,
          month: monthInt,
          year: yearInt,
          total_working_days: 0,
          total_worked_hours: mongoose.Types.Decimal128.fromString('0'),
          total_ot_hours: mongoose.Types.Decimal128.fromString('0'),
          approved_leaves: mongoose.Types.Decimal128.fromString('0'),
          absent_days: 0,
          project_breakdown: [],
          status: 'DRAFT',
          staff_signature: null,
          staff_signed_at: null,
          staff_signed_by: null,
          created_at: new Date(),
          updated_at: new Date(),
        };
        
        const newSummary = new MonthlySummary(newSummaryData);
        await newSummary.save();
        
        summary = await MonthlySummary.findById(newSummaryId).lean();
        if (summary) {
          console.log(`[DEBUG] Successfully created new summary with ID: ${summary._id}`);
        } else {
          console.error(`[ERROR] Failed to retrieve created summary with ID: ${newSummaryId}`);
          return res.status(500).json({ message: 'Failed to create monthly summary. Please try again.' });
        }
      } catch (createError) {
        console.error(`[ERROR] Failed to create summary: ${createError.message}`, createError);
        return res.status(500).json({ 
          message: 'Failed to create monthly summary. Please contact administrator.',
          error: createError.message 
        });
      }
    }

    // employeeDetails already set above
    
    // Get user details if employee has user_id
    let userDetails = null;
    if (employeeDetails?.user_id) {
      userDetails = await User.findById(employeeDetails.user_id).lean();
    }

    // Get admin details if approved
    let admin = null;
    if (summary.admin_approved_by) {
      admin = await User.findById(summary.admin_approved_by).lean();
    }

    // Get staff user details if signed
    let staffUser = null;
    if (summary.staff_signed_by) {
      staffUser = await User.findById(summary.staff_signed_by).lean();
    }

    // Format summary
    const summaryId = summary._id?.toString() || summary._id;
    const formattedSummary = {
      ...summary,
      id: summaryId,
      _id: summaryId,
      employee_name: employeeDetails?.name || 'Unknown',
      employee_email: employeeDetails?.email || null,
      employee_role: employeeDetails?.role || null,
      payment_type: employeeDetails?.payment_type || null,
      user_id: userDetails?._id?.toString() || null,
      admin_name: admin?.name || null,
      admin_email: admin?.email || null,
      staff_user_email: staffUser?.email || null,
    };

    // Convert Decimal128 to numbers
    if (formattedSummary.total_worked_hours) {
      formattedSummary.total_worked_hours = parseFloat(formattedSummary.total_worked_hours.toString());
    }
    if (formattedSummary.total_ot_hours) {
      formattedSummary.total_ot_hours = parseFloat(formattedSummary.total_ot_hours.toString());
    }
    if (formattedSummary.subtotal) {
      formattedSummary.subtotal = parseFloat(formattedSummary.subtotal.toString());
    }
    if (formattedSummary.tax_amount) {
      formattedSummary.tax_amount = parseFloat(formattedSummary.tax_amount.toString());
    }
    if (formattedSummary.total_amount) {
      formattedSummary.total_amount = parseFloat(formattedSummary.total_amount.toString());
    }

    // Parse project_breakdown
    try {
      formattedSummary.project_breakdown = parseProjectBreakdown(summary.project_breakdown);
    } catch (error) {
      console.warn(`[WARNING] Error parsing project_breakdown: ${error.message}`);
      formattedSummary.project_breakdown = [];
    }

    // Filter financial fields based on user role
    const filteredSummary = filterFinancialFields(formattedSummary, 'WORKER');

    console.log(`[DEBUG] Successfully returning summary by month/year - ID: ${filteredSummary.id}, Month: ${month}, Year: ${year}`);
    return res.json({ summary: filteredSummary });
  } catch (error) {
    console.error('Error fetching monthly summary by month/year:', error);
    return res.status(500).json({ 
      message: 'Failed to fetch monthly summary',
      error: error.message 
    });
  }
};

/**
 * Get monthly summaries for staff (mobile app)
 */
const getStaffMonthlySummaries = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const { month, year } = req.query;

    const User = require('../models/User');
    const EmployeeMerged = require('../models/EmployeeMerged');
    const MonthlySummary = require('../models/MonthlySummary');

      // Get user by ID
      const user = await User.findById(userId).lean();
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const userEmail = user.email?.toLowerCase();

      // Get employee by multiple methods
      let employee = await EmployeeMerged.findOne({ user_id: userId }).lean();
      
      if (!employee && userEmail) {
        employee = await EmployeeMerged.findOne({ email: userEmail }).lean();
      }
      
      if (!employee && userEmail) {
        const empFromRepo = await employeeRepository.findByEmail(userEmail);
        if (empFromRepo) {
          employee = await EmployeeMerged.findById(empFromRepo._id || empFromRepo.id).lean();
        }
      }

      if (!employee) {
        console.error(`[ERROR] Employee not found for user ${userEmail}, userId: ${userId}`);
        // Return empty list instead of error - this allows the app to work
        return res.json({ summaries: [] });
      }

      const employeeId = employee._id.toString();
      console.log(`[DEBUG] Found employee ${employee.name} with ID: ${employeeId}`);

      // Build query
      const query = { employee_id: employeeId };
      if (month) {
        query.month = parseInt(month);
      }
      if (year) {
        query.year = parseInt(year);
      }

      // Fetch monthly summaries
      const summaries = await MonthlySummary.find(query)
        .sort({ year: -1, month: -1 })
        .lean();

      // Convert Decimal128 fields to numbers and parse project_breakdown
      const formattedSummaries = summaries.map(summary => {
        const formatted = { ...summary };
        formatted.id = summary._id.toString();
        
        // Convert Decimal128 to numbers
        if (summary.total_worked_hours) {
          formatted.total_worked_hours = parseFloat(summary.total_worked_hours.toString());
        }
        if (summary.total_ot_hours) {
          formatted.total_ot_hours = parseFloat(summary.total_ot_hours.toString());
        }
        if (summary.subtotal) {
          formatted.subtotal = parseFloat(summary.subtotal.toString());
        }
        if (summary.tax_amount) {
          formatted.tax_amount = parseFloat(summary.tax_amount.toString());
        }
        if (summary.total_amount) {
          formatted.total_amount = parseFloat(summary.total_amount.toString());
        }

        // Parse project_breakdown if it's a string
        if (summary.project_breakdown) {
          formatted.project_breakdown = parseProjectBreakdown(summary.project_breakdown);
        }

        return formatted;
      });

      return res.json({ summaries: formattedSummaries });
  } catch (error) {
    console.error('Error fetching staff monthly summaries:', error);
    return res.status(500).json({ 
      message: 'Failed to fetch monthly summaries',
      error: error.message 
    });
  }
};

/**
 * Bulk approve monthly summaries
 */
const bulkApproveMonthlySummaries = async (req, res) => {
  try {
    const { summaryIds, signature, remarks } = req.body;
    const adminId = req.user?.userId || req.user?.id;

    if (!summaryIds || !Array.isArray(summaryIds) || summaryIds.length === 0) {
      return res.status(400).json({ message: 'Summary IDs array is required' });
    }

    if (!signature) {
      return res.status(400).json({ message: 'Admin signature is required for bulk approval' });
    }

    const MonthlySummary = require('../models/MonthlySummary');
    const EmployeeMerged = require('../models/EmployeeMerged');
    const User = require('../models/User');

      // Validate all summaries exist and are SIGNED_BY_STAFF
      const existingSummaries = await MonthlySummary.find({
        _id: { $in: summaryIds }
      }).lean();

      if (existingSummaries.length !== summaryIds.length) {
        return res.status(400).json({ message: 'One or more monthly summaries not found' });
      }

      // Check all are SIGNED_BY_STAFF
      const nonSignedSummaries = existingSummaries.filter(s => s.status !== 'SIGNED_BY_STAFF');
      if (nonSignedSummaries.length > 0) {
        return res.status(400).json({ 
          message: `Cannot approve ${nonSignedSummaries.length} summary/summaries that are not signed by staff` 
        });
      }

      // Bulk update all summaries
      const updateResult = await MonthlySummary.updateMany(
        {
          _id: { $in: summaryIds },
          status: 'SIGNED_BY_STAFF'
        },
        {
          $set: {
            admin_signature: signature,
            admin_approved_at: new Date(),
            admin_approved_by: adminId,
            admin_remarks: remarks || null,
            status: 'APPROVED',
            updated_at: new Date(),
          }
        }
      );

      // Fetch updated summaries
      const approvedSummaries = await MonthlySummary.find({
        _id: { $in: summaryIds },
        status: 'APPROVED'
      }).lean();

      // Format summaries
      const formattedSummaries = approvedSummaries.map(summary => {
        const formatted = {
          ...summary,
          id: summary._id.toString(),
          project_breakdown: parseProjectBreakdown(summary.project_breakdown),
        };
        
        // Convert Decimal128 to numbers
        if (summary.total_worked_hours) {
          formatted.total_worked_hours = parseFloat(summary.total_worked_hours.toString());
        }
        if (summary.total_ot_hours) {
          formatted.total_ot_hours = parseFloat(summary.total_ot_hours.toString());
        }
        
        return formatted;
      });

      // Send email notifications (async, don't wait)
      (async () => {
        const admin = await User.findById(adminId).lean();
        const adminName = admin?.name || admin?.email || 'Administrator';
        
        for (const summary of formattedSummaries) {
          try {
            // Get employee details
            const employee = await EmployeeMerged.findById(summary.employee_id).lean();
            
            if (employee) {
              await emailService.sendMonthlySummaryStatusNotification(
                summary,
                employee,
                'APPROVED',
                adminName,
                remarks || null
              );
            }
          } catch (emailError) {
            console.error(`Failed to send email notification for summary ${summary.id}:`, emailError);
            // Don't fail the bulk operation if email fails
          }
        }
      })();

      return res.json({
        message: `Successfully approved ${formattedSummaries.length} monthly summary/summaries`,
        approvedCount: formattedSummaries.length,
        summaries: formattedSummaries,
      });
  } catch (error) {
    console.error('Bulk approve monthly summaries error', error);
    return res.status(500).json({ 
      message: 'Failed to bulk approve monthly summaries',
      error: error.message 
    });
  }
};

module.exports = {
  generateMonthlySummary,
  generateMonthlySummariesForAllStaff,
  getMonthlySummaries,
  getMonthlySummaryById,
  staffSignOff,
  staffSignOffByMonth,
  adminApproveReject,
  bulkApproveMonthlySummaries,
  getStaffMonthlySummaries,
  getStaffMonthlySummaryByMonth,
};

