/**
 * Create a Client User for Testing
 * Creates a client user in MongoDB with the credentials:
 * Email: john.smith@client.com
 * Password: Client@123
 */

const mongoose = require('mongoose');
const User = require('../models/User');
const env = require('../config/env');
const { v4: uuidv4 } = require('uuid');

async function createClientUser() {
  try {
    // Connect to MongoDB
    await mongoose.connect(env.mongodbUri);
    console.log('✅ Connected to MongoDB');

    const email = 'john.smith@client.com';
    const password = 'Client@123';
    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      console.log('⚠️  Client user already exists.');
      console.log('\n📋 Client Login Credentials:');
      console.log(`   Email: ${email}`);
      console.log(`   Password: ${password}`);
      console.log('\n⚠️  If password doesn\'t work, delete the user and run this script again.');
      await mongoose.disconnect();
      return;
    }

    // Create new client user
    const userId = uuidv4();
    const clientUser = new User({
      _id: userId,
      name: 'John Smith',
      email: normalizedEmail,
      password, // Will be hashed by pre-save hook
      role: 'CLIENT',
      phone: '+1-555-0100',
      isActive: true,
    });

    await clientUser.save();
    console.log('✅ Client user created successfully!');
    console.log('\n📋 Client Login Credentials:');
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    console.log(`   Role: CLIENT`);
    console.log(`   User ID: ${userId}`);

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error creating client user:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run the script
createClientUser();

