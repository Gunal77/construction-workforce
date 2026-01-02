/**
 * Fix Client User Password
 * Updates the password for john.smith@client.com
 */

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const env = require('../config/env');

async function fixClientPassword() {
  try {
    // Connect to MongoDB
    await mongoose.connect(env.mongodbUri);
    console.log('✅ Connected to MongoDB');

    const email = 'john.smith@client.com';
    const password = 'Client@123';
    const normalizedEmail = email.toLowerCase().trim();

    // Find the user
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      console.log('❌ Client user not found. Creating new user...');
      
      const { v4: uuidv4 } = require('uuid');
      const newUser = new User({
        _id: uuidv4(),
        name: 'John Smith',
        email: normalizedEmail,
        password, // Will be hashed by pre-save hook
        role: 'CLIENT',
        phone: '+1-555-0100',
        isActive: true,
      });
      await newUser.save();
      console.log('✅ Client user created!');
    } else {
      console.log('✅ Found client user. Updating password...');
      
      // Hash password manually
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      
      // Update password directly (bypass pre-save hook)
      await User.updateOne(
        { email: normalizedEmail },
        { $set: { password: hashedPassword } }
      );
      
      console.log('✅ Password updated successfully!');
    }

    console.log('\n📋 Client Login Credentials:');
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    console.log(`   Role: CLIENT`);

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run the script
fixClientPassword();

