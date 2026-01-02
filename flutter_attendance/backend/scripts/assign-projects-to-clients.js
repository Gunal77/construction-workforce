/**
 * Script to assign projects to clients in MongoDB
 * This ensures all clients have projects assigned to them
 */

require('dotenv').config();
const env = require('../config/env');
const mongoose = require('mongoose');
const ProjectMerged = require('../models/ProjectMerged');
const User = require('../models/User');

async function assignProjectsToClients() {
  try {
    console.log('🚀 Starting project-to-client assignment...\n');
    console.log(`📊 Database Provider: ${env.dbProvider.toUpperCase()}\n`);

    if (env.dbProvider !== 'mongodb') {
      console.log('⚠️  This script is for MongoDB only. Current provider:', env.dbProvider);
      return;
    }

    // Connect to MongoDB if not already connected
    if (mongoose.connection.readyState === 0) {
      console.log('🔌 Connecting to MongoDB...');
      await mongoose.connect(env.mongodbUri);
      console.log('✅ Connected to MongoDB\n');
    } else {
      console.log('✅ Already connected to MongoDB\n');
    }

    // Get all clients (users with role CLIENT)
    console.log('📋 Fetching all clients...');
    const clients = await User.find({ role: 'CLIENT' }).lean();
    console.log(`   Found ${clients.length} clients\n`);

    if (clients.length === 0) {
      console.log('⚠️  No clients found. Please create client users first.');
      await mongoose.disconnect();
      return;
    }

    // Get all projects
    console.log('📋 Fetching all projects...');
    const projects = await ProjectMerged.find({}).lean();
    console.log(`   Found ${projects.length} projects\n`);

    if (projects.length === 0) {
      console.log('⚠️  No projects found. Please create projects first.');
      await mongoose.disconnect();
      return;
    }

    // Distribute projects among clients (round-robin)
    console.log('🔄 Assigning projects to clients...');
    let assignedCount = 0;
    let updatedCount = 0;

    for (let i = 0; i < projects.length; i++) {
      const project = projects[i];
      const clientIndex = i % clients.length;
      const client = clients[clientIndex];

      // Check if project already has a client assigned
      if (project.client?.client_id) {
        console.log(`   ⏭️  Project "${project.name}" already has client assigned: ${project.client.client_name}`);
        continue;
      }

      // Update project with client information
      await ProjectMerged.updateOne(
        { _id: project._id },
        {
          $set: {
            'client.client_id': client._id.toString(),
            'client.client_name': client.name,
            'client.client_email': client.email,
            'client.client_phone': null, // Can be updated later if needed
            'client.client_address': null, // Can be updated later if needed
            'client.contact_person': client.name,
          }
        }
      );

      assignedCount++;
      console.log(`   ✅ Assigned project "${project.name}" to client "${client.name}"`);
    }

    // Also ensure all projects have at least one client (assign remaining projects)
    const unassignedProjects = await ProjectMerged.find({
      $or: [
        { 'client.client_id': { $exists: false } },
        { 'client.client_id': null }
      ]
    }).lean();

    if (unassignedProjects.length > 0) {
      console.log(`\n📋 Found ${unassignedProjects.length} unassigned projects, assigning them...`);
      for (let i = 0; i < unassignedProjects.length; i++) {
        const project = unassignedProjects[i];
        const clientIndex = i % clients.length;
        const client = clients[clientIndex];

        await ProjectMerged.updateOne(
          { _id: project._id },
          {
            $set: {
              'client.client_id': client._id.toString(),
              'client.client_name': client.name,
              'client.client_email': client.email,
              'client.client_phone': null,
              'client.client_address': null,
              'client.contact_person': client.name,
            }
          }
        );

        updatedCount++;
        console.log(`   ✅ Assigned project "${project.name}" to client "${client.name}"`);
      }
    }

    console.log(`\n✅ Successfully assigned ${assignedCount + updatedCount} project(s) to clients`);
    console.log(`   - Newly assigned: ${assignedCount}`);
    console.log(`   - Updated: ${updatedCount}`);

    // Display summary
    console.log('\n📊 Summary:');
    for (const client of clients) {
      const clientProjects = await ProjectMerged.countDocuments({
        'client.client_id': client._id.toString()
      });
      console.log(`   - ${client.name} (${client.email}): ${clientProjects} project(s)`);
    }

  } catch (error) {
    console.error('❌ Error assigning projects to clients:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the script
if (require.main === module) {
  assignProjectsToClients()
    .then(() => {
      console.log('\n✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = assignProjectsToClients;

