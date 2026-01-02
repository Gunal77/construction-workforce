/**
 * Assign Clients to All Projects in MongoDB
 * 
 * This script assigns clients to all projects that don't have a client assigned.
 * It distributes clients evenly across projects using round-robin.
 * 
 * Usage: node scripts/assign-clients-to-all-projects.js
 */

const { connectMongoDB, disconnectMongoDB } = require('../config/mongodb');
const ProjectMerged = require('../models/ProjectMerged');
const User = require('../models/User');

async function assignClientsToAllProjects() {
  console.log('\n🔗 Assigning Clients to All Projects in MongoDB...\n');
  console.log('='.repeat(80));
  
  try {
    await connectMongoDB();
    console.log('✅ Connected to MongoDB\n');
    
    // Get all clients from MongoDB
    console.log('📋 Fetching clients from MongoDB...');
    const clients = await User.find({ role: 'CLIENT' })
      .select('_id name email phone')
      .lean();
    
    console.log(`   Found ${clients.length} clients\n`);
    
    if (clients.length === 0) {
      console.log('⚠️  No clients found in MongoDB. Please create clients first.');
      return;
    }
    
    // Get all projects without clients
    console.log('📋 Fetching projects without clients...');
    const projectsWithoutClients = await ProjectMerged.find({
      $or: [
        { client: { $exists: false } },
        { 'client.client_id': { $exists: false } },
        { 'client.client_id': null }
      ]
    })
      .select('_id name')
      .lean();
    
    console.log(`   Found ${projectsWithoutClients.length} projects without clients\n`);
    
    if (projectsWithoutClients.length === 0) {
      console.log('✅ All projects already have clients assigned!');
      return;
    }
    
    // Prepare bulk operations - distribute clients evenly using round-robin
    const bulkOps = [];
    let assignedCount = 0;
    
    projectsWithoutClients.forEach((project, index) => {
      // Round-robin assignment: cycle through clients
      const clientIndex = index % clients.length;
      const client = clients[clientIndex];
      
      bulkOps.push({
        updateOne: {
          filter: { _id: project._id },
          update: {
            $set: {
              client: {
                client_id: client._id.toString(),
                client_name: client.name,
                client_email: client.email || null,
                client_phone: client.phone || null,
                client_address: null,
                contact_person: null,
              },
              updated_at: new Date()
            }
          },
        },
      });
      
      assignedCount++;
    });
    
    console.log(`   Assigning clients to ${bulkOps.length} projects...`);
    const result = await ProjectMerged.bulkWrite(bulkOps, { ordered: false });
    
    const updated = result.modifiedCount || result.matchedCount || 0;
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 Summary:');
    console.log('='.repeat(80));
    console.log(`Total clients available: ${clients.length}`);
    console.log(`Projects without clients: ${projectsWithoutClients.length}`);
    console.log(`Projects matched: ${result.matchedCount || 0}`);
    console.log(`Projects updated: ${updated}`);
    console.log('='.repeat(80));
    
    // Show client distribution
    console.log('\n📊 Client Distribution:');
    clients.forEach((client, index) => {
      const assignedProjects = Math.ceil(projectsWithoutClients.length / clients.length);
      const startIndex = index * assignedProjects;
      const endIndex = Math.min(startIndex + assignedProjects, projectsWithoutClients.length);
      const count = endIndex - startIndex;
      console.log(`   ${client.name}: ${count} project(s)`);
    });
    
    // Verify
    console.log('\n🔍 Verifying client assignments...');
    const projectsWithClientsCount = await ProjectMerged.countDocuments({
      'client.client_id': { $exists: true, $ne: null }
    });
    const totalProjects = await ProjectMerged.countDocuments({});
    console.log(`   ✅ Projects with clients: ${projectsWithClientsCount} / ${totalProjects}`);
    
    console.log('\n✅ Client assignment completed successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await disconnectMongoDB();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

if (require.main === module) {
  assignClientsToAllProjects();
}

module.exports = { assignClientsToAllProjects };

