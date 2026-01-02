/**
 * Assign Clients to Projects in MongoDB
 * 
 * This script reads client_user_id from Supabase projects table
 * and assigns client information to projects in MongoDB
 * 
 * Usage: node scripts/assign-clients-to-projects.js
 */

const { connectMongoDB, disconnectMongoDB } = require('../config/mongodb');
const ProjectMerged = require('../models/ProjectMerged');
const User = require('../models/User');
const db = require('../config/db');

async function assignClientsToProjects() {
  console.log('\n🔗 Assigning Clients to Projects in MongoDB...\n');
  console.log('='.repeat(80));
  
  try {
    await connectMongoDB();
    console.log('✅ Connected to MongoDB\n');
    
    await db.getClient();
    console.log('✅ Connected to Supabase\n');
    
    // Fetch projects with client_user_id from Supabase
    console.log('📋 Fetching projects with client information from Supabase...');
    const result = await db.query(`
      SELECT p.id, p.client_user_id, u.name as client_name, u.email as client_email, u.phone as client_phone
      FROM projects p
      LEFT JOIN users u ON u.id = p.client_user_id AND u.role = 'client'
      WHERE p.client_user_id IS NOT NULL
      ORDER BY p.id
    `);
    
    const projectsWithClients = result.rows || [];
    console.log(`   Found ${projectsWithClients.length} projects with client_user_id\n`);
    
    if (projectsWithClients.length === 0) {
      console.log('⚠️  No projects with client_user_id found in Supabase');
      return;
    }
    
    // Get all client users from MongoDB
    const mongoClients = await User.find({ role: 'CLIENT' }).lean();
    const clientEmailMap = new Map();
    mongoClients.forEach(c => {
      clientEmailMap.set(c.email.toLowerCase(), {
        id: c._id,
        name: c.name,
        email: c.email,
        phone: c.phone || null,
      });
    });
    
    console.log(`📋 Found ${mongoClients.length} clients in MongoDB\n`);
    
    // Get all client user IDs from Supabase and find them in MongoDB
    const clientUserIds = [...new Set(projectsWithClients.map(p => p.client_user_id).filter(Boolean))];
    console.log(`   Found ${clientUserIds.length} unique client user IDs\n`);
    
    // Fetch clients from MongoDB by ID (try both CLIENT and client role)
    const mongoClientsById = await User.find({
      _id: { $in: clientUserIds },
      role: { $in: ['CLIENT', 'client'] }
    }).lean();
    
    const clientIdMap = new Map();
    mongoClientsById.forEach(c => {
      clientIdMap.set(c._id, {
        id: c._id,
        name: c.name,
        email: c.email,
        phone: c.phone || null,
      });
    });
    
    console.log(`   Found ${mongoClientsById.length} clients in MongoDB\n`);
    
    // Prepare bulk operations
    const bulkOps = [];
    let skipped = 0;
    let notFound = 0;
    
    for (const projectData of projectsWithClients) {
      const client = clientIdMap.get(projectData.client_user_id);
      
      if (!client) {
        notFound++;
        continue;
      }
      
      bulkOps.push({
        updateOne: {
          filter: { _id: projectData.id },
          update: {
            $set: {
              client: {
                client_id: client.id,
                client_name: client.name,
                client_email: client.email,
                client_phone: client.phone,
                client_address: null,
                contact_person: null,
              }
            }
          },
        },
      });
    }
    
    console.log(`   Updating ${bulkOps.length} projects in bulk...`);
    const result = await ProjectMerged.bulkWrite(bulkOps, { ordered: false });
    
    const updated = result.modifiedCount || result.matchedCount || 0;
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 Summary:');
    console.log('='.repeat(80));
    console.log(`Projects with client_user_id: ${projectsWithClients.length}`);
    console.log(`Projects matched: ${result.matchedCount || 0}`);
    console.log(`Projects updated: ${updated}`);
    console.log(`Clients not found in MongoDB: ${notFound}`);
    console.log('='.repeat(80));
    
    // Verify
    console.log('\n🔍 Verifying client assignments...');
    const projectsWithClientsCount = await ProjectMerged.countDocuments({
      'client.client_id': { $exists: true }
    });
    console.log(`   ✅ Projects with clients: ${projectsWithClientsCount}`);
    
    console.log('\n✅ Client assignment completed successfully!');
    
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
  assignClientsToProjects();
}

module.exports = { assignClientsToProjects };

