const express = require('express');
const multer = require('multer');
const path = require('path');
const attendanceController = require('../controllers/attendanceController');
const authMiddleware = require('../middleware/authMiddleware');
const adminAuthMiddleware = require('../middleware/adminAuthMiddleware');

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
router.get('/me', authMiddleware, attendanceController.getMyAttendance);
router.get('/admin/all', adminAuthMiddleware, attendanceController.getAllAttendance);
router.get('/admin/last-end-dates', adminAuthMiddleware, attendanceController.getLastEndDates);

module.exports = router;

