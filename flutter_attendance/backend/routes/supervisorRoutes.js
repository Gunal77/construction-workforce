const express = require('express');
const supervisorAuthMiddleware = require('../middleware/supervisorAuthMiddleware');
const multer = require('multer');

const router = express.Router();

// All routes require supervisor authentication
router.use(supervisorAuthMiddleware);

// GET /supervisor/workers - Get all workers under supervisor
router.get('/workers', async (req, res) => {
  try {
    let supervisorId = req.user.userId || req.user.id || req.user._id;
    supervisorId = supervisorId.toString();

    const ProjectMerged = require('../models/ProjectMerged');
    const EmployeeMerged = require('../models/EmployeeMerged');
    const mongoose = require('mongoose');

    // Get projects assigned to this supervisor
    let projects = await ProjectMerged.find({
      'assigned_supervisors.supervisor_id': supervisorId,
      'assigned_supervisors.status': 'active'
    }).select('_id name location assigned_employees').lean();

    // If no projects found, try with ObjectId
    if (projects.length === 0 && mongoose.Types.ObjectId.isValid(supervisorId) && supervisorId.length === 24) {
      const objectId = new mongoose.Types.ObjectId(supervisorId);
      projects = await ProjectMerged.find({
        'assigned_supervisors.supervisor_id': objectId,
        'assigned_supervisors.status': 'active'
      }).select('_id name location assigned_employees').lean();
    }

    // Get all unique employee IDs from assigned projects
    const employeeIds = new Set();
    const employeeProjectMap = new Map(); // employee_id -> project info
    
    projects.forEach(project => {
      if (project.assigned_employees && Array.isArray(project.assigned_employees)) {
        project.assigned_employees.forEach(emp => {
          if (emp.employee_id && emp.status === 'active') {
            const empId = emp.employee_id.toString();
            employeeIds.add(empId);
            // Store project info for this employee
            if (!employeeProjectMap.has(empId)) {
              employeeProjectMap.set(empId, {
                id: project._id.toString(),
                name: project.name,
                location: project.location
              });
            }
          }
        });
      }
    });

    // Fetch employee details
    const employeeIdsArray = Array.from(employeeIds);
    const employees = await EmployeeMerged.find({
      _id: { $in: employeeIdsArray }
    }).select('_id name email phone role created_at').lean();

    // Combine employee data with project info
    const workers = employees.map(emp => {
      const empId = emp._id.toString();
      const project = employeeProjectMap.get(empId) || null;
      
      return {
        id: empId,
        name: emp.name,
        email: emp.email,
        phone: emp.phone || null,
        role: emp.role || null,
        project_id: project?.id || null,
        created_at: emp.created_at || emp.createdAt,
        project: project,
        assignedAt: null, // Not stored in current schema
      };
    });

    // Sort by name
    workers.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    return res.json({ workers });
  } catch (err) {
    console.error('Get workers error', err);
    return res.status(500).json({ message: 'Error fetching workers' });
  }
});

// GET /supervisor/workers/:id - Get worker details
router.get('/workers/:id', async (req, res) => {
  try {
    let supervisorId = req.user.userId || req.user.id || req.user._id;
    supervisorId = supervisorId.toString();
    const workerId = req.params.id;

    const ProjectMerged = require('../models/ProjectMerged');
    const EmployeeMerged = require('../models/EmployeeMerged');
    const mongoose = require('mongoose');

    // Get projects assigned to this supervisor
    let projects = await ProjectMerged.find({
      'assigned_supervisors.supervisor_id': supervisorId,
      'assigned_supervisors.status': 'active'
    }).select('_id name location assigned_employees').lean();

    // If no projects found, try with ObjectId
    if (projects.length === 0 && mongoose.Types.ObjectId.isValid(supervisorId) && supervisorId.length === 24) {
      const objectId = new mongoose.Types.ObjectId(supervisorId);
      projects = await ProjectMerged.find({
        'assigned_supervisors.supervisor_id': objectId,
        'assigned_supervisors.status': 'active'
      }).select('_id name location assigned_employees').lean();
    }

    // Check if worker is assigned to any of supervisor's projects
    let workerProject = null;
    let isWorkerUnderSupervisor = false;

    for (const project of projects) {
      if (project.assigned_employees && Array.isArray(project.assigned_employees)) {
        const assignment = project.assigned_employees.find(
          emp => emp.employee_id?.toString() === workerId && emp.status === 'active'
        );
        if (assignment) {
          isWorkerUnderSupervisor = true;
          workerProject = {
            id: project._id.toString(),
            name: project.name,
            location: project.location,
          };
          break;
        }
      }
    }

    if (!isWorkerUnderSupervisor) {
      return res.status(403).json({ message: 'Worker not found or access denied' });
    }

    // Get worker details
    const worker = await EmployeeMerged.findById(workerId).lean();

    if (!worker) {
      return res.status(404).json({ message: 'Worker not found' });
    }

    // Format response
    const formattedWorker = {
      id: worker._id.toString(),
      name: worker.name,
      email: worker.email,
      phone: worker.phone || null,
      role: worker.role || null,
      project_id: workerProject?.id || null,
      created_at: worker.created_at || worker.createdAt,
      projects: workerProject,
    };

    return res.json({ worker: formattedWorker });
  } catch (err) {
    console.error('Get worker error', err);
    return res.status(500).json({ message: 'Error fetching worker' });
  }
});

// PUT /supervisor/workers/:id - Update worker details
// REMOVED: Legacy Supabase route - needs MongoDB reimplementation
// router.put('/workers/:id', async (req, res) => {
//   return res.status(501).json({ message: 'This feature requires MongoDB implementation' });
// });

// POST /supervisor/workers/:id/assign-project - Assign worker to project
router.post('/workers/:id/assign-project', async (req, res) => {
  try {
    let supervisorId = req.user.userId || req.user.id || req.user._id;
    supervisorId = supervisorId.toString();
    const workerId = req.params.id;
    const { project_id } = req.body;

    if (!project_id) {
      return res.status(400).json({ message: 'project_id is required' });
    }

    const ProjectMerged = require('../models/ProjectMerged');
    const EmployeeMerged = require('../models/EmployeeMerged');
    const mongoose = require('mongoose');

    console.log(`[Assign Project] Supervisor: ${supervisorId}, Worker: ${workerId}, Project: ${project_id}`);

    // Get supervisor's projects to verify worker access
    let supervisorProjects = await ProjectMerged.find({
      'assigned_supervisors.supervisor_id': supervisorId,
      'assigned_supervisors.status': 'active'
    }).select('_id assigned_employees').lean();

    if (supervisorProjects.length === 0 && mongoose.Types.ObjectId.isValid(supervisorId) && supervisorId.length === 24) {
      const objectId = new mongoose.Types.ObjectId(supervisorId);
      supervisorProjects = await ProjectMerged.find({
        'assigned_supervisors.supervisor_id': objectId,
        'assigned_supervisors.status': 'active'
      }).select('_id assigned_employees').lean();
    }

    // Check if worker is under supervisor's management
    let isWorkerUnderSupervisor = false;
    for (const project of supervisorProjects) {
      if (project.assigned_employees && Array.isArray(project.assigned_employees)) {
        const assignment = project.assigned_employees.find(
          emp => emp.employee_id?.toString() === workerId && emp.status === 'active'
        );
        if (assignment) {
          isWorkerUnderSupervisor = true;
          break;
        }
      }
    }

    if (!isWorkerUnderSupervisor) {
      return res.status(403).json({ message: 'Worker not found or access denied' });
    }

    // Verify target project exists and supervisor has access
    const targetProject = supervisorProjects.find(p => p._id.toString() === project_id);
    if (!targetProject) {
      return res.status(403).json({ message: 'Project not found or access denied' });
    }

    // Check if worker is already assigned to this project
    const existingAssignment = targetProject.assigned_employees?.find(
      emp => emp.employee_id?.toString() === workerId
    );

    if (existingAssignment) {
      if (existingAssignment.status === 'active') {
        return res.status(400).json({ message: 'Worker is already assigned to this project' });
      }
      // Reactivate if previously inactive
      await ProjectMerged.updateOne(
        { _id: project_id, 'assigned_employees.employee_id': workerId },
        { $set: { 'assigned_employees.$.status': 'active', 'assigned_employees.$.assigned_at': new Date() } }
      );
    } else {
      // Get worker details
      const worker = await EmployeeMerged.findById(workerId).lean();
      if (!worker) {
        return res.status(404).json({ message: 'Worker not found' });
      }

      // Add worker to project's assigned_employees
      await ProjectMerged.updateOne(
        { _id: project_id },
        {
          $push: {
            assigned_employees: {
              employee_id: workerId,
              employee_name: worker.name,
              employee_email: worker.email,
              assigned_at: new Date(),
              assigned_by: supervisorId,
              status: 'active',
            }
          }
        }
      );
    }

    // Get updated worker data
    const updatedWorker = await EmployeeMerged.findById(workerId).lean();

    return res.json({ 
      worker: {
        id: updatedWorker._id.toString(),
        name: updatedWorker.name,
        email: updatedWorker.email,
        project_id: project_id,
      },
      message: 'Worker assigned to project successfully' 
    });
  } catch (err) {
    console.error('Assign project error', err);
    return res.status(500).json({ message: 'Error assigning project' });
  }
});

// DELETE /supervisor/workers/:id/remove-project - Remove worker from project
router.delete('/workers/:id/remove-project', async (req, res) => {
  try {
    let supervisorId = req.user.userId || req.user.id || req.user._id;
    supervisorId = supervisorId.toString();
    const workerId = req.params.id;

    const ProjectMerged = require('../models/ProjectMerged');
    const EmployeeMerged = require('../models/EmployeeMerged');
    const mongoose = require('mongoose');

    console.log(`[Remove Project] Supervisor: ${supervisorId}, Worker: ${workerId}`);

    // Get supervisor's projects to verify worker access
    let supervisorProjects = await ProjectMerged.find({
      'assigned_supervisors.supervisor_id': supervisorId,
      'assigned_supervisors.status': 'active'
    }).select('_id assigned_employees').lean();

    if (supervisorProjects.length === 0 && mongoose.Types.ObjectId.isValid(supervisorId) && supervisorId.length === 24) {
      const objectId = new mongoose.Types.ObjectId(supervisorId);
      supervisorProjects = await ProjectMerged.find({
        'assigned_supervisors.supervisor_id': objectId,
        'assigned_supervisors.status': 'active'
      }).select('_id assigned_employees').lean();
    }

    // Check if worker is under supervisor's management and find their project
    let workerProjectId = null;
    for (const project of supervisorProjects) {
      if (project.assigned_employees && Array.isArray(project.assigned_employees)) {
        const assignment = project.assigned_employees.find(
          emp => emp.employee_id?.toString() === workerId && emp.status === 'active'
        );
        if (assignment) {
          workerProjectId = project._id.toString();
          break;
        }
      }
    }

    if (!workerProjectId) {
      return res.status(403).json({ message: 'Worker not found or access denied' });
    }

    // Remove worker from project by setting status to inactive
    await ProjectMerged.updateOne(
      { _id: workerProjectId, 'assigned_employees.employee_id': workerId },
      { $set: { 'assigned_employees.$.status': 'inactive', 'assigned_employees.$.removed_at': new Date() } }
    );

    // Get updated worker data
    const worker = await EmployeeMerged.findById(workerId).lean();

    return res.json({ 
      worker: {
        id: worker._id.toString(),
        name: worker.name,
        email: worker.email,
        project_id: null,
      },
      message: 'Worker removed from project successfully' 
    });
  } catch (err) {
    console.error('Remove project error', err);
    return res.status(500).json({ message: 'Error removing project' });
  }
});

// GET /supervisor/attendance - Get attendance records
router.get('/attendance', async (req, res) => {
  try {
    let supervisorId = req.user.userId || req.user.id || req.user._id;
    supervisorId = supervisorId.toString();
    const { worker_id, date, month, year, start_date, end_date } = req.query;

    const ProjectMerged = require('../models/ProjectMerged');
    const AttendanceMerged = require('../models/AttendanceMerged');
    const EmployeeMerged = require('../models/EmployeeMerged');
    const mongoose = require('mongoose');

    // Get projects assigned to this supervisor
    let projects = await ProjectMerged.find({
      'assigned_supervisors.supervisor_id': supervisorId,
      'assigned_supervisors.status': 'active'
    }).select('_id assigned_employees').lean();

    // If no projects found, try with ObjectId
    if (projects.length === 0 && mongoose.Types.ObjectId.isValid(supervisorId) && supervisorId.length === 24) {
      const objectId = new mongoose.Types.ObjectId(supervisorId);
      projects = await ProjectMerged.find({
        'assigned_supervisors.supervisor_id': objectId,
        'assigned_supervisors.status': 'active'
      }).select('_id assigned_employees').lean();
    }

    // Get all unique employee IDs from assigned projects
    const employeeIds = new Set();
    projects.forEach(project => {
      if (project.assigned_employees && Array.isArray(project.assigned_employees)) {
        project.assigned_employees.forEach(emp => {
          if (emp.employee_id && emp.status === 'active') {
            employeeIds.add(emp.employee_id.toString());
          }
        });
      }
    });

    if (employeeIds.size === 0) {
      return res.json({ attendance: [] });
    }

    const employeeIdsArray = Array.from(employeeIds);

    // Build MongoDB query (use user_id field from AttendanceMerged model)
    const query = {
      user_id: { $in: employeeIdsArray }
    };

    if (worker_id) {
      query.user_id = worker_id.toString();
    }

    // Date filtering
    if (date) {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      query.check_in_time = { $gte: startDate, $lte: endDate };
    } else if (start_date && end_date) {
      const start = new Date(start_date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(end_date);
      end.setHours(23, 59, 59, 999);
      query.check_in_time = { $gte: start, $lte: end };
    } else if (month && year) {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59, 999);
      query.check_in_time = { $gte: start, $lte: end };
    }

    // Fetch attendance records
    const attendanceRecords = await AttendanceMerged.find(query)
      .sort({ check_in_time: -1 })
      .lean();

    // Get employee details for enrichment
    const employeeIdsFromAttendance = [...new Set(attendanceRecords.map(a => a.user_id?.toString() || a.staff_id?.toString()).filter(Boolean))];
    const employees = await EmployeeMerged.find({
      _id: { $in: employeeIdsFromAttendance }
    }).select('_id name email').lean();

    const employeeMap = new Map(employees.map(e => [e._id.toString(), e]));

    // Format attendance records
    const formattedAttendance = attendanceRecords.map(record => {
      const employeeId = record.user_id?.toString() || record.staff_id?.toString();
      const employee = employeeMap.get(employeeId);
      
      return {
        id: record._id?.toString(),
        user_id: employeeId,
        employee_id: employeeId,
        check_in_time: record.check_in_time,
        check_out_time: record.check_out_time || null,
        check_in_location: record.latitude && record.longitude ? {
          latitude: parseFloat(record.latitude.toString()),
          longitude: parseFloat(record.longitude.toString()),
        } : null,
        check_out_location: record.checkout_latitude && record.checkout_longitude ? {
          latitude: parseFloat(record.checkout_latitude.toString()),
          longitude: parseFloat(record.checkout_longitude.toString()),
        } : null,
        check_in_image: record.image_url || null,
        check_out_image: record.checkout_image_url || null,
        status: record.status || 'Present',
        created_at: record.created_at || record.createdAt,
        user: employee ? {
          id: employee._id.toString(),
          email: employee.email,
          name: employee.name
        } : null,
      };
    });

    return res.json({ attendance: formattedAttendance });
  } catch (err) {
    console.error('Get attendance error', err);
    return res.status(500).json({ message: 'Error fetching attendance' });
  }
});

// POST /supervisor/attendance/override - Manual attendance override
// REMOVED: Legacy Supabase route - needs MongoDB reimplementation
// router.post('/attendance/override', async (req, res) => {
//   return res.status(501).json({ message: 'This feature requires MongoDB implementation' });
// });

// GET /supervisor/projects - Get assigned projects
router.get('/projects', async (req, res) => {
  try {
    let supervisorId = req.user.userId || req.user.id || req.user._id;
    supervisorId = supervisorId.toString();

    const ProjectMerged = require('../models/ProjectMerged');
    const mongoose = require('mongoose');

    // Get projects assigned to this supervisor
    let projects = await ProjectMerged.find({
      'assigned_supervisors.supervisor_id': supervisorId,
      'assigned_supervisors.status': 'active'
    }).select('_id name location start_date end_date description budget created_at assigned_supervisors').lean();

    // If no projects found, try with ObjectId
    if (projects.length === 0 && mongoose.Types.ObjectId.isValid(supervisorId) && supervisorId.length === 24) {
      const objectId = new mongoose.Types.ObjectId(supervisorId);
      projects = await ProjectMerged.find({
        'assigned_supervisors.supervisor_id': objectId,
        'assigned_supervisors.status': 'active'
      }).select('_id name location start_date end_date description budget created_at assigned_supervisors').lean();
    }

    // Format projects with assigned_at from embedded data
    const formattedProjects = projects.map(project => {
      const supervisorAssignment = (project.assigned_supervisors || []).find(
        s => s.supervisor_id?.toString() === supervisorId && s.status === 'active'
      );

      return {
        id: project._id.toString(),
        name: project.name,
        location: project.location || null,
        start_date: project.start_date || null,
        end_date: project.end_date || null,
        description: project.description || null,
        budget: project.budget ? parseFloat(project.budget.toString()) : null,
        created_at: project.created_at || project.createdAt || null,
        assignedAt: supervisorAssignment?.assigned_at || null,
      };
    });

    // Sort by assigned_at or created_at (newest first)
    formattedProjects.sort((a, b) => {
      const dateA = a.assignedAt || a.created_at || new Date(0);
      const dateB = b.assignedAt || b.created_at || new Date(0);
      return new Date(dateB) - new Date(dateA);
    });

    return res.json({ projects: formattedProjects });
  } catch (err) {
    console.error('Get projects error', err);
    return res.status(500).json({ message: 'Error fetching projects' });
  }
});

// GET /supervisor/projects/:id - Get project details
router.get('/projects/:id', async (req, res) => {
  try {
    let supervisorId = req.user.userId || req.user.id || req.user._id;
    supervisorId = supervisorId.toString();
    const projectId = req.params.id;

    const ProjectMerged = require('../models/ProjectMerged');
    const mongoose = require('mongoose');

    // Find project and verify supervisor has access
    let project = await ProjectMerged.findById(projectId).lean();

    // If not found by ObjectId, try finding by string match
    if (!project && mongoose.Types.ObjectId.isValid(projectId)) {
      const objectId = new mongoose.Types.ObjectId(projectId);
      project = await ProjectMerged.findOne({ _id: objectId }).lean();
    }

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Check if supervisor is assigned to this project
    const supervisorAssignment = project.assigned_supervisors?.find(
      s => s.supervisor_id?.toString() === supervisorId && s.status === 'active'
    );

    // If no match with string ID, try with ObjectId
    let supervisorObjectId = null;
    if (!supervisorAssignment && mongoose.Types.ObjectId.isValid(supervisorId) && supervisorId.length === 24) {
      supervisorObjectId = new mongoose.Types.ObjectId(supervisorId);
      const altAssignment = project.assigned_supervisors?.find(
        s => s.supervisor_id?.toString() === supervisorObjectId.toString() && s.status === 'active'
      );
      if (!altAssignment) {
        return res.status(403).json({ message: 'Project not found or access denied' });
      }
    } else if (!supervisorAssignment) {
      return res.status(403).json({ message: 'Project not found or access denied' });
    }

    // Format project data
    const formattedProject = {
      id: project._id.toString(),
      name: project.name,
      location: project.location || null,
      start_date: project.start_date || null,
      end_date: project.end_date || null,
      description: project.description || null,
      budget: project.budget ? parseFloat(project.budget.toString()) : null,
      created_at: project.created_at || project.createdAt || null,
      client: project.client || null,
      status: project.status || 'active',
    };

    return res.json({ project: formattedProject });
  } catch (err) {
    console.error('Get project error', err);
    return res.status(500).json({ message: 'Error fetching project' });
  }
});

// GET /supervisor/projects/:id/tasks - Get tasks for a project
// REMOVED: Legacy Supabase route - needs MongoDB reimplementation
// router.get('/projects/:id/tasks', async (req, res) => {
//   return res.status(501).json({ message: 'This feature requires MongoDB implementation' });
// });

// POST /supervisor/projects/:id/tasks - Create task
// REMOVED: Legacy Supabase route - needs MongoDB reimplementation
// router.post('/projects/:id/tasks', async (req, res) => {
//   return res.status(501).json({ message: 'This feature requires MongoDB implementation' });
// });

// PUT /supervisor/tasks/:id - Update task
// REMOVED: Legacy Supabase route - needs MongoDB reimplementation
// router.put('/tasks/:id', async (req, res) => {
//   return res.status(501).json({ message: 'This feature requires MongoDB implementation' });
// });

// POST /supervisor/projects/:id/progress - Update project progress
// REMOVED: Legacy Supabase route - needs MongoDB reimplementation
// const upload = multer({ storage: multer.memoryStorage() });
// router.post('/projects/:id/progress', upload.array('photos', 10), async (req, res) => {
//   return res.status(501).json({ message: 'This feature requires MongoDB implementation' });
// });

// GET /supervisor/dashboard - Get dashboard stats
router.get('/dashboard', async (req, res) => {
  try {
    // Get supervisor ID from token (could be userId or id)
    let supervisorId = req.user.userId || req.user.id || req.user._id;
    
    if (!supervisorId) {
      console.error('[Dashboard] No supervisor ID found in token:', req.user);
      return res.status(401).json({ message: 'Invalid supervisor ID' });
    }
    
    // Convert to string for MongoDB queries
    supervisorId = supervisorId.toString();
    
    console.log(`[Dashboard] Fetching dashboard for supervisor: ${supervisorId}`);

    // MongoDB: Get supervisor's projects and workers
    const ProjectMerged = require('../models/ProjectMerged');
    const EmployeeMerged = require('../models/EmployeeMerged');
    const AttendanceMerged = require('../models/AttendanceMerged');

    // Get projects assigned to this supervisor
    // Try both string and ObjectId matching
    const mongoose = require('mongoose');
    let projects = await ProjectMerged.find({
      'assigned_supervisors.supervisor_id': supervisorId,
      'assigned_supervisors.status': 'active'
    }).select('_id assigned_employees').lean();
    
    // If no projects found, try with ObjectId
    if (projects.length === 0 && mongoose.Types.ObjectId.isValid(supervisorId) && supervisorId.length === 24) {
      const objectId = new mongoose.Types.ObjectId(supervisorId);
      projects = await ProjectMerged.find({
        'assigned_supervisors.supervisor_id': objectId,
        'assigned_supervisors.status': 'active'
      }).select('_id assigned_employees').lean();
    }

    const totalProjects = projects.length;

    // Get all unique employee IDs from assigned projects
    const employeeIds = new Set();
    projects.forEach(project => {
      if (project.assigned_employees && Array.isArray(project.assigned_employees)) {
        project.assigned_employees.forEach(emp => {
          if (emp.employee_id && emp.status === 'active') {
            employeeIds.add(emp.employee_id.toString());
          }
        });
      }
    });

    const totalWorkers = employeeIds.size;

    // Get today's attendance
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let presentToday = 0;
    if (employeeIds.size > 0) {
      const employeeIdsArray = Array.from(employeeIds);
      presentToday = await AttendanceMerged.countDocuments({
        employee_id: { $in: employeeIdsArray },
        check_in_time: {
          $gte: today,
          $lt: tomorrow
        }
      });
    }

    // Get pending tasks (if tasks collection exists)
    // For now, return 0 as tasks might not be implemented yet
    const pendingTasks = 0;

    return res.json({
      totalWorkers: totalWorkers || 0,
      totalProjects: totalProjects || 0,
      presentToday: presentToday || 0,
      pendingTasks: pendingTasks || 0,
    });
  } catch (err) {
    console.error('Get dashboard error', err);
    return res.status(500).json({ message: 'Error fetching dashboard data' });
  }
});

// GET /supervisor/notifications - Get notifications
router.get('/notifications', async (req, res) => {
  try {
    let supervisorId = req.user.userId || req.user.id || req.user._id;
    supervisorId = supervisorId.toString();
    const { is_read, limit = 50 } = req.query;

    // TODO: Implement Notification model for MongoDB
    // For now, return empty array as notifications are not yet implemented in MongoDB
    // This prevents errors while the notification system is being migrated
    
    console.log(`[Notifications] Fetching notifications for supervisor: ${supervisorId}`);
    
    return res.json({ notifications: [] });
  } catch (err) {
    console.error('Get notifications error', err);
    return res.status(500).json({ message: 'Error fetching notifications' });
  }
});

// PUT /supervisor/notifications/:id/read - Mark notification as read
router.put('/notifications/:id/read', async (req, res) => {
  try {
    let supervisorId = req.user.userId || req.user.id || req.user._id;
    supervisorId = supervisorId.toString();
    const notificationId = req.params.id;

    // TODO: Implement Notification model for MongoDB
    // For now, return success as notifications are not yet implemented in MongoDB
    
    console.log(`[Notifications] Marking notification ${notificationId} as read for supervisor: ${supervisorId}`);
    
    return res.json({ 
      notification: { id: notificationId, is_read: true },
      message: 'Notification marked as read' 
    });
  } catch (err) {
    console.error('Update notification error', err);
    return res.status(500).json({ message: 'Error updating notification' });
  }
});

module.exports = router;

