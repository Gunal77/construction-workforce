/**
 * Script to create sample client data with proper password hashing
 * Run with: node scripts/createSampleClients.js
 */

const bcrypt = require('bcrypt');
const { pool, getClient } = require('../config/db');

const SAMPLE_PASSWORD = 'Client@123';

const sampleClients = [
  {
    email: 'client1@abcconstruction.com',
    name: 'John Smith',
    phone: '+65 91234567',
    companyName: 'ABC Construction Pte Ltd',
    contactPerson: 'John Smith',
    address: '123 Construction Street, Singapore 123456',
    projects: [
      {
        name: 'Residential Tower A',
        location: 'Marina Bay, Singapore',
        startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        endDate: new Date(Date.now() + 400 * 24 * 60 * 60 * 1000), // 400 days from now
        description: 'High-rise residential building with 50 floors',
        budget: 5000000.00,
      },
      {
        name: 'Commercial Complex B',
        location: 'Orchard Road, Singapore',
        startDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 500 * 24 * 60 * 60 * 1000),
        description: 'Mixed-use commercial and retail complex',
        budget: 8000000.00,
      },
    ],
  },
  {
    email: 'client2@xyzbuilders.com',
    name: 'Sarah Johnson',
    phone: '+65 98765432',
    companyName: 'XYZ Builders Singapore',
    contactPerson: 'Sarah Johnson',
    address: '456 Building Avenue, Singapore 456789',
    projects: [
      {
        name: 'Industrial Warehouse',
        location: 'Jurong East, Singapore',
        startDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 200 * 24 * 60 * 60 * 1000),
        description: 'Large-scale industrial warehouse facility',
        budget: 3000000.00,
      },
      {
        name: 'Office Building Renovation',
        location: 'Raffles Place, Singapore',
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Started 30 days ago
        endDate: new Date(Date.now() + 150 * 24 * 60 * 60 * 1000),
        description: 'Complete renovation of 20-story office building',
        budget: 2500000.00,
      },
    ],
  },
  {
    email: 'client3@modernconstruction.com',
    name: 'Michael Chen',
    phone: '+65 87654321',
    companyName: 'Modern Construction Group',
    contactPerson: 'Michael Chen',
    address: '789 Development Road, Singapore 789012',
    projects: [
      {
        name: 'Luxury Condominium',
        location: 'Sentosa Cove, Singapore',
        startDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 600 * 24 * 60 * 60 * 1000),
        description: 'Premium waterfront condominium development',
        budget: 12000000.00,
      },
    ],
  },
];

async function createSampleClients() {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Hash password once for all clients
    const passwordHash = await bcrypt.hash(SAMPLE_PASSWORD, 12);

    for (const clientData of sampleClients) {
      console.log(`Creating client: ${clientData.email}`);

      // Check if user already exists
      const existingUser = await client.query(
        'SELECT id FROM users WHERE email = $1',
        [clientData.email.toLowerCase()]
      );

      let userId;
      let profileId;

      if (existingUser.rows.length > 0) {
        console.log(`  User already exists, updating password and details...`);
        userId = existingUser.rows[0].id;

        // Update user with correct password hash and details
        await client.query(
          `UPDATE users 
           SET password_hash = $1, name = $2, phone = $3, is_active = TRUE, role = 'client', user_type = 'client'
           WHERE id = $4`,
          [passwordHash, clientData.name, clientData.phone, userId]
        );
        console.log(`  Updated user password and details for ID: ${userId}`);
      } else {
        // Insert into users table
        const userResult = await client.query(
          `INSERT INTO users (email, password_hash, role, user_type, name, phone, is_active, created_at)
           VALUES ($1, $2, 'client', 'client', $3, $4, TRUE, NOW())
           RETURNING id`,
          [clientData.email.toLowerCase(), passwordHash, clientData.name, clientData.phone]
        );
        userId = userResult.rows[0].id;
        console.log(`  Created user with ID: ${userId}`);
      }

      // Insert or update client profile
      const clientProfileResult = await client.query(
        `INSERT INTO clients (user_id, company_name, contact_person, address, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (user_id) 
         DO UPDATE SET company_name = $2, contact_person = $3, address = $4
         RETURNING id`,
        [userId, clientData.companyName, clientData.contactPerson, clientData.address]
      );
      profileId = clientProfileResult.rows[0].id;

      // Update users.profile_id
      await client.query('UPDATE users SET profile_id = $1 WHERE id = $2', [profileId, userId]);

      // Create projects for this client
      for (const project of clientData.projects) {
        const projectResult = await client.query(
          `INSERT INTO projects (name, location, start_date, end_date, description, budget, client_user_id, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
           ON CONFLICT DO NOTHING
           RETURNING id`,
          [
            project.name,
            project.location,
            project.startDate.toISOString().split('T')[0],
            project.endDate.toISOString().split('T')[0],
            project.description,
            project.budget,
            userId,
          ]
        );

        if (projectResult.rows.length > 0) {
          console.log(`  Created project: ${project.name}`);
        } else {
          console.log(`  Project already exists: ${project.name}`);
        }
      }
    }

    await client.query('COMMIT');
    console.log('\n✅ Sample clients created successfully!');
    console.log('\n📋 Login Credentials:');
    console.log('   Password for all clients: Client@123\n');
    sampleClients.forEach((c) => {
      console.log(`   ${c.email}`);
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error creating sample clients:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the script
createSampleClients()
  .then(() => {
    console.log('\n✅ Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

