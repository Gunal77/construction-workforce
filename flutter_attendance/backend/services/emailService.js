const nodemailer = require('nodemailer');
const env = require('../config/env');

// Create reusable transporter
let transporter = null;

const getTransporter = () => {
  if (transporter) {
    return transporter;
  }

  // Configure email transporter
  // For production, use SMTP settings from environment variables
  // For development, you can use a service like Gmail, SendGrid, or Mailgun
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER || process.env.EMAIL_FROM,
      pass: process.env.SMTP_PASSWORD || process.env.EMAIL_PASSWORD,
    },
  });

  return transporter;
};

/**
 * Send email notification
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - Email HTML content
 * @param {string} options.text - Email plain text content (optional)
 */
const sendEmail = async ({ to, subject, html, text }) => {
  try {
    // Skip email sending if SMTP is not configured (for development)
    if (!process.env.SMTP_USER && !process.env.EMAIL_FROM) {
      console.log('📧 Email not sent (SMTP not configured):', { to, subject });
      return { success: true, skipped: true };
    }

    const emailTransporter = getTransporter();
    const fromEmail = process.env.EMAIL_FROM || process.env.SMTP_USER || 'noreply@constructionworkforce.com';

    const mailOptions = {
      from: `Construction Workforce <${fromEmail}>`,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''), // Strip HTML for plain text
    };

    const info = await emailTransporter.sendMail(mailOptions);
    console.log('📧 Email sent successfully:', { to, subject, messageId: info.messageId });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Email sending error:', error);
    // Don't throw error - email failures shouldn't break the main flow
    return { success: false, error: error.message };
  }
};

/**
 * Send leave request notification to admin
 */
const sendLeaveRequestNotification = async (leaveRequest, employee) => {
  const subject = `New Leave Request - ${employee.name}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">New Leave Request</h2>
      <p>You have received a new leave request that requires your approval.</p>
      
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <h3 style="margin-top: 0;">Request Details</h3>
        <p><strong>Employee:</strong> ${employee.name} (${employee.email})</p>
        <p><strong>Leave Type:</strong> ${leaveRequest.leave_type_name || 'N/A'}</p>
        <p><strong>From Date:</strong> ${new Date(leaveRequest.start_date).toLocaleDateString()}</p>
        <p><strong>To Date:</strong> ${new Date(leaveRequest.end_date).toLocaleDateString()}</p>
        <p><strong>Total Days:</strong> ${leaveRequest.number_of_days}</p>
        ${leaveRequest.reason ? `<p><strong>Reason:</strong> ${leaveRequest.reason}</p>` : ''}
        ${leaveRequest.stand_in_employee_name ? `<p><strong>Stand-In:</strong> ${leaveRequest.stand_in_employee_name}</p>` : ''}
      </div>
      
      <p>Please log in to the Admin Portal to review and approve this request.</p>
      
      <p style="color: #666; font-size: 12px; margin-top: 30px;">
        This is an automated notification. Please do not reply to this email.
      </p>
    </div>
  `;

  // Get admin emails (all active admins)
  const db = require('../config/db');
  const { rows: admins } = await db.query(
    "SELECT email FROM admins WHERE status = 'active' OR status IS NULL"
  );

  const results = [];
  for (const admin of admins) {
    const result = await sendEmail({
      to: admin.email,
      subject,
      html,
    });
    results.push({ email: admin.email, ...result });
  }

  return results;
};

/**
 * Send leave approval/rejection notification to staff
 */
const sendLeaveStatusNotification = async (leaveRequest, employee, status, adminName, remarks) => {
  const isApproved = status === 'approved';
  const subject = `Leave Request ${isApproved ? 'Approved' : 'Rejected'} - ${employee.name}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: ${isApproved ? '#28a745' : '#dc3545'};">
        Leave Request ${isApproved ? 'Approved' : 'Rejected'}
      </h2>
      <p>Your leave request has been ${isApproved ? 'approved' : 'rejected'} by ${adminName || 'Administrator'}.</p>
      
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <h3 style="margin-top: 0;">Request Details</h3>
        <p><strong>Leave Type:</strong> ${leaveRequest.leave_type_name || 'N/A'}</p>
        <p><strong>From Date:</strong> ${new Date(leaveRequest.start_date).toLocaleDateString()}</p>
        <p><strong>To Date:</strong> ${new Date(leaveRequest.end_date).toLocaleDateString()}</p>
        <p><strong>Total Days:</strong> ${leaveRequest.number_of_days}</p>
        ${remarks ? `<p><strong>Remarks:</strong> ${remarks}</p>` : ''}
      </div>
      
      ${!isApproved ? '<p>If you have any questions, please contact your administrator.</p>' : ''}
      
      <p style="color: #666; font-size: 12px; margin-top: 30px;">
        This is an automated notification. Please do not reply to this email.
      </p>
    </div>
  `;

  return await sendEmail({
    to: employee.email,
    subject,
    html,
  });
};

/**
 * Send monthly summary sign notification to admin
 */
const sendMonthlySummarySignNotification = async (summary, employee) => {
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const monthName = monthNames[summary.month - 1];
  
  const subject = `Monthly Summary Signed - ${employee.name} (${monthName} ${summary.year})`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Monthly Summary Signed by Staff</h2>
      <p>${employee.name} has signed their monthly summary for ${monthName} ${summary.year}.</p>
      
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <h3 style="margin-top: 0;">Summary Details</h3>
        <p><strong>Employee:</strong> ${employee.name} (${employee.email})</p>
        <p><strong>Period:</strong> ${monthName} ${summary.year}</p>
        <p><strong>Total Hours:</strong> ${summary.total_worked_hours || 0}h</p>
        <p><strong>OT Hours:</strong> ${summary.total_ot_hours || 0}h</p>
        <p><strong>Working Days:</strong> ${summary.total_working_days || 0}</p>
        <p><strong>Signed At:</strong> ${new Date(summary.staff_signed_at).toLocaleString()}</p>
      </div>
      
      <p>Please log in to the Admin Portal to review and approve this summary.</p>
      
      <p style="color: #666; font-size: 12px; margin-top: 30px;">
        This is an automated notification. Please do not reply to this email.
      </p>
    </div>
  `;

  // Get admin emails (all active admins)
  const db = require('../config/db');
  const { rows: admins } = await db.query(
    "SELECT email FROM admins WHERE status = 'active' OR status IS NULL"
  );

  const results = [];
  for (const admin of admins) {
    const result = await sendEmail({
      to: admin.email,
      subject,
      html,
    });
    results.push({ email: admin.email, ...result });
  }

  return results;
};

/**
 * Send monthly summary approval/rejection notification to staff
 */
const sendMonthlySummaryStatusNotification = async (summary, employee, status, adminName, remarks) => {
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const monthName = monthNames[summary.month - 1];
  
  const isApproved = status === 'APPROVED';
  const subject = `Monthly Summary ${isApproved ? 'Approved' : 'Rejected'} - ${monthName} ${summary.year}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: ${isApproved ? '#28a745' : '#dc3545'};">
        Monthly Summary ${isApproved ? 'Approved' : 'Rejected'}
      </h2>
      <p>Your monthly summary for ${monthName} ${summary.year} has been ${isApproved ? 'approved' : 'rejected'} by ${adminName || 'Administrator'}.</p>
      
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <h3 style="margin-top: 0;">Summary Details</h3>
        <p><strong>Period:</strong> ${monthName} ${summary.year}</p>
        <p><strong>Total Hours:</strong> ${summary.total_worked_hours || 0}h</p>
        <p><strong>OT Hours:</strong> ${summary.total_ot_hours || 0}h</p>
        <p><strong>Working Days:</strong> ${summary.total_working_days || 0}</p>
        ${remarks ? `<p><strong>Remarks:</strong> ${remarks}</p>` : ''}
        ${isApproved && summary.admin_approved_at ? `<p><strong>Approved At:</strong> ${new Date(summary.admin_approved_at).toLocaleString()}</p>` : ''}
      </div>
      
      ${!isApproved ? '<p>If you have any questions, please contact your administrator.</p>' : ''}
      
      <p style="color: #666; font-size: 12px; margin-top: 30px;">
        This is an automated notification. Please do not reply to this email.
      </p>
    </div>
  `;

  return await sendEmail({
    to: employee.email,
    subject,
    html,
  });
};

module.exports = {
  sendEmail,
  sendLeaveRequestNotification,
  sendLeaveStatusNotification,
  sendMonthlySummarySignNotification,
  sendMonthlySummaryStatusNotification,
};

