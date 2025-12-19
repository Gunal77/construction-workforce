const express = require('express');
const reminderService = require('../services/reminderService');
const adminAuthMiddleware = require('../middleware/adminAuthMiddleware');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Manual trigger endpoints (for testing and admin use)
router.post('/check-in', authMiddleware, adminAuthMiddleware, async (req, res) => {
  try {
    const result = await reminderService.sendCheckInReminders();
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error triggering check-in reminders:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/check-out', authMiddleware, adminAuthMiddleware, async (req, res) => {
  try {
    const result = await reminderService.sendCheckOutReminders();
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error triggering check-out reminders:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/monthly-summary', authMiddleware, adminAuthMiddleware, async (req, res) => {
  try {
    const result = await reminderService.sendMonthlySummaryReminders();
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error triggering monthly summary reminders:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/admin-approvals', authMiddleware, adminAuthMiddleware, async (req, res) => {
  try {
    const result = await reminderService.sendAdminApprovalReminders();
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error triggering admin approval reminders:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/all', authMiddleware, adminAuthMiddleware, async (req, res) => {
  try {
    const result = await reminderService.runAllReminders();
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error triggering all reminders:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

