const express = require('express');
const multer = require('multer');
const path = require('path');
const attendanceController = require('../controllers/attendanceController');
const authMiddleware = require('../middleware/authMiddleware');
const authorizeRoles = require('../middleware/authorizeRoles');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const mimetype = file.mimetype || '';
    const extension = path.extname(file.originalname || '').toLowerCase();
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif'];

    if (mimetype.startsWith('image/') || allowedExtensions.includes(extension)) {
      return cb(null, true);
    }

    return cb(new Error('Only image files are allowed'));
  },
});

router.post(
  '/check-in',
  authMiddleware,
  upload.single('image'),
  attendanceController.checkIn,
);

router.post(
  '/check-out',
  authMiddleware,
  upload.single('image'),
  attendanceController.checkOut,
);
// Worker routes - view own attendance
router.get('/me', authMiddleware, attendanceController.getMyAttendance);

// Admin/Supervisor routes - view all attendance
router.get('/admin/all', authMiddleware, authorizeRoles('ADMIN', 'SUPERVISOR'), attendanceController.getAllAttendance);
router.get('/admin/last-end-dates', authMiddleware, authorizeRoles('ADMIN', 'SUPERVISOR'), attendanceController.getLastEndDates);

module.exports = router;

