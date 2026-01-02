/**
 * Assign Supervisors to Projects in MongoDB
 * 
 * This script reads supervisor-project relationships from Supabase
 * and assigns them to projects in MongoDB using user IDs (not profile IDs)
 * 
 * Usage: node scripts/assign-supervisors-to-projects-mongo.js
 */

const { connectMongoDB, disconnectMongoDB } = require('../config/mongodb');
const ProjectMerged = require('../models/ProjectMerged');
const User = require('../models/User');
const db = require('../config/db');

async function assignSupervisorsToProjects() {
  console.log('\n🔗 Assigning Supervisors to Projects in MongoDB...\n');
  console.log('='.repeat(80));
  
  try {
    await connectMongoDB();
    console.log('✅ Connected to MongoDB\n');
    
    await db.getClient();
    console.log('✅ Connected to Supabase\n');
    
    // Get all supervisors from MongoDB first
    const mongoSupervisors = await User.find({ role: 'SUPERVISOR' }).lean();
    const supervisorEmailMap = new Map();
    mongoSupervisors.forEach(s => {
      supervisorEmailMap.set(s.email.toLowerCase(), {
        id: s._id,
        name: s.name,
        email: s.email,
      });
    });
    
    console.log(`📋 Found ${mongoSupervisors.length} supervisors in MongoDB\n`);
    
    // Fetch supervisor-project relationships from Supabase
    console.log('📋 Fetching supervisor-project relationships from Supabase...');
    const result = await db.query(`
      SELECT spr.project_id, spr.supervisor_id, spr.assigned_at,
             s.email as supervisor_email, s.name as supervisor_name
      FROM supervisor_projects_relation spr
      LEFT JOIN supervisors s ON s.id = spr.supervisor_id
      WHERE s.email IS NOT NULL
      ORDER BY spr.project_id
    `);
    
    const relations = result.rows || [];
    console.log(`   Found ${relations.length} supervisor-project relationships\n`);
    
    if (relations.length === 0) {
      console.log('⚠️  No supervisor-project relationships found in Supabase');
      return;
    }
    
    // Group by project_id and match with MongoDB supervisors
    const projectSupervisorsMap = new Map();
    let matched = 0;
    let unmatched = 0;
    
    for (const rel of relations) {
      // Find supervisor in MongoDB by email (case-insensitive)
      const supervisorEmail = rel.supervisor_email?.toLowerCase();
      const mongoSupervisor = supervisorEmail ? supervisorEmailMap.get(supervisorEmail) : null;
      
      if (!mongoSupervisor) {
        console.warn(`   ⚠️  Supervisor not found in MongoDB: ${rel.supervisor_email}`);
        unmatched++;
        continue;
      }
      
      if (!projectSupervisorsMap.has(rel.project_id)) {
        projectSupervisorsMap.set(rel.project_id, []);
      }
      
      // Check if already added (avoid duplicates)
      const existing = projectSupervisorsMap.get(rel.project_id).find(
        s => s.supervisor_id === mongoSupervisor.id
      );
      
      if (!existing) {
        projectSupervisorsMap.get(rel.project_id).push({
          supervisor_id: mongoSupervisor.id, // Use MongoDB user ID
          supervisor_name: mongoSupervisor.name,
          supervisor_email: mongoSupervisor.email,
          assigned_at: rel.assigned_at ? new Date(rel.assigned_at) : new Date(),
          status: 'active',
        });
        matched++;
      }
    }
    
    console.log(`   ✅ Matched ${matched} supervisor assignments`);
    console.log(`   ⚠️  Unmatched ${unmatched} supervisor assignments\n`);
    
    console.log(`📊 Found ${projectSupervisorsMap.size} projects with supervisor assignments\n`);
    
    let updated = 0;
    let skipped = 0;
    let notFound = 0;
    
    // Update each project
    for (const [projectId, supervisors] of projectSupervisorsMap) {
      try {
        const project = await ProjectMerged.findById(projectId);
        
        if (!project) {
          console.warn(`   ⚠️  Project ${projectId} not found in MongoDB`);
          notFound++;
          continue;
        }
        
        // Update assigned_supervisors
        project.assigned_supervisors = supervisors;
        await project.save();
        
        updated++;
        if (updated % 10 === 0) {
          console.log(`   ✅ Updated ${updated} projects...`);
        }
      } catch (error) {
        console.error(`   ❌ Error updating project ${projectId}:`, error.message);
        skipped++;
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 Summary:');
    console.log('='.repeat(80));
    console.log(`Total relationships: ${relations.length}`);
    console.log(`Projects updated: ${updated}`);
    console.log(`Projects not found: ${notFound}`);
    console.log(`Errors: ${skipped}`);
    console.log('='.repeat(80));
    
    // Verify
    console.log('\n🔍 Verifying assignments...');
    const projectsWithSupervisors = await ProjectMerged.countDocuments({
      'assigned_supervisors.0': { $exists: true }
    });
    console.log(`   ✅ Projects with supervisors: ${projectsWithSupervisors}`);
    
    // Check supervisor project counts
    const supervisors = await User.find({ role: 'SUPERVISOR' }).lean();
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
    await db.pool.end();
    console.log('\n👋 Disconnected from databases');
  }
}

if (require.main === module) {
  assignSupervisorsToProjects();
}

module.exports = { assignSupervisorsToProjects };

