/**
 * Fix All Client Issues
 * 1. Ensures client user exists with correct password
 * 2. Updates ALL projects to use the correct client_id (MongoDB ObjectId)
 * 3. Verifies the assignments
 */

const mongoose = require('mongoose');
const User = require('../models/User');
const ProjectMerged = require('../models/ProjectMerged');
const env = require('../config/env');
const bcrypt = require('bcrypt');

async function fixAllClientIssues() {
  try {
    await mongoose.connect(env.mongodbUri);
    console.log('✅ Connected to MongoDB\n');

    const clientEmail = 'john.smith@client.com';
    const normalizedEmail = clientEmail.toLowerCase().trim();

    // 1. Ensure client user exists
    console.log('1. Checking client user...');
    let clientUser = await User.findOne({ email: normalizedEmail, role: 'CLIENT' });
    
    if (!clientUser) {
      console.log('   Creating client user...');
      const { v4: uuidv4 } = require('uuid');
      clientUser = new User({
        _id: uuidv4(),
        name: 'John Smith',
        email: normalizedEmail,
        password: 'Client@123',
        role: 'CLIENT',
        phone: '+1-555-0100',
        isActive: true,
      });
      await clientUser.save();
      console.log('   ✅ Client user created');
    } else {
      console.log(`   ✅ Client user found: ${clientUser.name}`);
      // Ensure password is correct
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('Client@123', salt);
      await User.updateOne(
        { _id: clientUser._id },
        { $set: { password: hashedPassword } }
      );
      console.log('   ✅ Password updated');
    }

    const clientId = clientUser._id.toString();
    console.log(`   Client ID: ${clientId}\n`);

    // 2. Get ALL projects
    console.log('2. Finding all projects...');
    const allProjects = await ProjectMerged.find({}).lean();
    console.log(`   Found ${allProjects.length} total project(s)\n`);

    // 3. Update ALL projects to use this client
    console.log('3. Updating projects to use correct client_id...');
    let updated = 0;
    for (const project of allProjects) {
      await ProjectMerged.updateOne(
        { _id: project._id },
        {
          $set: {
            'client.client_id': clientId,
            'client.client_name': clientUser.name,
            'client.client_email': clientUser.email,
            'client.client_phone': clientUser.phone || null,
          }
        }
      );
      updated++;
      console.log(`   ✅ Updated: ${project.name}`);
    }

    console.log(`\n✅ Updated ${updated} project(s)\n`);

    // 4. Verify assignments
    console.log('4. Verifying assignments...');
    const assignedProjects = await ProjectMerged.find({
      'client.client_id': clientId
    }).lean();

    console.log(`   Found ${assignedProjects.length} project(s) assigned to client\n`);
    
    if (assignedProjects.length > 0) {
      let totalBudget = 0;
      let activeCount = 0;
      const now = new Date();
      
      console.log('📋 Project Details:');
      assignedProjects.forEach((project, index) => {
        const budget = project.budget ? parseFloat(project.budget.toString()) : 0;
        totalBudget += budget;
        const isActive = !project.end_date || new Date(project.end_date) > now;
        if (isActive) activeCount++;
        
        console.log(`   ${index + 1}. ${project.name}`);
        console.log(`      Budget: $${budget.toLocaleString()}`);
        console.log(`      Status: ${isActive ? 'Active' : 'Completed'}`);
        console.log(`      Client ID in DB: ${project.client?.client_id}`);
        console.log('');
      });
      
      console.log('📊 Summary:');
      console.log(`   Total Projects: ${assignedProjects.length}`);
      console.log(`   Active Projects: ${activeCount}`);
      console.log(`   Completed Projects: ${assignedProjects.length - activeCount}`);
      console.log(`   Total Budget: $${totalBudget.toLocaleString()}`);
    } else {
      console.log('⚠️  WARNING: No projects found!');
      console.log('   Checking first 3 projects...');
      const sampleProjects = await ProjectMerged.find({}).limit(3).lean();
      sampleProjects.forEach(project => {
        console.log(`   - ${project.name}`);
        console.log(`     client_id type: ${typeof project.client?.client_id}`);
        console.log(`     client_id value: ${project.client?.client_id}`);
        console.log(`     Expected: ${clientId}`);
        console.log('');
      });
    }

    await mongoose.disconnect();
    console.log('\n✅ Done! Please try logging in again.');
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

fixAllClientIssues();

