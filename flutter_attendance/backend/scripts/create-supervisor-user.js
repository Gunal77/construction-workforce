/**
 * Create Supervisor User Script
 * 
 * Creates a supervisor user in MongoDB for testing
 * 
 * Usage: node scripts/create-supervisor-user.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const { connectMongoDB } = require('../config/mongodb');

const SUPERVISOR_EMAIL = 'sarah@example.com';
const SUPERVISOR_PASSWORD = 'supervisor123';
const SUPERVISOR_NAME = 'Sarah Supervisor';
const SUPERVISOR_PHONE = '+1-555-1000';

async function createSupervisorUser() {
  try {
    // Connect to MongoDB
    await connectMongoDB();
    console.log('✅ Connected to MongoDB\n');

    // Check if supervisor already exists
    const existingSupervisor = await User.findOne({
      email: SUPERVISOR_EMAIL.toLowerCase(),
      role: { $in: ['SUPERVISOR', 'supervisor'] }
    });

    if (existingSupervisor) {
      console.log(`⚠️  Supervisor with email ${SUPERVISOR_EMAIL} already exists.`);
      console.log(`   Updating password...`);
      
      // Update password
      existingSupervisor.password = SUPERVISOR_PASSWORD;
      await existingSupervisor.save();
      
      console.log(`✅ Password updated for supervisor: ${SUPERVISOR_EMAIL}`);
      console.log(`\n📋 Supervisor Login Credentials:`);
      console.log(`   Email: ${SUPERVISOR_EMAIL}`);
      console.log(`   Password: ${SUPERVISOR_PASSWORD}`);
      console.log(`   Name: ${existingSupervisor.name || SUPERVISOR_NAME}`);
      console.log(`   Role: ${existingSupervisor.role}`);
      console.log(`   Active: ${existingSupervisor.isActive !== false ? 'Yes' : 'No'}`);
      
      await mongoose.disconnect();
      return;
    }

    // Create new supervisor user
    console.log('Creating supervisor user...');
    const supervisor = new User({
      email: SUPERVISOR_EMAIL.toLowerCase(),
      password: SUPERVISOR_PASSWORD, // Will be hashed by pre-save hook
      name: SUPERVISOR_NAME,
      phone: SUPERVISOR_PHONE,
      role: 'SUPERVISOR',
      isActive: true,
    });

    await supervisor.save();

    console.log(`✅ Supervisor user created successfully!\n`);
    console.log(`📋 Supervisor Login Credentials:`);
    console.log(`   Email: ${SUPERVISOR_EMAIL}`);
    console.log(`   Password: ${SUPERVISOR_PASSWORD}`);
    console.log(`   Name: ${SUPERVISOR_NAME}`);
    console.log(`   Role: SUPERVISOR`);
    console.log(`   Active: Yes`);

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error creating supervisor user:', error);
    process.exit(1);
  }
}

// Run the script
createSupervisorUser();

