const cron = require('node-cron');
const reminderService = require('./reminderService');

let isSchedulerRunning = false;

/**
 * Start the reminder scheduler
 */
const startScheduler = () => {
  if (isSchedulerRunning) {
    console.log('⚠️ Scheduler is already running');
    return;
  }

  console.log('🕐 Starting reminder scheduler...');

  // Daily check-in reminders at 9 AM
  cron.schedule('0 9 * * *', async () => {
    console.log('📅 Running check-in reminders...');
    await reminderService.sendCheckInReminders();
  }, {
    scheduled: true,
    timezone: 'Asia/Singapore', // Adjust timezone as needed
  });

  // Daily check-out reminders at 6 PM
  cron.schedule('0 18 * * *', async () => {
    console.log('📅 Running check-out reminders...');
    await reminderService.sendCheckOutReminders();
  }, {
    scheduled: true,
    timezone: 'Asia/Singapore',
  });

  // Monthly summary reminders every Monday at 10 AM
  cron.schedule('0 10 * * 1', async () => {
    console.log('📅 Running monthly summary reminders...');
    await reminderService.sendMonthlySummaryReminders();
  }, {
    scheduled: true,
    timezone: 'Asia/Singapore',
  });

  // Admin approval reminders every day at 11 AM
  cron.schedule('0 11 * * *', async () => {
    console.log('📅 Running admin approval reminders...');
    await reminderService.sendAdminApprovalReminders();
  }, {
    scheduled: true,
    timezone: 'Asia/Singapore',
  });

  isSchedulerRunning = true;
  console.log('✅ Reminder scheduler started');
};

/**
 * Stop the reminder scheduler
 */
const stopScheduler = () => {
  if (!isSchedulerRunning) {
    console.log('⚠️ Scheduler is not running');
    return;
  }

  // Note: node-cron doesn't have a built-in stop all method
  // In production, you might want to store task references and destroy them
  console.log('⏹️ Stopping reminder scheduler...');
  isSchedulerRunning = false;
};

/**
 * Get scheduler status
 */
const getSchedulerStatus = () => {
  return {
    running: isSchedulerRunning,
    schedules: [
      { name: 'Check-in reminders', schedule: 'Daily at 9:00 AM' },
      { name: 'Check-out reminders', schedule: 'Daily at 6:00 PM' },
      { name: 'Monthly summary reminders', schedule: 'Every Monday at 10:00 AM' },
      { name: 'Admin approval reminders', schedule: 'Daily at 11:00 AM' },
    ],
  };
};

module.exports = {
  startScheduler,
  stopScheduler,
  getSchedulerStatus,
};

