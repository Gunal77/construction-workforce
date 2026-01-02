/**
 * Verify and Fix Client Data
 * 1. Verifies client user exists
 * 2. Assigns projects to client if missing
 * 3. Verifies project assignments
 */

const mongoose = require('mongoose');
const User = require('../models/User');
const ProjectMerged = require('../models/ProjectMerged');
const env = require('../config/env');

async function verifyAndFixClientData() {
  try {
    // Connect to MongoDB
    await mongoose.connect(env.mongodbUri);
    console.log('✅ Connected to MongoDB\n');

    const clientEmail = 'john.smith@client.com';
    const normalizedEmail = clientEmail.toLowerCase().trim();

    // 1. Find the client user
    console.log('1. Checking client user...');
    const clientUser = await User.findOne({ email: normalizedEmail, role: 'CLIENT' });
    if (!clientUser) {
      console.log('❌ Client user not found. Creating...');
      const { v4: uuidv4 } = require('uuid');
      const bcrypt = require('bcrypt');
      
      const newUser = new User({
        _id: uuidv4(),
        name: 'John Smith',
        email: normalizedEmail,
        password: 'Client@123',
        role: 'CLIENT',
        phone: '+1-555-0100',
        isActive: true,
      });
      await newUser.save();
      console.log('✅ Client user created');
    } else {
      console.log(`✅ Client user found: ${clientUser.name} (${clientUser.email})`);
      console.log(`   User ID: ${clientUser._id.toString()}`);
    }

    const finalClientUser = clientUser || await User.findOne({ email: normalizedEmail });
    const clientId = finalClientUser._id.toString();

    // 2. Check existing project assignments
    console.log('\n2. Checking project assignments...');
    const existingProjects = await ProjectMerged.find({
      'client.client_id': clientId
    }).lean();

    console.log(`   Found ${existingProjects.length} project(s) already assigned`);

    // 3. Find projects without clients or assign new ones
    console.log('\n3. Assigning projects to client...');
    const projectsWithoutClient = await ProjectMerged.find({
      $or: [
        { 'client.client_id': { $exists: false } },
        { 'client.client_id': null },
        { 'client.client_id': '' },
        { 'client.client_id': { $ne: clientId } }
      ]
    }).limit(5).lean();

    if (projectsWithoutClient.length > 0) {
      console.log(`   Found ${projectsWithoutClient.length} project(s) to assign`);
      
      for (const project of projectsWithoutClient) {
        await ProjectMerged.updateOne(
          { _id: project._id },
          {
            $set: {
              'client.client_id': clientId,
              'client.client_name': finalClientUser.name,
              'client.client_email': finalClientUser.email,
              'client.client_phone': finalClientUser.phone || null,
            }
          }
        );
        console.log(`   ✅ Assigned: ${project.name}`);
      }
    } else if (existingProjects.length === 0) {
      console.log('   No projects available. Creating sample projects...');
      
      // Create 3 sample projects
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
            client_id: clientId,
            client_name: finalClientUser.name,
            client_email: finalClientUser.email,
            client_phone: finalClientUser.phone || null,
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
            client_id: clientId,
            client_name: finalClientUser.name,
            client_email: finalClientUser.email,
            client_phone: finalClientUser.phone || null,
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
            client_id: clientId,
            client_name: finalClientUser.name,
            client_email: finalClientUser.email,
            client_phone: finalClientUser.phone || null,
          },
          assigned_employees: [],
          assigned_supervisors: [],
        },
      ];

      for (const projectData of sampleProjects) {
        const project = new ProjectMerged(projectData);
        await project.save();
        console.log(`   ✅ Created: ${project.name}`);
      }
    }

    // 4. Final verification
    console.log('\n4. Final verification...');
    const finalProjects = await ProjectMerged.find({
      'client.client_id': clientId
    }).lean();

    console.log(`\n✅ SUCCESS! Client has ${finalProjects.length} project(s) assigned.\n`);
    
    if (finalProjects.length > 0) {
      console.log('📋 Assigned Projects:');
      let totalBudget = 0;
      finalProjects.forEach((project, index) => {
        const budget = project.budget ? parseFloat(project.budget.toString()) : 0;
        totalBudget += budget;
        const status = project.end_date && new Date(project.end_date) < new Date() ? 'Completed' : 'Active';
        console.log(`   ${index + 1}. ${project.name}`);
        console.log(`      Budget: $${budget.toLocaleString()}`);
        console.log(`      Status: ${status}`);
        console.log(`      Client ID: ${project.client?.client_id}`);
        console.log('');
      });
      console.log(`💰 Total Budget: $${totalBudget.toLocaleString()}`);
    } else {
      console.log('⚠️  WARNING: No projects found!');
      console.log('   This might be a query issue. Checking all projects...');
      const allProjects = await ProjectMerged.find({}).limit(3).lean();
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
verifyAndFixClientData();

