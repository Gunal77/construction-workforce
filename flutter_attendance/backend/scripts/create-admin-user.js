/**
 * Create/Reset Admin User in MongoDB
 * 
 * This script creates or updates an admin user in MongoDB
 * Usage: node scripts/create-admin-user.js
 */

const { connectMongoDB, disconnectMongoDB } = require('../config/mongodb');
const User = require('../models/User');
const bcrypt = require('bcrypt');

async function createAdminUser() {
  try {
    console.log('🔐 Creating/Updating Admin User...\n');
    
    await connectMongoDB();
    console.log('✅ Connected to MongoDB\n');

    const adminEmail = 'admin@example.com';
    const adminPassword = 'admin123';
    const adminName = 'Admin User';

    // Check if admin exists (by email first, then check role)
    let admin = await User.findOne({ email: adminEmail });

    if (admin) {
      console.log(`📝 User found with email: ${adminEmail}`);
      console.log(`   Current role: ${admin.role}`);
      
      // Update password and ensure role is ADMIN
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(adminPassword, salt);
      
      // Use updateOne to bypass pre-save hook
      await User.collection.updateOne(
        { _id: admin._id },
        { 
          $set: { 
            password: hashedPassword,
            role: 'ADMIN',
            isActive: true,
            updatedAt: new Date()
          } 
        }
      );
      
      console.log('   ✅ Password and role updated successfully');
      console.log(`\n📋 Login Credentials:`);
      console.log(`   Email: ${adminEmail}`);
      console.log(`   Password: ${adminPassword}`);
    } else {
      console.log(`➕ Creating new admin user: ${adminEmail}`);
      
      // Generate password hash
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(adminPassword, salt);
      
      // Create admin user
      const adminId = require('uuid').v4();
      await User.collection.insertOne({
        _id: adminId,
        name: adminName,
        email: adminEmail.toLowerCase().trim(),
        password: hashedPassword,
        role: 'ADMIN',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      
      console.log('   ✅ Admin user created successfully');
      console.log(`\n📋 Login Credentials:`);
      console.log(`   Email: ${adminEmail}`);
      console.log(`   Password: ${adminPassword}`);
    }

    // Verify the admin can be found
    const verifyAdmin = await User.findOne({ email: adminEmail, role: 'ADMIN' });
    if (verifyAdmin) {
      console.log(`\n✅ Verification: Admin user exists and is active`);
      console.log(`   ID: ${verifyAdmin._id}`);
      console.log(`   Email: ${verifyAdmin.email}`);
      console.log(`   Name: ${verifyAdmin.name}`);
      console.log(`   Role: ${verifyAdmin.role}`);
      console.log(`   Active: ${verifyAdmin.isActive}`);
    }

    console.log('\n✅ Done! You can now login with the credentials above.');

  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    process.exit(1);
  } finally {
    await disconnectMongoDB();
    console.log('\nMongoDB disconnected');
  }
}

// Run the script
if (require.main === module) {
  createAdminUser();
}

module.exports = { createAdminUser };

