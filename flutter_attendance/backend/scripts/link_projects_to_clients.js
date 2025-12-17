const { pool } = require('../config/db');

async function linkProjectsToClients() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('🔍 Finding clients...');
    
    // Get the first client (or John Smith specifically)
    const clientResult = await client.query(`
      SELECT id, name, email 
      FROM users 
      WHERE role = 'client' 
      ORDER BY created_at 
      LIMIT 1
    `);
    
    if (clientResult.rows.length === 0) {
      console.log('❌ No clients found!');
      await client.query('ROLLBACK');
      return;
    }
    
    const clientUser = clientResult.rows[0];
    console.log(`✅ Found client: ${clientUser.name} (${clientUser.email})`);
    console.log(`   Client ID: ${clientUser.id}`);
    
    // Link all unassigned projects
    const projectsResult = await client.query(`
      UPDATE projects
      SET client_user_id = $1
      WHERE client_user_id IS NULL
      RETURNING id, name
    `, [clientUser.id]);
    
    console.log(`✅ Linked ${projectsResult.rows.length} projects to client`);
    if (projectsResult.rows.length > 0) {
      projectsResult.rows.forEach(p => console.log(`   - ${p.name}`));
    }
    
    // Link all unassigned supervisors
    const supervisorsResult = await client.query(`
      UPDATE supervisors
      SET client_user_id = $1
      WHERE client_user_id IS NULL
      RETURNING id, name
    `, [clientUser.id]);
    
    console.log(`✅ Linked ${supervisorsResult.rows.length} supervisors to client`);
    if (supervisorsResult.rows.length > 0) {
      supervisorsResult.rows.forEach(s => console.log(`   - ${s.name}`));
    }
    
    // Link all unassigned employees
    const employeesResult = await client.query(`
      UPDATE employees
      SET client_user_id = $1
      WHERE client_user_id IS NULL
      RETURNING id, name
    `, [clientUser.id]);
    
    console.log(`✅ Linked ${employeesResult.rows.length} employees/staff to client`);
    if (employeesResult.rows.length > 0) {
      employeesResult.rows.forEach(e => console.log(`   - ${e.name}`));
    }
    
    await client.query('COMMIT');
    
    // Verify results
    console.log('\n📊 Verification:');
    const stats = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM projects WHERE client_user_id = $1) as projects,
        (SELECT COUNT(*) FROM supervisors WHERE client_user_id = $1) as supervisors,
        (SELECT COUNT(*) FROM employees WHERE client_user_id = $1) as employees
    `, [clientUser.id]);
    
    console.log(`   Total Projects: ${stats.rows[0].projects}`);
    console.log(`   Total Supervisors: ${stats.rows[0].supervisors}`);
    console.log(`   Total Employees: ${stats.rows[0].employees}`);
    
    console.log('\n✨ Done!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

linkProjectsToClients()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });

