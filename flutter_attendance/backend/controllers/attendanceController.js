const crypto = require('crypto');
const { uploadAttendanceImage } = require('../services/uploadService');
const attendanceRepository = require('../repositories/attendanceRepository');
const Attendance = require('../models/AttendanceMerged');
const User = require('../models/User');

const parseCoordinate = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const checkIn = async (req, res) => {
  const userId = req.user.userId;

  try {
    console.log('Check-in request:', {
      userId,
      hasFile: !!req.file,
      latitude: req.body.latitude,
      longitude: req.body.longitude,
    });

    const existing = await attendanceRepository.findActiveByUserId(userId);

    if (existing) {
      return res.status(400).json({ message: 'Active attendance session already exists' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Image file is required for check-in' });
    }

    const latitude = parseCoordinate(req.body.latitude ?? req.body.lat);
    const longitude = parseCoordinate(req.body.longitude ?? req.body.long ?? req.body.lng);

    if (latitude === null || longitude === null) {
      return res.status(400).json({ 
        message: 'Latitude and longitude are required',
        received: {
          latitude: req.body.latitude ?? req.body.lat,
          longitude: req.body.longitude ?? req.body.long ?? req.body.lng,
        }
      });
    }

    console.log('Uploading image for user:', userId);
    const imageUrl = await uploadAttendanceImage(req.file, userId);
    console.log('Image uploaded successfully:', imageUrl);

    const attendanceId = crypto.randomUUID();
    const checkInTime = new Date();
    
    // Set work_date to the date portion (start of day) of check_in_time
    const workDate = new Date(checkInTime);
    workDate.setHours(0, 0, 0, 0);

    console.log('Creating attendance record:', {
      id: attendanceId,
      user_id: userId,
      work_date: workDate.toISOString(),
      check_in_time: checkInTime.toISOString(),
      image_url: imageUrl,
      latitude,
      longitude,
    });

    const attendance = await attendanceRepository.create({
      id: attendanceId,
      user_id: userId,
      work_date: workDate.toISOString(),
      check_in_time: checkInTime.toISOString(),
      image_url: imageUrl,
      latitude,
      longitude,
    });

    console.log('Attendance record created successfully:', attendance?.id);

    return res.status(201).json({
      message: 'Check-in successful',
      attendance,
    });
  } catch (error) {
    console.error('Check-in error:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({ 
      message: 'Failed to check in',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

const checkOut = async (req, res) => {
  const userId = req.user.userId;

  try {
    const existing = await attendanceRepository.findActiveByUserId(userId);

    if (!existing) {
      return res.status(400).json({ message: 'No active attendance session found' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Image file is required for check-out' });
    }

    const latitude = parseCoordinate(req.body.latitude ?? req.body.lat);
    const longitude = parseCoordinate(req.body.longitude ?? req.body.long ?? req.body.lng);

    if (latitude === null || longitude === null) {
      return res.status(400).json({ message: 'Latitude and longitude are required' });
    }

    const attendanceId = existing.id;
    const checkOutTime = new Date().toISOString();
    const checkoutImageUrl = await uploadAttendanceImage(req.file, userId);

    const attendance = await attendanceRepository.update(attendanceId, {
      check_out_time: checkOutTime,
      checkout_image_url: checkoutImageUrl,
      checkout_latitude: latitude,
      checkout_longitude: longitude,
    });

    if (!attendance) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }

    return res.json({
      message: 'Check-out successful',
      attendance,
    });
  } catch (error) {
    console.error('Check-out error', error);
    return res.status(500).json({ 
      message: 'Failed to check out',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

const getMyAttendance = async (req, res) => {
  const userId = req.user.userId;

  try {
    const records = await attendanceRepository.findByUserId(userId, { orderBy: 'check_in_time desc' });
    return res.json({ records });
  } catch (error) {
    console.error('Get attendance error', error);
    return res.status(500).json({ message: 'Failed to fetch attendance records' });
  }
};

const buildAdminFilters = (query) => {
  const conditions = [];
  const values = [];
  let paramIndex = 1;

  if (query.user) {
    conditions.push(`LOWER(u.email) = LOWER($${paramIndex})`);
    values.push(query.user.trim().toLowerCase());
    paramIndex += 1;
  }

  // Handle date range (from/to)
  if (query.from && query.to) {
    const fromDate = new Date(query.from);
    const toDate = new Date(query.to);
    if (!Number.isNaN(fromDate.getTime()) && !Number.isNaN(toDate.getTime())) {
      // Normalize to start of day for 'from' and end of day for 'to'
      const fromDateStr = fromDate.toISOString().split('T')[0];
      const toDateStr = toDate.toISOString().split('T')[0];
      conditions.push(`DATE(al.check_in_time AT TIME ZONE 'UTC') >= $${paramIndex}`);
      values.push(fromDateStr);
      paramIndex += 1;
      conditions.push(`DATE(al.check_in_time AT TIME ZONE 'UTC') <= $${paramIndex}`);
      values.push(toDateStr);
      paramIndex += 1;
    }
  } else if (query.date) {
    // Single date filter (backward compatibility)
    const selectedDate = new Date(query.date);
    if (!Number.isNaN(selectedDate.getTime())) {
      conditions.push(`DATE(al.check_in_time AT TIME ZONE 'UTC') = $${paramIndex}`);
      values.push(selectedDate.toISOString().split('T')[0]);
      paramIndex += 1;
    }
  }

  if (query.month) {
    const monthValue = Number.parseInt(query.month, 10);
    if (!Number.isNaN(monthValue)) {
      conditions.push(`EXTRACT(MONTH FROM al.check_in_time) = $${paramIndex}`);
      values.push(monthValue);
      paramIndex += 1;
    }
  }

  if (query.year) {
    const yearValue = Number.parseInt(query.year, 10);
    if (!Number.isNaN(yearValue)) {
      conditions.push(`EXTRACT(YEAR FROM al.check_in_time) = $${paramIndex}`);
      values.push(yearValue);
      paramIndex += 1;
    }
  }

  return { conditions, values };
};

const getAllAttendance = async (req, res) => {
  try {
    const { sortBy = 'check_in_time', sortOrder = 'desc' } = req.query;

    // MongoDB implementation
    const query = {};
      
      // Build MongoDB query filters
      if (req.query.user) {
        // Find user by email first
        const user = await User.findOne({ email: req.query.user.trim().toLowerCase() }).select('_id');
        if (user) {
          query.user_id = user._id;
        } else {
          // No user found, return empty result
          return res.json({ records: [] });
        }
      }

      // Handle date range (from/to)
      if (req.query.from && req.query.to) {
        const fromDate = new Date(req.query.from);
        const toDate = new Date(req.query.to);
        if (!Number.isNaN(fromDate.getTime()) && !Number.isNaN(toDate.getTime())) {
          // Set to start of day for 'from' and end of day for 'to'
          fromDate.setHours(0, 0, 0, 0);
          toDate.setHours(23, 59, 59, 999);
          query.check_in_time = { $gte: fromDate, $lte: toDate };
        }
      } else if (req.query.date) {
        // Single date filter
        const selectedDate = new Date(req.query.date);
        if (!Number.isNaN(selectedDate.getTime())) {
          const startOfDay = new Date(selectedDate);
          startOfDay.setHours(0, 0, 0, 0);
          const endOfDay = new Date(selectedDate);
          endOfDay.setHours(23, 59, 59, 999);
          query.check_in_time = { $gte: startOfDay, $lte: endOfDay };
        }
      }

      // Handle month filter
      if (req.query.month) {
        const monthValue = Number.parseInt(req.query.month, 10);
        if (!Number.isNaN(monthValue)) {
          const year = req.query.year ? Number.parseInt(req.query.year, 10) : new Date().getFullYear();
          const startDate = new Date(year, monthValue - 1, 1);
          const endDate = new Date(year, monthValue, 0, 23, 59, 59, 999);
          query.check_in_time = { $gte: startDate, $lte: endDate };
        }
      } else if (req.query.year) {
        // Year only filter
        const yearValue = Number.parseInt(req.query.year, 10);
        if (!Number.isNaN(yearValue)) {
          const startDate = new Date(yearValue, 0, 1);
          const endDate = new Date(yearValue, 11, 31, 23, 59, 59, 999);
          query.check_in_time = { $gte: startDate, $lte: endDate };
        }
      }

      // Build sort object
      let sortObj = {};
      if (sortBy === 'check_out_time') {
        sortObj.check_out_time = sortOrder === 'asc' ? 1 : -1;
      } else if (sortBy === 'user') {
        sortObj.user_id = sortOrder === 'asc' ? 1 : -1;
      } else {
        sortObj.check_in_time = sortOrder === 'asc' ? 1 : -1;
      }
      // Secondary sort by created_at
      sortObj.created_at = sortOrder === 'asc' ? 1 : -1;

      // Add LIMIT for dashboard queries
      const hasDateFilter = req.query.date || req.query.from || req.query.to || req.query.month || req.query.year;
      const limit = hasDateFilter ? null : 1000; // Limit to 1000 records if no date filter

      // Fetch attendance records
      let attendanceQuery = Attendance.find(query).sort(sortObj);
      if (limit) {
        attendanceQuery = attendanceQuery.limit(limit);
      }
      const attendanceRecords = await attendanceQuery.exec();

      // Fetch user emails in batch
      const userIds = [...new Set(attendanceRecords.map(r => r.user_id))];
      const users = await User.find({ _id: { $in: userIds } }).select('_id email').lean();
      const userEmailMap = new Map(users.map(u => [u._id, u.email]));

      // Map records and add user_email
      const records = attendanceRecords.map(record => {
        const recordJson = record.toJSON();
        recordJson.user_email = userEmailMap.get(record.user_id) || null;
        return recordJson;
      });

      return res.json({ records });
  } catch (error) {
    console.error('Admin fetch attendance error', error);
    return res.status(500).json({ message: 'Failed to fetch attendance records' });
  }
};

const getLastEndDates = async (req, res) => {
  try {
    const { employeeIds, inactiveDays } = req.query;
    const EmployeeMerged = require('../models/EmployeeMerged');
    const User = require('../models/User');
    const Attendance = require('../models/AttendanceMerged');
    const mongoose = require('mongoose');
    
    // Build employee filter
    let employeeFilter = {};
    if (employeeIds) {
      const ids = Array.isArray(employeeIds) ? employeeIds : employeeIds.split(',');
      // Convert to ObjectIds if valid
      const objectIds = ids.map(id => {
        if (mongoose.Types.ObjectId.isValid(id)) {
          return new mongoose.Types.ObjectId(id);
        }
        return id;
      });
      employeeFilter._id = { $in: objectIds };
    }
    
    // Get all employees
    const employees = await EmployeeMerged.find(employeeFilter)
      .select('_id name email user_id')
      .lean();
    
    // Get user IDs from employees
    const userIds = employees
      .map(emp => emp.user_id)
      .filter(Boolean);
    
    // Get all attendance records with check_out_time for these users
    const attendanceRecords = await Attendance.find({
      user_id: { $in: userIds },
      check_out_time: { $ne: null }
    })
      .select('user_id check_out_time')
      .sort({ check_out_time: -1 })
      .lean();
    
    // Group by user_id and get max check_out_time
    const lastEndDatesMap = new Map();
    attendanceRecords.forEach(record => {
      const userId = record.user_id?.toString();
      if (userId) {
        const currentMax = lastEndDatesMap.get(userId);
        if (!currentMax || new Date(record.check_out_time) > new Date(currentMax)) {
          lastEndDatesMap.set(userId, record.check_out_time);
        }
      }
    });
    
    // Build result array
    const results = employees.map(employee => {
      const userId = employee.user_id?.toString();
      const lastEndDate = userId ? lastEndDatesMap.get(userId) : null;
      
      return {
        employee_id: employee._id.toString(),
        employee_name: employee.name,
        employee_email: employee.email,
        last_end_date: lastEndDate ? new Date(lastEndDate).toISOString() : null,
      };
    });
    
    // Filter by inactiveDays if provided
    let filteredResults = results;
    if (inactiveDays) {
      const days = parseInt(inactiveDays, 10);
      if (!isNaN(days)) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        
        filteredResults = results.filter(result => {
          if (!result.last_end_date) {
            return true; // Include employees with no attendance
          }
          return new Date(result.last_end_date) < cutoffDate;
        });
      }
    }
    
    // Sort by last_end_date DESC, NULLS LAST
    filteredResults.sort((a, b) => {
      if (!a.last_end_date && !b.last_end_date) return 0;
      if (!a.last_end_date) return 1; // NULL goes last
      if (!b.last_end_date) return -1; // NULL goes last
      return new Date(b.last_end_date) - new Date(a.last_end_date);
    });
    
    return res.json({ lastEndDates: filteredResults });
  } catch (error) {
    console.error('Get last end dates error', error);
    return res.status(500).json({ message: 'Failed to fetch last end dates' });
  }
};

module.exports = {
  checkIn,
  checkOut,
  getMyAttendance,
  getAllAttendance,
  getLastEndDates,
};

