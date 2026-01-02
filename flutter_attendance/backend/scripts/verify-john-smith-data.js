/**
 * Script to verify John Smith's data and show login credentials
 */

require('dotenv').config();
const env = require('../config/env');
const mongoose = require('mongoose');
const User = require('../models/User');
const ProjectMerged = require('../models/ProjectMerged');
const EmployeeMerged = require('../models/EmployeeMerged');
const AttendanceMerged = require('../models/AttendanceMerged');

async function verifyJohnSmithData() {
  try {
    console.log('🔍 Verifying John Smith Client Data...\n');
    console.log(`📊 Database Provider: ${env.dbProvider.toUpperCase()}\n`);

    if (env.dbProvider !== 'mongodb') {
      console.log('⚠️  This script is for MongoDB only.');
      return;
    }

    // Connect to MongoDB
    if (mongoose.connection.readyState === 0) {
      console.log('🔌 Connecting to MongoDB...');
      await mongoose.connect(env.mongodbUri);
      console.log('✅ Connected to MongoDB\n');
    }

    // Find John Smith
    const johnSmith = await User.findOne({ 
      email: 'john.smith@example.com',
      role: 'CLIENT'
    }).lean();

    if (!johnSmith) {
      console.log('❌ John Smith client not found!');
      console.log('\n📋 Available clients:');
      const allClients = await User.find({ role: 'CLIENT' }).lean();
      allClients.forEach(c => {
        console.log(`   - ${c.name} (${c.email}) - ID: ${c._id}`);
      });
      await mongoose.disconnect();
      return;
    }

    console.log('✅ John Smith Found!\n');
    console.log('📋 Login Credentials:');
    console.log(`   Email: ${johnSmith.email}`);
    console.log(`   Password: Client123!`);
    console.log(`   User ID: ${johnSmith._id}`);
    console.log(`   Role: ${johnSmith.role}\n`);

    // Check projects
    const projects = await ProjectMerged.find({
      'client.client_id': johnSmith._id.toString()
    }).lean();

    console.log(`📊 Projects Assigned: ${projects.length}`);
    if (projects.length > 0) {
      projects.forEach((p, i) => {
        const budget = p.budget ? parseFloat(p.budget.toString()) : 0;
        console.log(`   ${i + 1}. ${p.name}`);
        console.log(`      Location: ${p.location || 'N/A'}`);
        console.log(`      Budget: $${budget.toLocaleString()}`);
        console.log(`      Employees: ${p.assigned_employees?.filter(e => e.status === 'active').length || 0}`);
        console.log(`      Supervisors: ${p.assigned_supervisors?.filter(s => s.status === 'active').length || 0}`);
      });
    } else {
      console.log('   ⚠️  No projects assigned to John Smith!');
    }

    // Check supervisors
    const supervisorIds = new Set();
    projects.forEach(p => {
      if (p.assigned_supervisors) {
        p.assigned_supervisors.forEach(s => {
          if (s.status === 'active') {
            supervisorIds.add(s.supervisor_id);
          }
        });
      }
    });

    const supervisors = await User.find({
      _id: { $in: Array.from(supervisorIds) }
    }).lean();

    console.log(`\n📊 Supervisors: ${supervisors.length}`);
    supervisors.forEach((s, i) => {
      console.log(`   ${i + 1}. ${s.name} (${s.email})`);
    });

    // Check employees
    const employeeIds = new Set();
    projects.forEach(p => {
      if (p.assigned_employees) {
        p.assigned_employees.forEach(e => {
          if (e.status === 'active') {
            employeeIds.add(e.employee_id);
          }
        });
      }
    });

    const employees = await EmployeeMerged.find({
      _id: { $in: Array.from(employeeIds) }
    }).lean();

    console.log(`\n📊 Employees/Staff: ${employees.length}`);
    employees.forEach((e, i) => {
      console.log(`   ${i + 1}. ${e.name} (${e.email || 'N/A'}) - ${e.role || 'N/A'}`);
    });

    // Check attendance
    const employeeUserIds = employees.map(e => e.user_id).filter(Boolean);
    const attendanceCount = await AttendanceMerged.countDocuments({
      user_id: { $in: employeeUserIds }
    });

    console.log(`\n📊 Attendance Records: ${attendanceCount}`);

    // Calculate stats
    const activeProjects = projects.filter(p => {
      if (!p.end_date) return true;
      return new Date(p.end_date) > new Date();
    }).length;

    const completedProjects = projects.filter(p => {
      if (!p.end_date) return false;
      return new Date(p.end_date) <= new Date();
    }).length;

    const totalBudget = projects.reduce((sum, p) => {
      const budget = p.budget ? parseFloat(p.budget.toString()) : 0;
      return sum + budget;
    }, 0);

    console.log('\n📊 Dashboard Stats:');
    console.log(`   Total Projects: ${projects.length}`);
    console.log(`   Active Projects: ${activeProjects}`);
    console.log(`   Completed Projects: ${completedProjects}`);
    console.log(`   Total Budget: $${totalBudget.toLocaleString()}`);

    console.log('\n✅ Verification Complete!');
    console.log('\n🔑 Use these credentials to login:');
    console.log(`   Email: ${johnSmith.email}`);
    console.log(`   Password: Client123!`);

  } catch (error) {
    console.error('❌ Error verifying data:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the script
if (require.main === module) {
  verifyJohnSmithData()
    .then(() => {
      console.log('\n✅ Script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = verifyJohnSmithData;

