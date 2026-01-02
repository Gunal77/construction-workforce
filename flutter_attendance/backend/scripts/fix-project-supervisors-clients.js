/**
 * Fix Project Supervisors and Clients in MongoDB
 * 
 * This script fixes:
 * 1. Supervisor IDs in projects - converts supervisor profile IDs to user IDs
 * 2. Client information in projects - ensures client data is properly set
 * 
 * Usage: node scripts/fix-project-supervisors-clients.js
 */

const { connectMongoDB, disconnectMongoDB } = require('../config/mongodb');
const ProjectMerged = require('../models/ProjectMerged');
const User = require('../models/User');
const db = require('../config/db');

async function fixProjectSupervisorsAndClients() {
  console.log('\n🔧 Fixing Project Supervisors and Clients...\n');
  console.log('='.repeat(80));
  
  try {
    await connectMongoDB();
    console.log('✅ Connected to MongoDB\n');
    
    await db.getClient();
    console.log('✅ Connected to Supabase\n');
    
    // Get all projects with supervisor assignments
    const projects = await ProjectMerged.find({
      'assigned_supervisors.0': { $exists: true }
    }).lean();
    
    console.log(`📊 Found ${projects.length} projects with supervisor assignments\n`);
    
    let fixedSupervisors = 0;
    let fixedClients = 0;
    let skipped = 0;
    
    for (const project of projects) {
      let needsUpdate = false;
      const updateData = {};
      
      // Fix supervisor IDs - convert profile IDs to user IDs
      if (project.assigned_supervisors && project.assigned_supervisors.length > 0) {
        const fixedSupervisors = [];
        
        for (const supervisor of project.assigned_supervisors) {
          // Check if supervisor_id is a user ID (exists in users collection)
          const userSupervisor = await User.findOne({ 
            _id: supervisor.supervisor_id,
            role: 'SUPERVISOR'
          }).lean();
          
          if (userSupervisor) {
            // Already a user ID, keep it
            fixedSupervisors.push(supervisor);
          } else {
            // Might be a profile ID, try to find user by email
            if (supervisor.supervisor_email) {
              const userByEmail = await User.findOne({
                email: supervisor.supervisor_email,
                role: 'SUPERVISOR'
              }).lean();
              
              if (userByEmail) {
                fixedSupervisors.push({
                  ...supervisor,
                  supervisor_id: userByEmail._id,
                });
                needsUpdate = true;
              } else {
                console.warn(`   ⚠️  Could not find user for supervisor ${supervisor.supervisor_email}`);
                // Keep original but mark as needing update
                fixedSupervisors.push(supervisor);
              }
            } else {
              // No email, try to find by querying Supabase
              try {
                const result = await db.query(`
                  SELECT u.id as user_id
                  FROM supervisors s
                  LEFT JOIN users u ON u.email = s.email
                  WHERE s.id = $1 AND u.role = 'supervisor'
                `, [supervisor.supervisor_id]);
                
                if (result.rows.length > 0 && result.rows[0].user_id) {
                  fixedSupervisors.push({
                    ...supervisor,
                    supervisor_id: result.rows[0].user_id,
                  });
                  needsUpdate = true;
                } else {
                  console.warn(`   ⚠️  Could not map supervisor profile ID ${supervisor.supervisor_id} to user ID`);
                  fixedSupervisors.push(supervisor);
                }
              } catch (error) {
                console.warn(`   ⚠️  Error querying Supabase for supervisor ${supervisor.supervisor_id}:`, error.message);
                fixedSupervisors.push(supervisor);
              }
            }
          }
        }
        
        if (needsUpdate) {
          updateData.assigned_supervisors = fixedSupervisors;
          fixedSupervisors++;
        }
      }
      
      // Fix client information - ensure client data exists
      if (!project.client || !project.client.client_id) {
        // Try to get client from Supabase
        try {
          const result = await db.query(`
            SELECT p.client_user_id, u.id as user_id, u.name, u.email
            FROM projects p
            LEFT JOIN users u ON u.id = p.client_user_id
            WHERE p.id = $1
          `, [project._id]);
          
          if (result.rows.length > 0 && result.rows[0].client_user_id) {
            const clientData = result.rows[0];
            updateData.client = {
              client_id: clientData.client_user_id,
              client_name: clientData.name || null,
              client_email: clientData.email || null,
              client_phone: null,
              client_address: null,
              contact_person: null,
            };
            needsUpdate = true;
            fixedClients++;
          }
        } catch (error) {
          console.warn(`   ⚠️  Error fetching client for project ${project._id}:`, error.message);
        }
      }
      
      // Update project if needed
      if (needsUpdate) {
        await ProjectMerged.findByIdAndUpdate(project._id, updateData);
        console.log(`   ✅ Fixed project: ${project.name}`);
      } else {
        skipped++;
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 Summary:');
    console.log('='.repeat(80));
    console.log(`Projects processed: ${projects.length}`);
    console.log(`Supervisor IDs fixed: ${fixedSupervisors}`);
    console.log(`Client data fixed: ${fixedClients}`);
    console.log(`Skipped (already correct): ${skipped}`);
    console.log('='.repeat(80));
    
    console.log('\n✅ Fix completed successfully!');
    
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
  fixProjectSupervisorsAndClients();
}

module.exports = { fixProjectSupervisorsAndClients };

