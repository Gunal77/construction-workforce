const { pool } = require('../config/db');

async function linkProjectsToJohnSmith() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const johnSmithId = '40932f8c-a9b3-4a52-8ebb-766cc3b6b3df';
    const ramId = '9e5c8fab-4c85-4304-83e7-174774d52b24';
    
    console.log('🔄 Moving resources from Ram to John Smith...');
    
    // Move projects from Ram to John Smith
    const projectsResult = await client.query(`
      UPDATE projects
      SET client_user_id = $1
      WHERE client_user_id = $2
      RETURNING id, name
    `, [johnSmithId, ramId]);
    
    console.log(`✅ Moved ${projectsResult.rows.length} projects to John Smith`);
    
    // Move supervisors from Ram to John Smith
    const supervisorsResult = await client.query(`
      UPDATE supervisors
      SET client_user_id = $1
      WHERE client_user_id = $2
      RETURNING id, name
    `, [johnSmithId, ramId]);
    
    console.log(`✅ Moved ${supervisorsResult.rows.length} supervisors to John Smith`);
    
    // Move employees from Ram to John Smith
    const employeesResult = await client.query(`
      UPDATE employees
      SET client_user_id = $1
      WHERE client_user_id = $2
      RETURNING id, name
    `, [johnSmithId, ramId]);
    
    console.log(`✅ Moved ${employeesResult.rows.length} employees to John Smith`);
    
    await client.query('COMMIT');
    
    // Verify results
    console.log('\n📊 John Smith Stats:');
    const stats = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM projects WHERE client_user_id = $1) as projects,
        (SELECT COUNT(*) FROM supervisors WHERE client_user_id = $1) as supervisors,
        (SELECT COUNT(*) FROM employees WHERE client_user_id = $1) as employees
    `, [johnSmithId]);
    
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

linkProjectsToJohnSmith()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });

