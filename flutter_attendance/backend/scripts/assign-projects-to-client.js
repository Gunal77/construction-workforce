/**
 * Assign Projects to Client User
 * Assigns existing projects to john.smith@client.com
 */

const mongoose = require('mongoose');
const User = require('../models/User');
const ProjectMerged = require('../models/ProjectMerged');
const env = require('../config/env');

async function assignProjectsToClient() {
  try {
    // Connect to MongoDB
    await mongoose.connect(env.mongodbUri);
    console.log('✅ Connected to MongoDB');

    const clientEmail = 'john.smith@client.com';
    const normalizedEmail = clientEmail.toLowerCase().trim();

    // Find the client user
    const clientUser = await User.findOne({ email: normalizedEmail, role: 'CLIENT' });
    if (!clientUser) {
      console.log('❌ Client user not found. Please create the client user first.');
      await mongoose.disconnect();
      return;
    }

    console.log(`✅ Found client user: ${clientUser.name} (${clientUser.email})`);
    console.log(`   User ID: ${clientUser._id}`);

    // Find all projects that don't have a client assigned
    const projectsWithoutClient = await ProjectMerged.find({
      $or: [
        { 'client.client_id': { $exists: false } },
        { 'client.client_id': null },
        { 'client.client_id': '' }
      ]
    }).limit(5); // Assign up to 5 projects

    if (projectsWithoutClient.length === 0) {
      console.log('⚠️  No projects found without a client. Checking existing assignments...');
      
      // Check if client already has projects
      const existingProjects = await ProjectMerged.find({
        'client.client_id': clientUser._id.toString()
      });
      
      if (existingProjects.length > 0) {
        console.log(`✅ Client already has ${existingProjects.length} project(s) assigned:`);
        existingProjects.forEach(project => {
          console.log(`   - ${project.name}`);
        });
      } else {
        console.log('⚠️  No projects available. Creating sample projects...');
        
        // Create 3 sample projects for the client
        const { v4: uuidv4 } = require('uuid');
        const sampleProjects = [
          {
            _id: uuidv4(),
            name: 'Downtown Office Complex',
            location: '123 Main Street',
            start_date: new Date('2024-01-01'),
            end_date: new Date('2024-06-30'),
            description: 'Construction of a 10-story office building',
            budget: mongoose.Types.Decimal128.fromString('5000000'),
            client: {
              client_id: clientUser._id.toString(),
              client_name: clientUser.name,
              client_email: clientUser.email,
              client_phone: clientUser.phone || null,
            },
            assigned_employees: [],
            assigned_supervisors: [],
          },
          {
            _id: uuidv4(),
            name: 'Residential Apartment Building',
            location: '456 Oak Avenue',
            start_date: new Date('2024-02-01'),
            end_date: new Date('2024-09-30'),
            description: '5-story residential apartment complex',
            budget: mongoose.Types.Decimal128.fromString('3500000'),
            client: {
              client_id: clientUser._id.toString(),
              client_name: clientUser.name,
              client_email: clientUser.email,
              client_phone: clientUser.phone || null,
            },
            assigned_employees: [],
            assigned_supervisors: [],
          },
          {
            _id: uuidv4(),
            name: 'Shopping Mall Expansion',
            location: '789 Commerce Boulevard',
            start_date: new Date('2024-01-15'),
            end_date: new Date('2024-08-31'),
            description: 'Expansion of existing shopping mall',
            budget: mongoose.Types.Decimal128.fromString('8000000'),
            client: {
              client_id: clientUser._id.toString(),
              client_name: clientUser.name,
              client_email: clientUser.email,
              client_phone: clientUser.phone || null,
            },
            assigned_employees: [],
            assigned_supervisors: [],
          },
        ];

        for (const projectData of sampleProjects) {
          const project = new ProjectMerged(projectData);
          await project.save();
          console.log(`   ✅ Created project: ${project.name}`);
        }
      }
    } else {
      console.log(`\n📋 Found ${projectsWithoutClient.length} project(s) without a client. Assigning...`);
      
      // Assign projects to client using updateOne to avoid validation issues
      for (const project of projectsWithoutClient) {
        await ProjectMerged.updateOne(
          { _id: project._id },
          {
            $set: {
              'client.client_id': clientUser._id.toString(),
              'client.client_name': clientUser.name,
              'client.client_email': clientUser.email,
              'client.client_phone': clientUser.phone || null,
            }
          }
        );
        console.log(`   ✅ Assigned project: ${project.name}`);
      }
    }

    // Get final count - check both string and ObjectId formats
    const clientIdString = clientUser._id.toString();
    const finalProjects = await ProjectMerged.find({
      $or: [
        { 'client.client_id': clientIdString },
        { 'client.client_id': clientUser._id }
      ]
    }).lean();

    console.log(`\n✅ Success! Client now has ${finalProjects.length} project(s) assigned.`);
    if (finalProjects.length > 0) {
      console.log('\n📋 Assigned Projects:');
      finalProjects.forEach(project => {
        const budget = project.budget ? parseFloat(project.budget.toString()) : 0;
        console.log(`   - ${project.name} (Budget: $${budget.toLocaleString()})`);
        console.log(`     Client ID in project: ${project.client?.client_id}`);
      });
    } else {
      console.log('\n⚠️  Warning: No projects found. Checking all projects...');
      const allProjects = await ProjectMerged.find({}).limit(5).lean();
      console.log(`   Found ${allProjects.length} total projects. Sample client IDs:`);
      allProjects.forEach(project => {
        console.log(`   - ${project.name}: client_id = ${project.client?.client_id || 'null'}`);
      });
    }

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run the script
assignProjectsToClient();

