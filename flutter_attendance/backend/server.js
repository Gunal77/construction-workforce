const express = require('express');
const multer = require('multer');
const env = require('./config/env');
const { initializeDatabase } = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const adminAuthRoutes = require('./routes/adminAuth');
const supervisorAuthRoutes = require('./routes/supervisorAuth');
const unifiedAuthRoutes = require('./routes/unifiedAuth'); // NEW: Unified authentication
const supervisorRoutes = require('./routes/supervisorRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const leaveRoutes = require('./routes/leaveRoutes');
const timesheetRoutes = require('./routes/timesheetRoutes');
const adminProjectsRoutes = require('./routes/adminProjects');
const adminEmployeesRoutes = require('./routes/adminEmployees');
const adminClientsRoutes = require('./routes/adminClients');
const adminStaffsRoutes = require('./routes/adminStaffs');
const adminSupervisorsRoutes = require('./routes/adminSupervisors');
const projectEmployeesRoutes = require('./routes/projectEmployees');
const clientProjectsRoutes = require('./routes/clientProjects');
const clientAuthRoutes = require('./routes/clientAuth');
const clientStaffsRoutes = require('./routes/clientStaffs');
const clientAttendanceRoutes = require('./routes/clientAttendance');
const clientSupervisorsRoutes = require('./routes/clientSupervisors');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/v2/auth', unifiedAuthRoutes); // NEW: Unified authentication endpoint
app.use(['/api/admin/auth', '/admin/auth'], adminAuthRoutes); // Legacy
app.use(['/api/supervisor/auth', '/supervisor/auth'], supervisorAuthRoutes); // Legacy
app.use(['/api/supervisor', '/supervisor'], supervisorRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leave', leaveRoutes);
app.use('/api/timesheets', timesheetRoutes);
// Register employee assignment routes first (more specific routes)
app.use(['/api/admin/projects', '/admin/projects'], projectEmployeesRoutes);
app.use(['/api/admin/projects', '/admin/projects'], adminProjectsRoutes);
app.use(['/api/admin/employees', '/admin/employees'], adminEmployeesRoutes);
app.use(['/api/admin/clients', '/admin/clients'], adminClientsRoutes);
app.use(['/api/admin/staffs', '/admin/staffs'], adminStaffsRoutes);
app.use(['/api/admin/supervisors', '/admin/supervisors'], adminSupervisorsRoutes);
app.use(['/api/client/projects', '/client/projects'], clientProjectsRoutes);
app.use(['/api/client', '/client'], clientAuthRoutes);
app.use(['/api/client/staffs', '/client/staffs'], clientStaffsRoutes);
app.use(['/api/client/attendance', '/client/attendance'], clientAttendanceRoutes);
app.use(['/api/client/supervisors', '/client/supervisors'], clientSupervisorsRoutes);

// Not found handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Centralized error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error', err);

  if (err instanceof multer.MulterError) {
    return res.status(400).json({ message: err.message });
  }

  if (err?.message === 'Only image files are allowed') {
    return res.status(400).json({ message: err.message });
  }

  const status = err.status || 500;
  return res.status(status).json({ message: err.message || 'Internal server error' });
});

const startServer = async () => {
  try {
    await initializeDatabase();
    app.listen(env.port, () => {
      console.log(`Server listening on port ${env.port}`);
    });
  } catch (error) {
    console.error('Failed to start server', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;

