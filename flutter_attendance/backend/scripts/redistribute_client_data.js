const { pool } = require('../config/db');

async function redistributeClientData() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('🔄 Redistributing data across all clients...\n');
    
    // Get all clients
    const clientsResult = await client.query(`
      SELECT id, name, email 
      FROM users 
      WHERE role = 'client' 
      ORDER BY created_at
    `);
    
    if (clientsResult.rows.length === 0) {
      console.log('❌ No clients found!');
      await client.query('ROLLBACK');
      return;
    }
    
    const clients = clientsResult.rows;
    console.log(`✅ Found ${clients.length} clients:`);
    clients.forEach((c, i) => console.log(`   ${i+1}. ${c.name} (${c.email})`));
    
    // Get all projects
    const allProjects = await client.query('SELECT id, name FROM projects ORDER BY created_at');
    console.log(`\n📦 Total Projects: ${allProjects.rows.length}`);
    
    // Get all supervisors
    const allSupervisors = await client.query('SELECT id, name FROM supervisors ORDER BY created_at');
    console.log(`👥 Total Supervisors: ${allSupervisors.rows.length}`);
    
    // Get all employees
    const allEmployees = await client.query('SELECT id, name FROM employees ORDER BY created_at');
    console.log(`👷 Total Employees: ${allEmployees.rows.length}`);
    
    // Distribute projects evenly across clients
    console.log('\n📦 Distributing projects...');
    const projectsPerClient = Math.ceil(allProjects.rows.length / clients.length);
    for (let i = 0; i < clients.length; i++) {
      const clientId = clients[i].id;
      const startIdx = i * projectsPerClient;
      const endIdx = Math.min(startIdx + projectsPerClient, allProjects.rows.length);
      const clientProjects = allProjects.rows.slice(startIdx, endIdx);
      
      if (clientProjects.length > 0) {
        const projectIds = clientProjects.map(p => p.id);
        await client.query(
          `UPDATE projects SET client_user_id = $1 WHERE id = ANY($2::uuid[])`,
          [clientId, projectIds]
        );
        console.log(`   ✅ ${clients[i].name}: ${clientProjects.length} projects`);
        clientProjects.slice(0, 3).forEach(p => console.log(`      - ${p.name}`));
      }
    }
    
    // Distribute supervisors evenly across clients
    console.log('\n👥 Distributing supervisors...');
    const supervisorsPerClient = Math.ceil(allSupervisors.rows.length / clients.length);
    for (let i = 0; i < clients.length; i++) {
      const clientId = clients[i].id;
      const startIdx = i * supervisorsPerClient;
      const endIdx = Math.min(startIdx + supervisorsPerClient, allSupervisors.rows.length);
      const clientSupervisors = allSupervisors.rows.slice(startIdx, endIdx);
      
      if (clientSupervisors.length > 0) {
        const supervisorIds = clientSupervisors.map(s => s.id);
        await client.query(
          `UPDATE supervisors SET client_user_id = $1 WHERE id = ANY($2::uuid[])`,
          [clientId, supervisorIds]
        );
        console.log(`   ✅ ${clients[i].name}: ${clientSupervisors.length} supervisors`);
        clientSupervisors.forEach(s => console.log(`      - ${s.name}`));
      }
    }
    
    // Distribute employees evenly across clients
    console.log('\n👷 Distributing employees...');
    const employeesPerClient = Math.ceil(allEmployees.rows.length / clients.length);
    for (let i = 0; i < clients.length; i++) {
      const clientId = clients[i].id;
      const startIdx = i * employeesPerClient;
      const endIdx = Math.min(startIdx + employeesPerClient, allEmployees.rows.length);
      const clientEmployees = allEmployees.rows.slice(startIdx, endIdx);
      
      if (clientEmployees.length > 0) {
        const employeeIds = clientEmployees.map(e => e.id);
        await client.query(
          `UPDATE employees SET client_user_id = $1 WHERE id = ANY($2::uuid[])`,
          [clientId, employeeIds]
        );
        console.log(`   ✅ ${clients[i].name}: ${clientEmployees.length} employees`);
        clientEmployees.slice(0, 3).forEach(e => console.log(`      - ${e.name}`));
      }
    }
    
    await client.query('COMMIT');
    
    // Verify distribution
    console.log('\n📊 Final Distribution:');
    for (const c of clients) {
      const stats = await client.query(`
        SELECT 
          (SELECT COUNT(*) FROM projects WHERE client_user_id = $1) as projects,
          (SELECT COUNT(*) FROM supervisors WHERE client_user_id = $1) as supervisors,
          (SELECT COUNT(*) FROM employees WHERE client_user_id = $1) as employees
      `, [c.id]);
      
      console.log(`\n   ${c.name}:`);
      console.log(`      Projects: ${stats.rows[0].projects}`);
      console.log(`      Supervisors: ${stats.rows[0].supervisors}`);
      console.log(`      Employees: ${stats.rows[0].employees}`);
    }
    
    console.log('\n✨ Data redistribution completed successfully!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

redistributeClientData()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });

