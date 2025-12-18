const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabaseClient');
const { verifyToken } = require('../utils/jwt');
const db = require('../config/db');

// Middleware to verify client authentication
const clientAuthMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');

  if (!token || scheme !== 'Bearer') {
    return res.status(401).json({ message: 'Authorization header missing or malformed' });
  }

  try {
    const decoded = verifyToken(token);

    if (decoded.role !== 'client') {
      return res.status(403).json({ message: 'Client privileges required' });
    }

    req.client = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
    };
    return next();
  } catch (error) {
    if (error.name !== 'JsonWebTokenError' || error.message !== 'invalid signature') {
      console.error('Client auth error', error.name, error.message);
    }
    return res.status(401).json({ 
      message: error.name === 'TokenExpiredError' 
        ? 'Token expired. Please log in again.' 
        : error.name === 'JsonWebTokenError' && error.message === 'invalid signature'
        ? 'Invalid token. Please log out and log in again.'
        : 'Invalid or expired token' 
    });
  }
};

// All routes require client authentication
router.use(clientAuthMiddleware);

// GET /api/client/attendance - Get attendance records for client's projects
router.get('/', async (req, res) => {
  try {
    const clientUserId = req.client.id;

    const { sortBy = 'check_in_time', sortOrder = 'desc', date, from, to, employeeId, projectId } = req.query;

    // Get all projects for this client
    const { data: clientProjects, error: projectsError } = await supabase
      .from('projects')
      .select('id')
      .eq('client_user_id', clientUserId);

    if (projectsError) {
      console.error('Error fetching client projects:', projectsError);
      return res.status(500).json({ message: 'Failed to fetch client projects' });
    }

    if (!clientProjects || clientProjects.length === 0) {
      return res.json({ records: [] });
    }

    const projectIds = clientProjects.map(p => p.id);

    // Get all employees assigned to these projects (from both project_employees and direct assignment)
    // Use a SQL query to get employee emails efficiently
    // IMPORTANT: Only get employees assigned to THIS client's projects
    const { rows: employeeData } = await db.query(
      `SELECT DISTINCT e.id, e.email, e.name, e.role
       FROM employees e
       WHERE (
         e.project_id = ANY($1)
         OR e.id IN (
           SELECT employee_id FROM project_employees 
           WHERE project_id = ANY($1) AND status = 'active'
         )
       )
       -- Ensure project belongs to this client (double-check security)
       AND (
         e.project_id IN (SELECT id FROM projects WHERE client_user_id = $2)
         OR e.id IN (
           SELECT pe.employee_id FROM project_employees pe
           JOIN projects p ON p.id = pe.project_id
           WHERE pe.project_id = ANY($1) AND pe.status = 'active' AND p.client_user_id = $2
         )
       )`,
      [projectIds, clientUserId]
    );

    if (!employeeData || employeeData.length === 0) {
      return res.json({ records: [] });
    }

    const employeeEmails = employeeData.map(e => e.email).filter(Boolean);

    if (employeeEmails.length === 0) {
      return res.json({ records: [] });
    }

    // Get user IDs from users table
    const { rows: users } = await db.query(
      `SELECT id, email FROM users WHERE email = ANY($1)`,
      [employeeEmails]
    );

    if (!users || users.length === 0) {
      return res.json({ records: [] });
    }

    const userIds = users.map(u => u.id);
    const employeeMap = new Map(employeeData.map(e => [e.email, e]));

    // Build query for attendance records
    const values = [userIds, clientUserId];
    let paramIndex = 3;

    let query = `
      SELECT
        al.id,
        al.user_id,
        al.check_in_time,
        al.check_out_time,
        al.image_url,
        al.latitude,
        al.longitude,
        u.email AS user_email,
        COALESCE(e.name, u.email) AS employee_name,
        e.role AS employee_role,
        COALESCE(
          (SELECT p.id FROM projects p 
           WHERE p.id = e.project_id AND p.client_user_id = $2),
          (SELECT p.id FROM project_employees pe
           JOIN projects p ON p.id = pe.project_id
           WHERE pe.employee_id = e.id AND pe.status = 'active' AND p.client_user_id = $2
           LIMIT 1)
        ) AS project_id,
        COALESCE(
          (SELECT p.name FROM projects p 
           WHERE p.id = e.project_id AND p.client_user_id = $2),
          (SELECT p.name FROM project_employees pe
           JOIN projects p ON p.id = pe.project_id
           WHERE pe.employee_id = e.id AND pe.status = 'active' AND p.client_user_id = $2
           LIMIT 1)
        ) AS project_name
      FROM attendance_logs al
      LEFT JOIN users u ON u.id = al.user_id
      LEFT JOIN employees e ON e.email = u.email
      WHERE al.user_id = ANY($1)
    `;

    // Filter by project
    if (projectId) {
      query += ` AND (
        (SELECT p.id FROM projects p WHERE p.id = e.project_id AND p.client_user_id = $2) = $${paramIndex}
        OR (SELECT p.id FROM project_employees pe JOIN projects p ON p.id = pe.project_id 
            WHERE pe.employee_id = e.id AND pe.status = 'active' AND p.client_user_id = $2 LIMIT 1) = $${paramIndex}
      )`;
      values.push(projectId);
      paramIndex += 1;
    }

    // Filter by employee
    if (employeeId) {
      const emp = employeeData.find(e => e.id === employeeId);
      if (emp && emp.email) {
        const user = users.find(u => u.email === emp.email);
        if (user) {
          query += ` AND al.user_id = $${paramIndex}`;
          values.push(user.id);
          paramIndex += 1;
        }
      }
    }

    // Date filters
    if (from && to) {
      query += ` AND DATE(al.check_in_time) >= $${paramIndex} AND DATE(al.check_in_time) <= $${paramIndex + 1}`;
      values.push(from, to);
      paramIndex += 2;
    } else if (date) {
      query += ` AND DATE(al.check_in_time) = $${paramIndex}`;
      values.push(date);
      paramIndex += 1;
    }

    // Order by
    const orderColumn = sortBy === 'check_out_time' ? 'al.check_out_time' : 'al.check_in_time';
    const normalizedSortOrder = sortOrder?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    query += ` ORDER BY ${orderColumn} ${normalizedSortOrder}`;

    const { rows } = await db.query(query, values);

    return res.json({ records: rows });
  } catch (error) {
    console.error('Get client attendance error:', error);
    return res.status(500).json({ message: 'Failed to fetch attendance records', error: error.message });
  }
});

module.exports = router;

