/**
 * Assign Supervisors to All Clients
 * 
 * This script ensures that every client has at least one supervisor assigned.
 * If a client doesn't have a supervisor, it creates a new one.
 * 
 * Usage: node scripts/assign_supervisors_to_all_clients.js
 */

const db = require('../config/db');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

async function assignSupervisorsToAllClients() {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');
    console.log('🌱 Starting supervisor assignment process...\n');

    // Get all clients
    const clientsResult = await client.query(
      `SELECT id, name, email FROM users WHERE role = 'client' ORDER BY created_at`
    );
    const clients = clientsResult.rows;
    
    console.log(`Found ${clients.length} clients\n`);

    // Get existing supervisors and their client assignments
    const supervisorsResult = await client.query(
      `SELECT id, name, email, client_user_id FROM supervisors ORDER BY created_at`
    );
    const supervisors = supervisorsResult.rows;
    
    console.log(`Found ${supervisors.length} existing supervisors\n`);

    // Track which clients need supervisors
    const clientsNeedingSupervisors = [];
    
    for (const clientRecord of clients) {
      const assignedSupervisors = supervisors.filter(
        s => s.client_user_id === clientRecord.id
      );
      
      if (assignedSupervisors.length === 0) {
        clientsNeedingSupervisors.push(clientRecord);
        console.log(`⚠️  ${clientRecord.name} needs a supervisor`);
      } else {
        console.log(`✅ ${clientRecord.name} has ${assignedSupervisors.length} supervisor(s)`);
      }
    }

    console.log(`\n📊 Summary: ${clientsNeedingSupervisors.length} clients need supervisors\n`);

    // Create supervisors for clients that need them
    if (clientsNeedingSupervisors.length > 0) {
      console.log('Creating new supervisors...\n');
      
      for (let i = 0; i < clientsNeedingSupervisors.length; i++) {
        const clientRecord = clientsNeedingSupervisors[i];
        
        // Generate supervisor details based on client name
        const supervisorName = `${clientRecord.name.split(' ')[0]} Supervisor`;
        const supervisorEmail = `supervisor.${clientRecord.email.split('@')[0]}@example.com`;
        const supervisorPassword = 'supervisor123';
        const supervisorPhone = `+1-555-${String(1000 + i).padStart(4, '0')}`;
        
        // Check if supervisor with this email already exists
        const existingSupervisor = await client.query(
          'SELECT id FROM supervisors WHERE email = $1',
          [supervisorEmail]
        );
        
        if (existingSupervisor.rows.length > 0) {
          // Update existing supervisor to assign to this client
          const supervisorId = existingSupervisor.rows[0].id;
          await client.query(
            'UPDATE supervisors SET client_user_id = $1 WHERE id = $2',
            [clientRecord.id, supervisorId]
          );
          console.log(`   ✅ Assigned existing supervisor to ${clientRecord.name}`);
        } else {
          // Create new supervisor
          const supervisorId = crypto.randomUUID();
          const passwordHash = await bcrypt.hash(supervisorPassword, 12);
          
          await client.query(
            `INSERT INTO supervisors (id, name, email, password_hash, phone, client_user_id)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [supervisorId, supervisorName, supervisorEmail, passwordHash, supervisorPhone, clientRecord.id]
          );
          
          console.log(`   ✅ Created supervisor "${supervisorName}" for ${clientRecord.name}`);
          console.log(`      Email: ${supervisorEmail}`);
          console.log(`      Password: ${supervisorPassword}`);
        }
      }
    }

    await client.query('COMMIT');
    console.log('\n✅ Supervisor assignment completed successfully!\n');

    // Verify the results
    console.log('📊 Final Verification:\n');
    const finalClients = await client.query(
      `SELECT id, name FROM users WHERE role = 'client' ORDER BY created_at`
    );
    
    for (const clientRecord of finalClients.rows) {
      const supervisorCount = await client.query(
        'SELECT COUNT(*) as count FROM supervisors WHERE client_user_id = $1',
        [clientRecord.id]
      );
      const count = parseInt(supervisorCount.rows[0].count);
      console.log(`   ${clientRecord.name}: ${count} supervisor(s)`);
    }

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error assigning supervisors:', error);
    throw error;
  } finally {
    client.release();
    await db.pool.end();
  }
}

// Run the script
assignSupervisorsToAllClients()
  .then(() => {
    console.log('\n✨ Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
  });

