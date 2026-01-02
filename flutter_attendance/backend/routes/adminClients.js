const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const authMiddleware = require('../middleware/authMiddleware');
const authorizeRoles = require('../middleware/authorizeRoles');

// All routes require authentication and ADMIN role
router.use(authMiddleware);
router.use(authorizeRoles('ADMIN'));

// GET all clients
router.get('/', async (req, res) => {
  try {
    const { search, isActive, sortBy = 'created_at', sortOrder = 'DESC' } = req.query;
    
    const User = require('../models/User');
    const ProjectMerged = require('../models/ProjectMerged');
    const EmployeeMerged = require('../models/EmployeeMerged');
    
    // Build MongoDB query
    const query = { role: { $in: ['CLIENT', 'client'] } };
    
    // Search filter
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { phone: searchRegex }
      ];
    }
    
    // Active filter - User model uses 'isActive' (camelCase)
    // When filtering for active, include clients where isActive is true, undefined, or null (defaults to active)
    // When filtering for inactive, only include clients where isActive is explicitly false
    if (isActive !== undefined && isActive !== null && isActive !== '') {
      const isActiveBool = isActive === 'true' || isActive === true || isActive === 1;
      if (isActiveBool) {
        // For active: include true, undefined, or null (defaults to active)
        // Combine with existing $or if search filter exists
        if (query.$or) {
          // If search filter exists, we need to use $and to combine both conditions
          const searchOr = [...query.$or]; // Copy the search $or conditions
          query.$and = [
            { $or: searchOr },
            {
              $or: [
                { isActive: true },
                { isActive: { $exists: false } },
                { isActive: null }
              ]
            }
          ];
          delete query.$or;
        } else {
          query.$or = [
            { isActive: true },
            { isActive: { $exists: false } },
            { isActive: null }
          ];
        }
      } else {
        // For inactive: only explicitly false
        query.isActive = false;
      }
    }
    
    // Validate sortBy
    const allowedSortColumns = ['name', 'email', 'created_at', 'updated_at'];
    const safeSort = allowedSortColumns.includes(sortBy) ? sortBy : 'created_at';
    const sortDirection = sortOrder.toUpperCase() === 'ASC' ? 1 : -1;
    const sort = { [safeSort]: sortDirection };
    
    // Fetch clients
    const clients = await User.find(query).sort(sort).lean();
    
    // Get counts for each client using aggregation
    const clientsWithCounts = await Promise.all(
      clients.map(async (client) => {
        const clientId = client._id.toString();
        
        // Count projects - use 'client.client_id' (nested field) not 'client_user_id'
        const projectCount = await ProjectMerged.countDocuments({
          'client.client_id': clientId
        });
        
        // Count supervisors (users with role SUPERVISOR assigned to client's projects)
        const supervisorCount = await User.countDocuments({
          role: { $in: ['SUPERVISOR', 'supervisor'] },
          _id: { $in: await ProjectMerged.distinct('assigned_supervisors.supervisor_id', {
            'client.client_id': clientId
          }) }
        });
        
        // Count staff (employees assigned to client's projects)
        const staffCount = await EmployeeMerged.countDocuments({
          $or: [
            { client_user_id: clientId },
            { 'project_assignments.project_id': { $in: await ProjectMerged.distinct('_id', {
              'client.client_id': clientId
            }) } }
          ]
        });
        
        return {
          id: client._id.toString(),
          name: client.name,
          email: client.email,
          phone: client.phone,
          // User model uses 'isActive', but API returns 'is_active' for consistency
          is_active: client.isActive === true || client.isActive === undefined || client.isActive === null ? true : false,
          created_at: client.createdAt,
          project_count: projectCount,
          supervisor_count: supervisorCount,
          staff_count: staffCount
        };
      })
    );
    
    res.json({
      success: true,
      data: clientsWithCounts,
      count: clientsWithCounts.length
    });
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch clients',
      message: error.message
    });
  }
});

// GET client by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const mongoose = require('mongoose');
    
    const User = require('../models/User');
    const ProjectMerged = require('../models/ProjectMerged');
    const EmployeeMerged = require('../models/EmployeeMerged');
    
    if (!id || id.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Invalid client ID format'
      });
    }
    
    const clientId = id.trim();
    
    // Try to find client - handle both string UUIDs and MongoDB ObjectIds
    let client = await User.findOne({
      _id: clientId,
      role: { $in: ['CLIENT', 'client'] }
    }).lean();
    
    // If not found and ID looks like MongoDB ObjectId (24 hex chars), try with ObjectId
    if (!client && mongoose.Types.ObjectId.isValid(clientId) && clientId.length === 24) {
      try {
        const objectId = new mongoose.Types.ObjectId(clientId);
        // Query using the native collection to handle ObjectId _id
        const UserCollection = User.collection;
        const doc = await UserCollection.findOne({
          _id: objectId,
          role: { $in: ['CLIENT', 'client'] }
        });
        if (doc) {
          // Convert to plain object
          client = User.hydrate(doc).toObject();
        }
      } catch (err) {
        console.log(`[GET CLIENT] Could not convert to ObjectId: ${err.message}`);
      }
    }
    
    if (!client) {
      return res.status(404).json({
        success: false,
        error: 'Client not found'
      });
    }
    
    // Fetch associated projects - use 'client.client_id' (nested field) not 'client_user_id'
    const projects = await ProjectMerged.find({
      'client.client_id': clientId
    }).sort({ created_at: -1 }).lean();
    
    console.log(`[Client ${clientId}] Found ${projects.length} projects assigned to this client`);
    
    // Fetch associated supervisors (from projects' assigned_supervisors)
    const supervisorIds = [];
    projects.forEach(project => {
      if (project.assigned_supervisors && Array.isArray(project.assigned_supervisors)) {
        // Extract supervisor_id from each supervisor object
        project.assigned_supervisors.forEach(sup => {
          if (sup.supervisor_id) {
            supervisorIds.push(sup.supervisor_id);
          }
        });
      }
    });
    
    // User model uses string _id, so convert all supervisor IDs to strings
    const uniqueSupervisorIds = [...new Set(supervisorIds.map(id => String(id).trim()))];
    const supervisors = await User.find({
      _id: { $in: uniqueSupervisorIds },
      role: { $in: ['SUPERVISOR', 'supervisor'] }
    }).sort({ name: 1 }).select('_id name email phone createdAt').lean();
    
    console.log(`[Client ${clientId}] Found ${supervisors.length} supervisors assigned to this client`);
    
    // Fetch associated staff/employees
    const projectIds = projects.map(p => p._id.toString());
    const staff = await EmployeeMerged.find({
      $or: [
        { client_user_id: clientId },
        { 'project_assignments.project_id': { $in: projectIds } }
      ]
    }).sort({ name: 1 }).lean();
    
    // Enrich staff with project names
    const staffWithProjects = staff.map(emp => {
      const projectAssignment = emp.project_assignments?.find(pa => 
        projectIds.includes(pa.project_id?.toString())
      );
      const project = projects.find(p => p._id.toString() === projectAssignment?.project_id?.toString());
      
      return {
        id: emp._id.toString(),
        name: emp.name,
        email: emp.email,
        phone: emp.phone,
        role: emp.role,
        project_id: projectAssignment?.project_id?.toString() || null,
        client_user_id: emp.client_user_id || clientId, // Keep for backward compatibility
        project_name: project?.name || null
      };
    });
    
    console.log(`[Client ${clientId}] Found ${staffWithProjects.length} staff members assigned to this client`);
    
    res.json({
      success: true,
      data: {
        id: client._id.toString(),
        name: client.name,
        email: client.email,
        phone: client.phone,
        role: client.role,
        // User model uses 'isActive', but API returns 'is_active' for consistency
        is_active: client.isActive === true || client.isActive === undefined || client.isActive === null ? true : false,
        created_at: client.createdAt || client.created_at,
        projects: projects.map(p => ({
          id: p._id.toString(),
          name: p.name,
          location: p.location,
          start_date: p.start_date,
          end_date: p.end_date,
          budget: p.budget ? parseFloat(p.budget.toString()) : null,
          created_at: p.created_at,
          description: p.description,
          client_user_id: p.client?.client_id || p.client_user_id
        })),
        supervisors: supervisors.map(s => ({
          id: s._id.toString(),
          name: s.name,
          email: s.email,
          phone: s.phone,
          created_at: s.createdAt || s.created_at,
          client_user_id: clientId
        })),
        staff: staffWithProjects
      }
    });
  } catch (error) {
    console.error('Error fetching client:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch client',
      message: error.message
    });
  }
});

// POST create new client
router.post('/', async (req, res) => {
  try {
    const { name, email, phone, password, is_active } = req.body;
    
    console.log('[CREATE CLIENT] Request received:', { name, email, phone: phone ? '***' : null, hasPassword: !!password, is_active });
    
    // Validation
    if (!name || !email || !password) {
      console.log('[CREATE CLIENT] Validation failed: missing required fields');
      return res.status(400).json({
        success: false,
        error: 'Name, email, and password are required'
      });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log('[CREATE CLIENT] Validation failed: invalid email format');
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    
    const User = require('../models/User');
    const uuid = require('uuid');
    
    // Check if email already exists
    const existingUser = await User.findOne({
      email: normalizedEmail
    }).lean();
    
    if (existingUser) {
      console.log('[CREATE CLIENT] Email already exists:', normalizedEmail);
      return res.status(409).json({
        success: false,
        error: 'Email already exists'
      });
    }
    
    // Create new client user
    // User model uses 'isActive' (camelCase) and 'password' (not password_hash)
    // _id is required and must be a string (UUID)
    const clientId = uuid.v4();
    console.log('[CREATE CLIENT] Creating user with ID:', clientId);
    
    const newClient = new User({
      _id: clientId,
      email: normalizedEmail,
      password: password, // User model will hash it in pre-save hook
      role: 'CLIENT',
      name: name.trim(),
      phone: phone ? phone.trim() : null,
      isActive: is_active !== undefined ? (is_active === true || is_active === 'true') : true
    });
    
    console.log('[CREATE CLIENT] Saving user to database...');
    await newClient.save();
    console.log('[CREATE CLIENT] User saved successfully:', newClient._id);
    
    res.status(201).json({
      success: true,
      message: 'Client created successfully',
      data: {
        id: newClient._id.toString(),
        email: newClient.email,
        name: newClient.name,
        phone: newClient.phone,
        role: newClient.role,
        is_active: newClient.isActive === true, // User model uses 'isActive', API returns 'is_active'
        created_at: newClient.createdAt
      }
    });
  } catch (error) {
    console.error('[CREATE CLIENT] Error creating client:', error);
    console.error('[CREATE CLIENT] Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Failed to create client',
      message: error.message
    });
  }
});

// PUT update client
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, password, is_active } = req.body;
    
    console.log(`[UPDATE CLIENT] ID: ${id}, is_active: ${is_active} (type: ${typeof is_active})`);
    
    const User = require('../models/User');
    
    // User model uses string _id, so use the ID directly
    if (!id || id.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Invalid client ID format'
      });
    }
    
    const clientId = id.trim();
    const mongoose = require('mongoose');
    
    console.log(`[UPDATE CLIENT] Looking for client with ID: ${clientId} (length: ${clientId.length})`);
    
    // Check if user exists and is a client
    // Handle both UUID strings and MongoDB ObjectIds
    let existingUser = null;
    let actualId = null; // Store the actual _id format for updates
    
    // Try finding by string ID first (UUID format)
    existingUser = await User.findOne({
      _id: clientId,
      role: { $in: ['CLIENT', 'client'] }
    }).lean();
    
    if (existingUser) {
      actualId = existingUser._id;
    }
    
    // If not found and ID looks like MongoDB ObjectId (24 hex chars), try converting
    if (!existingUser && mongoose.Types.ObjectId.isValid(clientId) && clientId.length === 24) {
      try {
        const objectId = new mongoose.Types.ObjectId(clientId);
        // Query using the native collection to handle ObjectId _id
        const UserCollection = User.collection;
        const doc = await UserCollection.findOne({
          _id: objectId,
          role: { $in: ['CLIENT', 'client'] }
        });
        if (doc) {
          // Convert to plain object
          existingUser = User.hydrate(doc).toObject();
          actualId = objectId; // Use ObjectId for updates
        }
      } catch (err) {
        console.log(`[UPDATE CLIENT] Could not convert to ObjectId: ${err.message}`);
      }
    }
    
    if (!existingUser) {
      const allClients = await User.find({ role: { $in: ['CLIENT', 'client'] } })
        .select('_id name email')
        .limit(3)
        .lean();
      console.log(`[UPDATE CLIENT] Client not found. Sample client IDs:`, 
        allClients.map(c => ({ id: String(c._id), type: typeof c._id, length: String(c._id).length, isObjectId: c._id instanceof mongoose.Types.ObjectId }))
      );
      
      return res.status(404).json({
        success: false,
        error: 'Client not found'
      });
    }
    
    // Determine the actual ID format for updates
    if (!actualId) {
      actualId = existingUser._id;
    }
    
    // If _id is an ObjectId, use it directly; otherwise convert string to ObjectId if needed
    if (actualId instanceof mongoose.Types.ObjectId) {
      // Already an ObjectId, use as is
    } else if (mongoose.Types.ObjectId.isValid(String(actualId)) && String(actualId).length === 24) {
      // Convert string to ObjectId for update
      actualId = new mongoose.Types.ObjectId(String(actualId));
    }
    
    console.log(`[UPDATE CLIENT] Found client: ${existingUser.name} (${existingUser.email}), Current isActive: ${existingUser.isActive}`);
    console.log(`[UPDATE CLIENT] Actual ID for update: ${actualId} (type: ${actualId.constructor.name})`);
    
    // Build update object
    const updateData = {};
    
    if (name !== undefined) {
      updateData.name = name;
    }
    
    if (email !== undefined) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid email format'
        });
      }
      
      const normalizedEmail = email.trim().toLowerCase();
      
      // Check if email exists for another user
      const emailCheck = await User.findOne({
        email: normalizedEmail,
        _id: { $ne: clientId }
      });
      
      if (emailCheck) {
        return res.status(409).json({
          success: false,
          error: 'Email already exists'
        });
      }
      
      updateData.email = normalizedEmail;
    }
    
    if (phone !== undefined) {
      updateData.phone = phone;
    }
    
    if (password !== undefined && password.trim() !== '') {
      updateData.password = password; // User model will hash it in pre-save hook
    }
    
    if (is_active !== undefined) {
      // Ensure isActive is a boolean - handle both true and false explicitly
      // User model uses 'isActive' (camelCase), but API accepts 'is_active' (snake_case)
      let isActiveBool;
      if (typeof is_active === 'boolean') {
        isActiveBool = is_active;
      } else if (is_active === 'true' || is_active === 1 || is_active === '1') {
        isActiveBool = true;
      } else if (is_active === 'false' || is_active === 0 || is_active === '0' || is_active === false) {
        isActiveBool = false;
      } else {
        isActiveBool = Boolean(is_active);
      }
      updateData.isActive = isActiveBool; // Use camelCase for User model
      console.log(`[UPDATE CLIENT] Setting isActive to: ${isActiveBool} (boolean: ${typeof isActiveBool})`);
    }
    
    // Update client - use the actualId (ObjectId format) for updates
    if (Object.keys(updateData).length > 0) {
      console.log(`[UPDATE CLIENT] Update data:`, updateData);
      
      try {
        // Use the actualId (ObjectId) for the update query
        const updateQuery = { _id: actualId };
        console.log(`[UPDATE CLIENT] Update query:`, { _id: actualId, _idType: actualId.constructor.name });
        
        const updateResult = await User.updateOne(
          updateQuery,
          { $set: updateData }
        );
        
        console.log(`[UPDATE CLIENT] Update result:`, {
          matched: updateResult.matchedCount,
          modified: updateResult.modifiedCount
        });
        
        if (updateResult.matchedCount === 0) {
          console.error(`[UPDATE CLIENT] No document matched for update`);
          // Try using native collection update as fallback
          try {
            const UserCollection = User.collection;
            const nativeUpdateResult = await UserCollection.updateOne(
              { _id: actualId },
              { $set: updateData }
            );
            console.log(`[UPDATE CLIENT] Native update result:`, {
              matched: nativeUpdateResult.matchedCount,
              modified: nativeUpdateResult.modifiedCount
            });
            if (nativeUpdateResult.matchedCount === 0) {
              return res.status(404).json({
                success: false,
                error: 'Client not found after update'
              });
            }
          } catch (nativeError) {
            console.error(`[UPDATE CLIENT] Native update also failed:`, nativeError);
            return res.status(404).json({
              success: false,
              error: 'Client not found after update'
            });
          }
        }
        
        if (updateResult.modifiedCount === 0 && updateResult.matchedCount > 0) {
          console.log(`[UPDATE CLIENT] Document matched but no changes made (might be same value)`);
        }
      } catch (updateError) {
        console.error(`[UPDATE CLIENT] Update error:`, updateError);
        return res.status(500).json({
          success: false,
          error: 'Failed to update client',
          message: updateError.message
        });
      }
    }
    
    // Fetch updated client using the actualId
    let updatedClient = await User.findById(actualId).lean();
    
    // If not found, try with native collection
    if (!updatedClient) {
      try {
        const UserCollection = User.collection;
        const doc = await UserCollection.findOne({ _id: actualId });
        if (doc) {
          updatedClient = User.hydrate(doc).toObject();
        }
      } catch (err) {
        console.error(`[UPDATE CLIENT] Error fetching updated client:`, err);
      }
    }
    
    if (!updatedClient) {
      return res.status(404).json({
        success: false,
        error: 'Client not found'
      });
    }
    
    // Ensure boolean response - explicitly convert to boolean
    // User model uses 'isActive', but API returns 'is_active' for consistency
    const isActiveResponse = updatedClient.isActive === true;
    
    console.log(`[UPDATE CLIENT] Response is_active: ${isActiveResponse} (from DB isActive: ${updatedClient.isActive}, type: ${typeof updatedClient.isActive})`);
    
    res.json({
      success: true,
      message: 'Client updated successfully',
      data: {
        id: updatedClient._id.toString(),
        email: updatedClient.email,
        name: updatedClient.name,
        phone: updatedClient.phone,
        is_active: isActiveResponse,
        created_at: updatedClient.createdAt,
        updated_at: updatedClient.updatedAt
      }
    });
  } catch (error) {
    console.error('Error updating client:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update client',
      message: error.message
    });
  }
});

// DELETE client
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const mongoose = require('mongoose');
    
    const User = require('../models/User');
    const ProjectMerged = require('../models/ProjectMerged');
    const EmployeeMerged = require('../models/EmployeeMerged');
    
    if (!id || id.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Invalid client ID format'
      });
    }
    
    const clientId = id.trim();
    
    // Check if user exists and is a client - handle both string UUIDs and MongoDB ObjectIds
    let existingUser = await User.findOne({
      _id: clientId,
      role: { $in: ['CLIENT', 'client'] }
    }).lean();
    
    // If not found and ID looks like MongoDB ObjectId (24 hex chars), try with ObjectId
    if (!existingUser && mongoose.Types.ObjectId.isValid(clientId) && clientId.length === 24) {
      try {
        const objectId = new mongoose.Types.ObjectId(clientId);
        // Query using the native collection to handle ObjectId _id
        const UserCollection = User.collection;
        const doc = await UserCollection.findOne({
          _id: objectId,
          role: { $in: ['CLIENT', 'client'] }
        });
        if (doc) {
          // Convert to plain object
          existingUser = User.hydrate(doc).toObject();
        }
      } catch (err) {
        console.log(`[DELETE CLIENT] Could not convert to ObjectId: ${err.message}`);
      }
    }
    
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        error: 'Client not found'
      });
    }
    
    // Use the actual _id from the found document for deletion
    const actualId = existingUser._id;
    
    // Convert actualId to string for queries
    const clientIdString = String(actualId);
    
    // Check for associated records - use 'client.client_id' (nested field) not 'client_user_id'
    const projectCount = await ProjectMerged.countDocuments({
      'client.client_id': clientIdString
    });
    
    // Count supervisors assigned to client's projects
    const projectIds = await ProjectMerged.distinct('_id', {
      'client.client_id': clientIdString
    });
    const supervisorIds = await ProjectMerged.distinct('assigned_supervisors.supervisor_id', {
      'client.client_id': clientIdString
    });
    const supervisorCount = await User.countDocuments({
      _id: { $in: supervisorIds },
      role: { $in: ['SUPERVISOR', 'supervisor'] }
    });
    
    // Count staff assigned to client's projects
    const staffCount = await EmployeeMerged.countDocuments({
      $or: [
        { client_user_id: clientIdString },
        { 'project_assignments.project_id': { $in: projectIds.map(p => p.toString()) } }
      ]
    });
    
    if (projectCount > 0 || supervisorCount > 0 || staffCount > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete client with associated records',
        details: {
          projects: projectCount,
          supervisors: supervisorCount,
          staff: staffCount
        },
        message: 'Please remove or reassign all associated projects, supervisors, and staff before deleting this client.'
      });
    }
    
    // Delete user using the actual _id
    const deleteResult = await User.findByIdAndDelete(actualId);
    
    // If that fails and _id is ObjectId, try native collection delete
    if (!deleteResult && mongoose.Types.ObjectId.isValid(String(actualId)) && String(actualId).length === 24) {
      try {
        const objectId = new mongoose.Types.ObjectId(String(actualId));
        const UserCollection = User.collection;
        await UserCollection.deleteOne({ _id: objectId });
      } catch (err) {
        console.error('[DELETE CLIENT] Native delete failed:', err);
        return res.status(500).json({
          success: false,
          error: 'Failed to delete client',
          message: err.message
        });
      }
    }
    
    res.json({
      success: true,
      message: 'Client deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting client:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete client',
      message: error.message
    });
  }
});

// GET client statistics
router.get('/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;
    const mongoose = require('mongoose');
    
    const User = require('../models/User');
    const ProjectMerged = require('../models/ProjectMerged');
    const EmployeeMerged = require('../models/EmployeeMerged');
    
    if (!id || id.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Invalid client ID format'
      });
    }
    
    const clientId = id.trim();
    
    // Check if user exists and is a client - handle both string UUIDs and MongoDB ObjectIds
    let clientCheck = await User.findOne({
      _id: clientId,
      role: { $in: ['CLIENT', 'client'] }
    }).lean();
    
    // If not found and ID looks like MongoDB ObjectId (24 hex chars), try with ObjectId
    if (!clientCheck && mongoose.Types.ObjectId.isValid(clientId) && clientId.length === 24) {
      try {
        const objectId = new mongoose.Types.ObjectId(clientId);
        // Query using the native collection to handle ObjectId _id
        const UserCollection = User.collection;
        const doc = await UserCollection.findOne({
          _id: objectId,
          role: { $in: ['CLIENT', 'client'] }
        });
        if (doc) {
          // Convert to plain object
          clientCheck = User.hydrate(doc).toObject();
        }
      } catch (err) {
        console.log(`[GET CLIENT STATS] Could not convert to ObjectId: ${err.message}`);
      }
    }
    
    if (!clientCheck) {
      return res.status(404).json({
        success: false,
        error: 'Client not found'
      });
    }
    
    // Get project statistics - use 'client.client_id' (nested field) not 'client_user_id'
    const totalProjects = await ProjectMerged.countDocuments({
      'client.client_id': clientId
    });
    
    const now = new Date();
    const activeProjects = await ProjectMerged.countDocuments({
      'client.client_id': clientId,
      $or: [
        { end_date: null },
        { end_date: { $gt: now } }
      ]
    });
    
    // Get supervisor statistics (from projects' assigned_supervisors)
    const supervisorIds = await ProjectMerged.distinct('assigned_supervisors.supervisor_id', {
      'client.client_id': clientId
    });
    const totalSupervisors = await User.countDocuments({
      _id: { $in: supervisorIds },
      role: { $in: ['SUPERVISOR', 'supervisor'] }
    });
    
    // Get staff statistics
    const projectIds = await ProjectMerged.distinct('_id', {
      'client.client_id': clientId
    });
    const projectIdStrings = projectIds.map(p => p.toString());
    
    const totalStaff = await EmployeeMerged.countDocuments({
      $or: [
        { client_user_id: clientId },
        { 'project_assignments.project_id': { $in: projectIdStrings } }
      ]
    });
    
    const assignedStaff = await EmployeeMerged.countDocuments({
      $or: [
        { client_user_id: clientId, 'project_assignments.0': { $exists: true } },
        { 'project_assignments.project_id': { $in: projectIdStrings } }
      ]
    });
    
    res.json({
      success: true,
      data: {
        projects: {
          total: totalProjects,
          active: activeProjects
        },
        supervisors: totalSupervisors,
        staff: {
          total: totalStaff,
          assigned: assignedStaff,
          unassigned: totalStaff - assignedStaff
        }
      }
    });
  } catch (error) {
    console.error('Error fetching client stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch client statistics',
      message: error.message
    });
  }
});

module.exports = router;


