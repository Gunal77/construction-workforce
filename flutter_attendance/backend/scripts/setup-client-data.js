/**
 * Comprehensive script to set up client data
 * 1. Creates sample clients if they don't exist
 * 2. Assigns projects to clients
 * 3. Ensures all clients have data
 */

require('dotenv').config();
const env = require('../config/env');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const ProjectMerged = require('../models/ProjectMerged');
const User = require('../models/User');

async function setupClientData() {
  try {
    console.log('🚀 Starting client data setup...\n');
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

    // Step 1: Create sample clients if they don't exist
    console.log('📋 Step 1: Creating/Checking clients...');
    const sampleClients = [
      {
        name: 'John Smith',
        email: 'john.smith@example.com',
        password: 'Client123!',
        role: 'CLIENT'
      },
      {
        name: 'Jane Doe',
        email: 'jane.doe@example.com',
        password: 'Client123!',
        role: 'CLIENT'
      },
      {
        name: 'ABC Construction',
        email: 'contact@abcconstruction.com',
        password: 'Client123!',
        role: 'CLIENT'
      }
    ];

    const clientIds = [];
    for (const clientData of sampleClients) {
      let client = await User.findOne({ email: clientData.email }).lean();
      
      if (!client) {
        // Create new client
        const passwordHash = await bcrypt.hash(clientData.password, 12);
        const clientId = new mongoose.Types.ObjectId().toString();
        
        client = new User({
          _id: clientId,
          name: clientData.name,
          email: clientData.email,
          password: passwordHash,
          role: clientData.role,
          isActive: true
        });
        
        await client.save();
        console.log(`   ✅ Created client: ${clientData.name} (${clientData.email})`);
      } else {
        console.log(`   ⏭️  Client already exists: ${clientData.name} (${clientData.email})`);
      }
      
      clientIds.push(client._id.toString());
    }

    // Also get any existing clients
    const existingClients = await User.find({ role: 'CLIENT' }).lean();
    const allClientIds = existingClients.map(c => c._id.toString());
    console.log(`   📊 Total clients: ${allClientIds.length}\n`);

    if (allClientIds.length === 0) {
      console.log('⚠️  No clients found. Please create client users first.');
      await mongoose.disconnect();
      return;
    }

    // Step 2: Get all projects
    console.log('📋 Step 2: Fetching all projects...');
    const projects = await ProjectMerged.find({}).lean();
    console.log(`   Found ${projects.length} projects\n`);

    if (projects.length === 0) {
      console.log('⚠️  No projects found. Please create projects first.');
      await mongoose.disconnect();
      return;
    }

    // Step 3: Assign projects to clients
    console.log('📋 Step 3: Assigning projects to clients...');
    let assignedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < projects.length; i++) {
      const project = projects[i];
      const clientIndex = i % allClientIds.length;
      const clientId = allClientIds[clientIndex];
      const client = existingClients.find(c => c._id.toString() === clientId);

      // Check if project already has a client assigned
      if (project.client?.client_id && project.client.client_id !== clientId) {
        skippedCount++;
        console.log(`   ⏭️  Project "${project.name}" already assigned to different client`);
        continue;
      }

      // Update project with client information
      await ProjectMerged.updateOne(
        { _id: project._id },
        {
          $set: {
            'client.client_id': clientId,
            'client.client_name': client.name,
            'client.client_email': client.email,
            'client.client_phone': null,
            'client.client_address': null,
            'client.contact_person': client.name,
          }
        }
      );

      if (project.client?.client_id) {
        updatedCount++;
        console.log(`   🔄 Updated project "${project.name}" → client "${client.name}"`);
      } else {
        assignedCount++;
        console.log(`   ✅ Assigned project "${project.name}" → client "${client.name}"`);
      }
    }

    console.log(`\n   📊 Summary:`);
    console.log(`      - Newly assigned: ${assignedCount}`);
    console.log(`      - Updated: ${updatedCount}`);
    console.log(`      - Skipped: ${skippedCount}`);

    // Step 4: Display final summary
    console.log('\n📊 Final Summary by Client:');
    for (const client of existingClients) {
      const clientProjects = await ProjectMerged.countDocuments({
        'client.client_id': client._id.toString()
      });
      console.log(`   - ${client.name} (${client.email}): ${clientProjects} project(s)`);
    }

    console.log('\n✅ Client data setup completed successfully!');

  } catch (error) {
    console.error('❌ Error setting up client data:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the script
if (require.main === module) {
  setupClientData()
    .then(() => {
      console.log('\n✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = setupClientData;

