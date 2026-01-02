/**
 * Fix Client Project Assignments
 * Updates all projects to use the correct client_id (MongoDB ObjectId format)
 */

const mongoose = require('mongoose');
const User = require('../models/User');
const ProjectMerged = require('../models/ProjectMerged');
const env = require('../config/env');

async function fixClientProjectAssignments() {
  try {
    await mongoose.connect(env.mongodbUri);
    console.log('✅ Connected to MongoDB\n');

    const clientEmail = 'john.smith@client.com';
    const normalizedEmail = clientEmail.toLowerCase().trim();

    // Find the client user
    const clientUser = await User.findOne({ email: normalizedEmail, role: 'CLIENT' });
    if (!clientUser) {
      console.log('❌ Client user not found!');
      await mongoose.disconnect();
      return;
    }

    const clientId = clientUser._id.toString();
    console.log(`✅ Found client: ${clientUser.name}`);
    console.log(`   Client ID: ${clientId}\n`);

    // Find ALL projects (regardless of client_id)
    const allProjects = await ProjectMerged.find({}).lean();
    console.log(`📋 Found ${allProjects.length} total project(s)\n`);

    // Update all projects to use this client
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
      console.log(`✅ Updated: ${project.name}`);
    }

    console.log(`\n✅ Updated ${updated} project(s)\n`);

    // Verify
    const assignedProjects = await ProjectMerged.find({
      'client.client_id': clientId
    }).lean();

    console.log(`✅ Verification: Found ${assignedProjects.length} project(s) assigned to client\n`);
    
    if (assignedProjects.length > 0) {
      let totalBudget = 0;
      assignedProjects.forEach((project, index) => {
        const budget = project.budget ? parseFloat(project.budget.toString()) : 0;
        totalBudget += budget;
        console.log(`${index + 1}. ${project.name} - $${budget.toLocaleString()}`);
      });
      console.log(`\n💰 Total Budget: $${totalBudget.toLocaleString()}`);
    }

    await mongoose.disconnect();
    console.log('\n✅ Done!');
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

fixClientProjectAssignments();

