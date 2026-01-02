const emailService = require('./emailService');
const EmployeeMerged = require('../models/EmployeeMerged');
const AttendanceMerged = require('../models/AttendanceMerged');
const MonthlySummary = require('../models/MonthlySummary');
const { LeaveRequest } = require('../models/LeaveMerged');
const User = require('../models/User');

/**
 * Send daily check-in reminder to staff who haven't checked in
 */
const sendCheckInReminders = async () => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    // Find employees who haven't checked in today
    // Get all employees who checked in today
    const checkedInEmployees = await AttendanceMerged.find({
      check_in_time: {
        $gte: new Date(todayStr),
        $lt: new Date(new Date(todayStr).getTime() + 24 * 60 * 60 * 1000)
      },
      check_in_time: { $ne: null }
    }).distinct('employee_id').lean();

    // Get all active employees who haven't checked in
    const employees = await EmployeeMerged.find({
      status: 'active',
      email: { $ne: null, $exists: true },
      _id: { $nin: checkedInEmployees }
    }).select('_id name email status').lean();

    console.log(`📅 Check-in reminders: Found ${employees.length} employees who haven't checked in today`);

    for (const employee of employees) {
      try {
        await emailService.sendEmail({
          to: employee.email,
          subject: 'Daily Check-In Reminder',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">Daily Check-In Reminder</h2>
              <p>Hello ${employee.name},</p>
              <p>This is a reminder that you haven't checked in for today (${today.toLocaleDateString()}).</p>
              <p>Please remember to check in using the mobile app.</p>
              <p style="color: #666; font-size: 12px; margin-top: 30px;">
                This is an automated reminder. Please do not reply to this email.
              </p>
            </div>
          `,
        });
        console.log(`✅ Check-in reminder sent to ${employee.email}`);
      } catch (error) {
        console.error(`❌ Failed to send check-in reminder to ${employee.email}:`, error.message);
      }
    }

    return { sent: employees.length };
  } catch (error) {
    console.error('Error sending check-in reminders:', error);
    return { sent: 0, error: error.message };
  }
};

/**
 * Send daily check-out reminder to staff who checked in but haven't checked out
 */
const sendCheckOutReminders = async () => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];
    const currentHour = new Date().getHours();

    // Only send check-out reminders after 5 PM
    if (currentHour < 17) {
      console.log('⏰ Check-out reminders: Too early (before 5 PM)');
      return { sent: 0, skipped: true };
    }

    // Find employees who checked in today but haven't checked out
    const startOfDay = new Date(todayStr);
    const endOfDay = new Date(new Date(todayStr).getTime() + 24 * 60 * 60 * 1000);
    
    const attendanceRecords = await AttendanceMerged.find({
      check_in_time: { $gte: startOfDay, $lt: endOfDay },
      check_out_time: null,
      check_in_time: { $ne: null }
    }).select('employee_id check_in_time').lean();

    const employeeIds = [...new Set(attendanceRecords.map(a => a.employee_id?.toString()))];
    
    const employees = await EmployeeMerged.find({
      _id: { $in: employeeIds },
      status: 'active',
      email: { $ne: null, $exists: true }
    }).select('_id name email').lean();

    // Enrich with check_in_time
    const attendanceMap = new Map();
    attendanceRecords.forEach(a => {
      if (a.employee_id) {
        attendanceMap.set(a.employee_id.toString(), a.check_in_time);
      }
    });

    const enrichedEmployees = employees.map(emp => ({
      id: emp._id,
      name: emp.name,
      email: emp.email,
      check_in_time: attendanceMap.get(emp._id.toString())
    }));

    console.log(`📅 Check-out reminders: Found ${employees.length} employees who haven't checked out today`);

    for (const employee of employees) {
      try {
        await emailService.sendEmail({
          to: employee.email,
          subject: 'Daily Check-Out Reminder',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">Daily Check-Out Reminder</h2>
              <p>Hello ${employee.name},</p>
              <p>This is a reminder that you checked in today but haven't checked out yet.</p>
              <p><strong>Check-in Time:</strong> ${new Date(employee.check_in_time).toLocaleString()}</p>
              <p>Please remember to check out using the mobile app before leaving.</p>
              <p style="color: #666; font-size: 12px; margin-top: 30px;">
                This is an automated reminder. Please do not reply to this email.
              </p>
            </div>
          `,
        });
        console.log(`✅ Check-out reminder sent to ${employee.email}`);
      } catch (error) {
        console.error(`❌ Failed to send check-out reminder to ${employee.email}:`, error.message);
      }
    }

    return { sent: employees.length };
  } catch (error) {
    console.error('Error sending check-out reminders:', error);
    return { sent: 0, error: error.message };
  }
};

/**
 * Send monthly summary sign reminder to staff with DRAFT summaries
 */
const sendMonthlySummaryReminders = async () => {
  try {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Find employees with DRAFT monthly summaries for current or previous month
    const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;

    const summaries = await MonthlySummary.aggregate([
      {
        $match: {
          status: 'DRAFT',
          $or: [
            { year: currentYear, month: currentMonth },
            { year: currentYear, month: prevMonth },
            { year: prevYear, month: 12, ...(currentMonth === 1 ? {} : {}) }
          ]
        }
      },
      {
        $lookup: {
          from: 'employees',
          localField: 'employee_id',
          foreignField: '_id',
          as: 'employee'
        }
      },
      {
        $unwind: '$employee'
      },
      {
        $match: {
          'employee.status': 'active',
          'employee.email': { $ne: null, $exists: true }
        }
      },
      {
        $project: {
          id: '$_id',
          month: 1,
          year: 1,
          status: 1,
          employee_id: '$employee._id',
          name: '$employee.name',
          email: '$employee.email',
          employee_status: '$employee.status'
        }
      }
    ]);

    console.log(`📅 Monthly summary reminders: Found ${summaries.length} DRAFT summaries`);

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];

    for (const summary of summaries) {
      try {
        const monthName = monthNames[summary.month - 1];
        await emailService.sendEmail({
          to: summary.email,
          subject: `Monthly Summary Sign Reminder - ${monthName} ${summary.year}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">Monthly Summary Sign Reminder</h2>
              <p>Hello ${summary.name},</p>
              <p>This is a reminder that your monthly summary for <strong>${monthName} ${summary.year}</strong> is pending your signature.</p>
              <p>Please review and sign your monthly summary using the mobile app.</p>
              <p style="color: #666; font-size: 12px; margin-top: 30px;">
                This is an automated reminder. Please do not reply to this email.
              </p>
            </div>
          `,
        });
        console.log(`✅ Monthly summary reminder sent to ${summary.email} for ${monthName} ${summary.year}`);
      } catch (error) {
        console.error(`❌ Failed to send monthly summary reminder to ${summary.email}:`, error.message);
      }
    }

    return { sent: summaries.length };
  } catch (error) {
    console.error('Error sending monthly summary reminders:', error);
    return { sent: 0, error: error.message };
  }
};

/**
 * Send pending approval reminders to admins
 */
const sendAdminApprovalReminders = async () => {
  try {
    // Get pending monthly summaries
    const pendingMonthlySummaries = await MonthlySummary.countDocuments({
      status: 'SIGNED_BY_STAFF'
    });

    // Get pending leave requests
    const pendingLeaveRequests = await LeaveRequest.countDocuments({
      status: 'pending'
    });

    // Only send if there are pending items
    if (pendingMonthlySummaries === 0 && pendingLeaveRequests === 0) {
      console.log('📅 Admin approval reminders: No pending approvals');
      return { sent: 0, skipped: true };
    }

    // Get all active admins
    const admins = await User.find({
      role: 'ADMIN',
      isActive: { $ne: false }
    }).select('email name').lean();

    console.log(`📅 Admin approval reminders: ${pendingMonthlySummaries} monthly summaries, ${pendingLeaveRequests} leave requests pending`);

    for (const admin of admins) {
      try {
        await emailService.sendEmail({
          to: admin.email,
          subject: 'Pending Approvals Reminder',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">Pending Approvals Reminder</h2>
              <p>Hello ${admin.name || 'Administrator'},</p>
              <p>You have pending items that require your approval:</p>
              
              <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                ${pendingMonthlySummaries > 0 ? `<p><strong>Monthly Summaries:</strong> ${pendingMonthlySummaries} pending approval</p>` : ''}
                ${pendingLeaveRequests > 0 ? `<p><strong>Leave Requests:</strong> ${pendingLeaveRequests} pending approval</p>` : ''}
              </div>
              
              <p>Please log in to the Admin Portal to review and approve these items.</p>
              
              <p style="color: #666; font-size: 12px; margin-top: 30px;">
                This is an automated reminder. Please do not reply to this email.
              </p>
            </div>
          `,
        });
        console.log(`✅ Admin approval reminder sent to ${admin.email}`);
      } catch (error) {
        console.error(`❌ Failed to send admin approval reminder to ${admin.email}:`, error.message);
      }
    }

    return { sent: admins.length, pendingMonthlySummaries, pendingLeaveRequests };
  } catch (error) {
    console.error('Error sending admin approval reminders:', error);
    return { sent: 0, error: error.message };
  }
};

/**
 * Run all reminders
 */
const runAllReminders = async () => {
  console.log('🔄 Running all reminders...');
  const results = {
    checkIn: await sendCheckInReminders(),
    checkOut: await sendCheckOutReminders(),
    monthlySummary: await sendMonthlySummaryReminders(),
    adminApprovals: await sendAdminApprovalReminders(),
  };
  console.log('✅ All reminders completed:', results);
  return results;
};

module.exports = {
  sendCheckInReminders,
  sendCheckOutReminders,
  sendMonthlySummaryReminders,
  sendAdminApprovalReminders,
  runAllReminders,
};

