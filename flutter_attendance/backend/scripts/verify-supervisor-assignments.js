const mongoose = require('mongoose');
const ProjectMerged = require('../models/ProjectMerged');
const User = require('../models/User');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const project = await ProjectMerged.findOne({ 'assigned_supervisors.0': { $exists: true } }).lean();
  
  if (project && project.assigned_supervisors && project.assigned_supervisors.length > 0) {
    console.log('Project:', project.name);
    console.log('Supervisor ID in project:', project.assigned_supervisors[0].supervisor_id);
    console.log('Supervisor email:', project.assigned_supervisors[0].supervisor_email);
    
    const supervisor = await User.findOne({ 
      email: project.assigned_supervisors[0].supervisor_email, 
      role: 'SUPERVISOR' 
    }).lean();
    
    if (supervisor) {
      console.log('User supervisor_id:', supervisor._id);
      console.log('Match:', supervisor._id === project.assigned_supervisors[0].supervisor_id);
      
      // Check count
      const count = await ProjectMerged.countDocuments({
        'assigned_supervisors.supervisor_id': supervisor._id
      });
      console.log('Project count for this supervisor:', count);
    } else {
      console.log('Supervisor not found in users collection');
    }
  } else {
    console.log('No projects with supervisors found');
  }
  
  process.exit(0);
}).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});

