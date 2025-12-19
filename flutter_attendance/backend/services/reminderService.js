const db = require('../config/db');
const emailService = require('./emailService');

/**
 * Send daily check-in reminder to staff who haven't checked in
 */
const sendCheckInReminders = async () => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    // Find employees who haven't checked in today
    const query = `
      SELECT DISTINCT
        e.id,
        e.name,
        e.email,
        e.status
      FROM employees e
      WHERE e.status = 'active'
        AND e.email IS NOT NULL
        AND e.id NOT IN (
          SELECT DISTINCT employee_id
          FROM attendance_logs
          WHERE DATE(check_in_time) = $1
            AND check_in_time IS NOT NULL
        )
    `;

    const { rows: employees } = await db.query(query, [todayStr]);

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
    const query = `
      SELECT DISTINCT
        e.id,
        e.name,
        e.email,
        al.check_in_time
      FROM employees e
      INNER JOIN attendance_logs al ON al.employee_id = e.id
      WHERE e.status = 'active'
        AND e.email IS NOT NULL
        AND DATE(al.check_in_time) = $1
        AND al.check_out_time IS NULL
        AND al.check_in_time IS NOT NULL
    `;

    const { rows: employees } = await db.query(query, [todayStr]);

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
    const query = `
      SELECT DISTINCT
        ms.id,
        ms.month,
        ms.year,
        ms.status,
        e.id as employee_id,
        e.name,
        e.email,
        e.status as employee_status
      FROM monthly_summaries ms
      INNER JOIN employees e ON e.id = ms.employee_id
      WHERE ms.status = 'DRAFT'
        AND e.status = 'active'
        AND e.email IS NOT NULL
        AND (
          (ms.year = $1 AND ms.month = $2) OR
          (ms.year = $1 AND ms.month = $2 - 1) OR
          (ms.year = $1 - 1 AND ms.month = 12 AND $2 = 1)
        )
    `;

    const { rows: summaries } = await db.query(query, [currentYear, currentMonth]);

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
    const monthlySummaryQuery = `
      SELECT COUNT(*) as count
      FROM monthly_summaries
      WHERE status = 'SIGNED_BY_STAFF'
    `;
    const { rows: monthlyRows } = await db.query(monthlySummaryQuery);
    const pendingMonthlySummaries = parseInt(monthlyRows[0].count) || 0;

    // Get pending leave requests
    const leaveRequestQuery = `
      SELECT COUNT(*) as count
      FROM leave_requests
      WHERE status = 'pending'
    `;
    const { rows: leaveRows } = await db.query(leaveRequestQuery);
    const pendingLeaveRequests = parseInt(leaveRows[0].count) || 0;

    // Only send if there are pending items
    if (pendingMonthlySummaries === 0 && pendingLeaveRequests === 0) {
      console.log('📅 Admin approval reminders: No pending approvals');
      return { sent: 0, skipped: true };
    }

    // Get all active admins
    const { rows: admins } = await db.query(
      "SELECT email, name FROM admins WHERE status = 'active' OR status IS NULL"
    );

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

