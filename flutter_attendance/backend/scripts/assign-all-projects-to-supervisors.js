/**
 * Assign All Projects to All Supervisors in MongoDB
 * 
 * This script assigns every project to every supervisor in MongoDB
 * 
 * Usage: node scripts/assign-all-projects-to-supervisors.js
 */

const { connectMongoDB, disconnectMongoDB } = require('../config/mongodb');
const ProjectMerged = require('../models/ProjectMerged');
const User = require('../models/User');

async function assignAllProjectsToSupervisors() {
  console.log('\n🔗 Assigning All Projects to All Supervisors...\n');
  console.log('='.repeat(80));
  
  try {
    await connectMongoDB();
    console.log('✅ Connected to MongoDB\n');
    
    // Get all supervisors
    const supervisors = await User.find({ role: 'SUPERVISOR', isActive: true })
      .select('_id name email')
      .lean();
    
    console.log(`📋 Found ${supervisors.length} supervisors:`);
    supervisors.forEach(s => console.log(`   - ${s.name} (${s.email})`));
    
    if (supervisors.length === 0) {
      console.log('\n⚠️  No supervisors found. Please create supervisors first.');
      return;
    }
    
    // Get all projects
    const projects = await ProjectMerged.find()
      .select('_id name')
      .lean();
    
    console.log(`\n📋 Found ${projects.length} projects:`);
    if (projects.length <= 10) {
      projects.forEach(p => console.log(`   - ${p.name}`));
    } else {
      projects.slice(0, 5).forEach(p => console.log(`   - ${p.name}`));
      console.log(`   ... and ${projects.length - 5} more`);
    }
    
    if (projects.length === 0) {
      console.log('\n⚠️  No projects found. Please create projects first.');
      return;
    }
    
    console.log('\n🔗 Assigning projects to supervisors...\n');
    
    // Prepare supervisor assignments (same for all projects)
    const assignedSupervisors = supervisors.map(supervisor => ({
      supervisor_id: supervisor._id,
      supervisor_name: supervisor.name,
      supervisor_email: supervisor.email,
      assigned_at: new Date(),
      status: 'active',
    }));
    
    // Use bulk write for faster updates
    const bulkOps = projects.map(project => ({
      updateOne: {
        filter: { _id: project._id },
        update: { $set: { assigned_supervisors: assignedSupervisors } },
      },
    }));
    
    console.log(`   Updating ${projects.length} projects in bulk...`);
    const result = await ProjectMerged.bulkWrite(bulkOps, { ordered: false });
    
    const updated = result.modifiedCount || result.matchedCount || 0;
    const totalAssignments = updated * supervisors.length;
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 Summary:');
    console.log('='.repeat(80));
    console.log(`Supervisors: ${supervisors.length}`);
    console.log(`Projects: ${projects.length}`);
    console.log(`Projects matched: ${result.matchedCount || 0}`);
    console.log(`Projects updated: ${updated}`);
    console.log(`Total assignments: ${totalAssignments}`);
    console.log(`Average projects per supervisor: ${projects.length}`);
    console.log('='.repeat(80));
    
    // Verify assignments
    console.log('\n🔍 Verifying assignments...');
    const projectsWithSupervisors = await ProjectMerged.countDocuments({
      'assigned_supervisors.0': { $exists: true }
    });
    console.log(`   ✅ Projects with supervisors: ${projectsWithSupervisors}`);
    
    // Check supervisor project counts
    console.log(`\n📋 Supervisor Project Counts:`);
    for (const supervisor of supervisors) {
      const count = await ProjectMerged.countDocuments({
        'assigned_supervisors.supervisor_id': supervisor._id
      });
      console.log(`   ${supervisor.name}: ${count} projects`);
    }
    
    console.log('\n✅ Assignment completed successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await disconnectMongoDB();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

if (require.main === module) {
  assignAllProjectsToSupervisors();
}

module.exports = { assignAllProjectsToSupervisors };

