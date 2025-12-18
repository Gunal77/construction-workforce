const crypto = require('crypto');
const db = require('../config/db');
const { uploadAttendanceImage } = require('../services/uploadService');

const parseCoordinate = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const checkIn = async (req, res) => {
  const userId = req.user.id;

  try {
    const existing = await db.query(
      `SELECT id FROM attendance_logs
       WHERE user_id = $1 AND check_out_time IS NULL
       ORDER BY check_in_time DESC
       LIMIT 1`,
      [userId],
    );

    if (existing.rows.length) {
      return res.status(400).json({ message: 'Active attendance session already exists' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Image file is required for check-in' });
    }

    const latitude = parseCoordinate(req.body.latitude ?? req.body.lat);
    const longitude = parseCoordinate(req.body.longitude ?? req.body.long ?? req.body.lng);

    if (latitude === null || longitude === null) {
      return res.status(400).json({ message: 'Latitude and longitude are required' });
    }

    const imageUrl = await uploadAttendanceImage(req.file, userId);
    const attendanceId = crypto.randomUUID();
    const checkInTime = new Date().toISOString();

    const { rows } = await db.query(
      `INSERT INTO attendance_logs
        (id, user_id, check_in_time, image_url, latitude, longitude)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, user_id, check_in_time, image_url, latitude, longitude`,
      [attendanceId, userId, checkInTime, imageUrl, latitude, longitude],
    );

    return res.status(201).json({
      message: 'Check-in successful',
      attendance: rows[0],
    });
  } catch (error) {
    console.error('Check-in error', error);
    return res.status(500).json({ message: 'Failed to check in' });
  }
};

const checkOut = async (req, res) => {
  const userId = req.user.id;

  try {
    const { rows } = await db.query(
      `SELECT id, check_in_time
         FROM attendance_logs
        WHERE user_id = $1 AND check_out_time IS NULL
        ORDER BY check_in_time DESC
        LIMIT 1`,
      [userId],
    );

    if (!rows.length) {
      return res.status(400).json({ message: 'No active attendance session found' });
    }

    const attendanceId = rows[0].id;
    const checkOutTime = new Date().toISOString();

    const result = await db.query(
      `UPDATE attendance_logs
          SET check_out_time = $1
        WHERE id = $2
        RETURNING id, user_id, check_in_time, check_out_time, image_url, latitude, longitude`,
      [checkOutTime, attendanceId],
    );

    return res.json({
      message: 'Check-out successful',
      attendance: result.rows[0],
    });
  } catch (error) {
    console.error('Check-out error', error);
    return res.status(500).json({ message: 'Failed to check out' });
  }
};

const getMyAttendance = async (req, res) => {
  const userId = req.user.id;

  try {
    const { rows } = await db.query(
      `SELECT id, user_id, check_in_time, check_out_time, image_url, latitude, longitude
         FROM attendance_logs
        WHERE user_id = $1
        ORDER BY check_in_time DESC`,
      [userId],
    );

    return res.json({ records: rows });
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
    const { conditions, values } = buildAdminFilters(req.query);

    const orderColumn =
      sortBy === 'user'
        ? 'u.email'
        : sortBy === 'check_out_time'
          ? 'al.check_out_time'
          : 'al.check_in_time';
    const normalizedSortOrder = sortOrder?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // Add LIMIT for dashboard queries to improve performance
    // If no date filter, limit to last 30 days for dashboard performance
    const hasDateFilter = req.query.date || req.query.from || req.query.to || req.query.month || req.query.year;
    const limitClause = hasDateFilter ? '' : 'LIMIT 1000'; // Limit to 1000 records if no date filter

    const query = `
      SELECT
        al.id,
        al.user_id,
        al.check_in_time,
        al.check_out_time,
        al.image_url,
        al.latitude,
        al.longitude,
        u.email AS user_email
      FROM attendance_logs al
      LEFT JOIN users u ON u.id = al.user_id
      ${whereClause}
      ORDER BY ${orderColumn} ${normalizedSortOrder}, al.created_at ${normalizedSortOrder}
      ${limitClause}
    `;

    const { rows } = await db.query(query, values);

    return res.json({ records: rows });
  } catch (error) {
    console.error('Admin fetch attendance error', error);
    return res.status(500).json({ message: 'Failed to fetch attendance records' });
  }
};

const getLastEndDates = async (req, res) => {
  try {
    const { employeeIds, inactiveDays } = req.query;
    
    let query = `
      SELECT 
        e.id AS employee_id,
        e.name AS employee_name,
        e.email AS employee_email,
        MAX(al.check_out_time) AS last_end_date
      FROM employees e
      LEFT JOIN users u ON u.email = e.email
      LEFT JOIN attendance_logs al ON al.user_id = u.id AND al.check_out_time IS NOT NULL
    `;
    
    const conditions = [];
    const values = [];
    let paramIndex = 1;
    
    if (employeeIds) {
      const ids = Array.isArray(employeeIds) ? employeeIds : employeeIds.split(',');
      conditions.push(`e.id = ANY($${paramIndex})`);
      values.push(ids);
      paramIndex += 1;
    }
    
    if (inactiveDays) {
      const days = parseInt(inactiveDays, 10);
      if (!isNaN(days)) {
        conditions.push(`(MAX(al.check_out_time) IS NULL OR MAX(al.check_out_time) < CURRENT_DATE - INTERVAL '${days} days')`);
      }
    }
    
    query += ` GROUP BY e.id, e.name, e.email`;
    
    if (conditions.length > 0) {
      // For inactiveDays filter, we need HAVING clause
      if (inactiveDays) {
        query += ` HAVING (MAX(al.check_out_time) IS NULL OR MAX(al.check_out_time) < CURRENT_DATE - INTERVAL '${inactiveDays} days')`;
      }
      // For employeeIds, we need WHERE clause
      if (employeeIds) {
        query = query.replace('GROUP BY', `WHERE ${conditions[0]} GROUP BY`);
      }
    }
    
    query += ` ORDER BY last_end_date DESC NULLS LAST`;
    
    const { rows } = await db.query(query, values);
    
    return res.json({ lastEndDates: rows });
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

