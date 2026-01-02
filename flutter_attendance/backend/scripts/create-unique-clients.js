/**
 * Script to create 7 unique clients with unique names
 * This script will:
 * 1. Remove duplicate clients (keep only unique names)
 * 2. Create 7 unique clients with projects, supervisors, and staff
 * 
 * Usage: node scripts/create-unique-clients.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const env = require('../config/env');

// Import models
const User = require('../models/User');
const ProjectMerged = require('../models/ProjectMerged');
const EmployeeMerged = require('../models/EmployeeMerged');

// 7 unique clients with unique names
const uniqueClients = [
  {
    name: 'John Smith',
    email: 'john.smith@client.com',
    phone: '+65-9123-4567',
    password: 'Client123!',
    is_active: true
  },
  {
    name: 'Sarah Johnson',
    email: 'sarah.johnson@client.com',
    phone: '+65-9123-4568',
    password: 'Client123!',
    is_active: true
  },
  {
    name: 'Michael Chen',
    email: 'michael.chen@client.com',
    phone: '+65-9123-4569',
    password: 'Client123!',
    is_active: true
  },
  {
    name: 'Emily Davis',
    email: 'emily.davis@client.com',
    phone: '+65-9123-4570',
    password: 'Client123!',
    is_active: false // One inactive for testing
  },
  {
    name: 'David Wilson',
    email: 'david.wilson@client.com',
    phone: '+65-9123-4571',
    password: 'Client123!',
    is_active: true
  },
  {
    name: 'ABC Construction Ltd',
    email: 'contact@abcconstruction.com',
    phone: '+65-6123-4001',
    password: 'Client123!',
    is_active: true
  },
  {
    name: 'XYZ Developers Pte',
    email: 'info@xyzdevelopers.com',
    phone: '+65-6123-4002',
    password: 'Client123!',
    is_active: true
  }
];

// Sample projects for each client
const projectsPerClient = [
  {
    name: 'Downtown Office Complex',
    location: '123 Main Street, Downtown',
    start_date: new Date('2024-01-01'),
    end_date: new Date('2024-12-31'),
    description: 'Construction of a 10-story office building',
    budget: 5000000
  },
  {
    name: 'Residential Apartment Building',
    location: '456 Oak Avenue, Midtown',
    start_date: new Date('2024-02-01'),
    end_date: new Date('2024-11-30'),
    description: '5-story residential apartment complex with 50 units',
    budget: 3500000
  },
  {
    name: 'Shopping Mall Expansion',
    location: '789 Commerce Boulevard, Uptown',
    start_date: new Date('2024-01-15'),
    end_date: new Date('2024-10-31'),
    description: 'Expansion of existing shopping mall with new wing',
    budget: 8000000
  }
];

async function createUniqueClients() {
  try {
    // Connect to MongoDB
    await mongoose.connect(env.mongodbUri);
    console.log('✅ Connected to MongoDB');

    // Step 1: Find all existing clients
    const existingClients = await User.find({ role: { $in: ['CLIENT', 'client'] } }).lean();
    console.log(`📊 Found ${existingClients.length} existing clients`);

    // Step 2: Group by name to find duplicates
    const clientsByName = new Map();
    existingClients.forEach(client => {
      const name = client.name?.trim();
      if (name) {
        if (!clientsByName.has(name)) {
          clientsByName.set(name, []);
        }
        clientsByName.get(name).push(client);
      }
    });

    // Step 3: Remove duplicate clients (keep the first one, delete others)
    // But first, check which clients we want to keep from our unique list
    const emailsToKeep = new Set(uniqueClients.map(c => c.email.toLowerCase()));
    let deletedCount = 0;
    
    for (const [name, clients] of clientsByName.entries()) {
      if (clients.length > 1) {
        console.log(`⚠️  Found ${clients.length} clients with name "${name}"`);
        // Keep clients that match our unique list, delete others
        const toDelete = clients.filter(c => !emailsToKeep.has(c.email?.toLowerCase()));
        for (const clientToDelete of toDelete) {
          // Delete associated projects, employees, etc.
          await ProjectMerged.deleteMany({ client_user_id: clientToDelete._id.toString() });
          await EmployeeMerged.deleteMany({ client_user_id: clientToDelete._id.toString() });
          await User.deleteOne({ _id: clientToDelete._id });
          deletedCount++;
          console.log(`  🗑️  Deleted duplicate client: ${name} (${clientToDelete.email})`);
        }
      }
    }

    // Also delete any clients not in our unique list
    const allClients = await User.find({ role: { $in: ['CLIENT', 'client'] } }).lean();
    for (const client of allClients) {
      if (!emailsToKeep.has(client.email?.toLowerCase())) {
        await ProjectMerged.deleteMany({ client_user_id: client._id.toString() });
        await EmployeeMerged.deleteMany({ client_user_id: client._id.toString() });
        await User.deleteOne({ _id: client._id });
        deletedCount++;
        console.log(`  🗑️  Deleted client not in unique list: ${client.name} (${client.email})`);
      }
    }

    if (deletedCount > 0) {
      console.log(`✅ Removed ${deletedCount} duplicate/unwanted clients`);
    }

    // Step 4: Create/update 7 unique clients
    const createdClients = [];
    const createdProjects = [];
    const createdEmployees = [];

    for (let i = 0; i < uniqueClients.length; i++) {
      const clientData = uniqueClients[i];
      
      // Check if client already exists by email
      let client = await User.findOne({ email: clientData.email.toLowerCase() }).lean();
      
      if (client && client._id) {
        // Update existing client to ensure correct name and status
        await User.collection.updateOne(
          { _id: client._id },
          {
            $set: {
              name: clientData.name,
              is_active: clientData.is_active !== false,
              updated_at: new Date()
            }
          }
        );
        // Re-fetch to get updated data
        const updatedClient = await User.collection.findOne({ _id: client._id });
        if (updatedClient) {
          client = updatedClient;
          console.log(`✅ Updated client: ${clientData.name} (${clientData.email})`);
        } else {
          // If update failed, create new
          client = null;
        }
      }
      
      if (!client) {
        // Create new client
        const passwordHash = await bcrypt.hash(clientData.password, 10);
        const clientDoc = {
          _id: new mongoose.Types.ObjectId(),
          email: clientData.email.toLowerCase(),
          password_hash: passwordHash,
          role: 'CLIENT',
          name: clientData.name,
          phone: clientData.phone,
          is_active: clientData.is_active !== false,
          created_at: new Date(),
          updated_at: new Date()
        };

        await User.collection.insertOne(clientDoc);
        client = { ...clientDoc, _id: clientDoc._id };
        console.log(`✅ Created client: ${clientData.name} (${clientData.email})`);
      }

      createdClients.push(client);
      const clientId = client._id.toString();

      // Check if client already has projects
      const existingProjects = await ProjectMerged.find({ client_user_id: clientId }).lean();
      
      if (existingProjects.length === 0) {
        // Create projects for this client
        const clientProjects = [];

        for (let j = 0; j < projectsPerClient.length; j++) {
          const projectData = projectsPerClient[j];
          
          const projectDoc = {
            _id: new mongoose.Types.ObjectId(),
            name: projectData.name,
            location: projectData.location,
            start_date: projectData.start_date,
            end_date: projectData.end_date,
            description: projectData.description,
            budget: mongoose.Types.Decimal128.fromString(projectData.budget.toString()),
            client_user_id: clientId,
            status: 'active',
            created_at: new Date(),
            updated_at: new Date(),
            assigned_supervisors: [],
            assigned_employees: []
          };

          await ProjectMerged.collection.insertOne(projectDoc);
          const project = { ...projectDoc, _id: projectDoc._id };
          clientProjects.push(project);
          createdProjects.push(project);
          console.log(`  ✅ Created project: ${projectData.name} for ${clientData.name}`);
        }

        // Create supervisors for this client
        const supervisorNames = [
          `Supervisor ${i + 1}A`,
          `Supervisor ${i + 1}B`
        ];

        const supervisorUsers = [];
        for (let k = 0; k < supervisorNames.length; k++) {
          const supervisorName = supervisorNames[k];
          const supervisorEmail = `supervisor${i + 1}${k === 0 ? 'a' : 'b'}@client${i + 1}.com`;
          
          let supervisor = await User.findOne({ email: supervisorEmail.toLowerCase() }).lean();
          
          if (!supervisor) {
            const supervisorPasswordHash = await bcrypt.hash('Supervisor123!', 10);
            const supervisorDoc = {
              _id: new mongoose.Types.ObjectId(),
              email: supervisorEmail.toLowerCase(),
              password_hash: supervisorPasswordHash,
              role: 'SUPERVISOR',
              name: supervisorName,
              phone: `+65-9123-${5000 + i * 10 + k}`,
              is_active: true,
              created_at: new Date(),
              updated_at: new Date()
            };

            await User.collection.insertOne(supervisorDoc);
            supervisor = { ...supervisorDoc, _id: supervisorDoc._id };
            console.log(`  ✅ Created supervisor: ${supervisorName} for ${clientData.name}`);
          }
          
          supervisorUsers.push(supervisor);
        }

        // Assign supervisors to projects
        for (let p = 0; p < clientProjects.length; p++) {
          const project = clientProjects[p];
          const supervisorIndex = p % supervisorUsers.length;
          const supervisorId = supervisorUsers[supervisorIndex]._id.toString();

          await ProjectMerged.collection.updateOne(
            { _id: project._id },
            { $push: { assigned_supervisors: supervisorId } }
          );
          console.log(`  ✅ Assigned supervisor ${supervisorUsers[supervisorIndex].name} to project ${project.name}`);
        }

        // Create employees/staff for this client
        const employeeNames = [
          `Employee ${i + 1}-1`,
          `Employee ${i + 1}-2`,
          `Employee ${i + 1}-3`
        ];

        for (let e = 0; e < employeeNames.length; e++) {
          const employeeName = employeeNames[e];
          const employeeEmail = `employee${i + 1}${e + 1}@client${i + 1}.com`;
          
          let employee = await EmployeeMerged.findOne({ email: employeeEmail.toLowerCase() }).lean();
          
          if (!employee) {
            // Create user for employee
            const employeeUserPasswordHash = await bcrypt.hash('Employee123!', 10);
            const employeeUserDoc = {
              _id: new mongoose.Types.ObjectId(),
              email: employeeEmail.toLowerCase(),
              password_hash: employeeUserPasswordHash,
              role: 'STAFF',
              name: employeeName,
              phone: `+65-9123-${6000 + i * 10 + e}`,
              is_active: true,
              created_at: new Date(),
              updated_at: new Date()
            };

            await User.collection.insertOne(employeeUserDoc);
            const employeeUser = { ...employeeUserDoc, _id: employeeUserDoc._id };

            // Create employee record
            const employeeDoc = {
              _id: new mongoose.Types.ObjectId(),
              user_id: employeeUser._id.toString(),
              name: employeeName,
              email: employeeEmail.toLowerCase(),
              phone: `+65-9123-${6000 + i * 10 + e}`,
              role: 'STAFF',
              client_user_id: clientId,
              project_assignments: [{
                project_id: clientProjects[0]._id.toString(),
                assignment_start_date: new Date(),
                status: 'active'
              }],
              created_at: new Date(),
              updated_at: new Date()
            };

            await EmployeeMerged.collection.insertOne(employeeDoc);
            employee = { ...employeeDoc, _id: employeeDoc._id };
            createdEmployees.push(employee);
            console.log(`  ✅ Created employee: ${employeeName} for ${clientData.name}`);

            // Update project with assigned employee
            await ProjectMerged.collection.updateOne(
              { _id: clientProjects[0]._id },
              { $push: { assigned_employees: employee._id.toString() } }
            );
          } else {
            createdEmployees.push(employee);
          }
        }
      } else {
        console.log(`  ⏭️  Client ${clientData.name} already has ${existingProjects.length} projects, skipping project creation`);
      }
    }

    console.log('\n✅ Script completed successfully!');
    console.log(`📊 Summary:`);
    console.log(`   - Duplicate clients removed: ${deletedCount}`);
    console.log(`   - Unique clients: ${createdClients.length}`);
    console.log(`   - Projects created: ${createdProjects.length}`);
    console.log(`   - Employees created: ${createdEmployees.length}`);
    console.log('\n📝 Client Login Credentials:');
    uniqueClients.forEach(client => {
      console.log(`   ${client.name}: ${client.email} / Client123!`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating unique clients:', error);
    process.exit(1);
  }
}

// Run the script
createUniqueClients();

