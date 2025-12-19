/**
 * Seed Sample Monthly Summaries for All Staff
 * 
 * This script generates sample monthly summaries for all employees
 * with realistic data for testing the monthly summary approval flow.
 */

const db = require('../config/db');

// Sample data configuration
const SAMPLE_MONTH = 12; // December
const SAMPLE_YEAR = 2025;

// Helper function to generate random number between min and max
const randomBetween = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// Helper function to generate random decimal between min and max
const randomDecimal = (min, max) => parseFloat((Math.random() * (max - min) + min).toFixed(2));

// Generate sample project breakdown
const generateProjectBreakdown = (employeeId) => {
  // Randomly assign 1-3 projects per employee
  const numProjects = randomBetween(1, 3);
  const projects = [];
  
  // Get available projects from database
  return db.query('SELECT id, name FROM projects LIMIT 10')
    .then(result => {
      const availableProjects = result.rows;
      
      if (availableProjects.length === 0) {
        // If no projects exist, return empty breakdown
        return [];
      }
      
      // Randomly select projects
      const selectedProjects = [];
      const usedIndices = new Set();
      
      for (let i = 0; i < Math.min(numProjects, availableProjects.length); i++) {
        let idx;
        do {
          idx = randomBetween(0, availableProjects.length - 1);
        } while (usedIndices.has(idx));
        usedIndices.add(idx);
        selectedProjects.push(availableProjects[idx]);
      }
      
      // Generate breakdown for each project
      let remainingHours = randomDecimal(150, 200);
      let remainingOT = randomDecimal(10, 30);
      
      selectedProjects.forEach((project, index) => {
        const isLast = index === selectedProjects.length - 1;
        const daysWorked = randomBetween(15, 22);
        const totalHours = isLast ? remainingHours : randomDecimal(40, remainingHours / 2);
        const otHours = isLast ? remainingOT : randomDecimal(5, remainingOT / 2);
        
        remainingHours -= totalHours;
        remainingOT -= otHours;
        
        projects.push({
          project_id: project.id,
          project_name: project.name,
          days_worked: daysWorked,
          total_hours: parseFloat(totalHours.toFixed(2)),
          ot_hours: parseFloat(otHours.toFixed(2)),
        });
      });
      
      return projects;
    })
    .catch(() => {
      // If error fetching projects, return empty array
      return [];
    });
};

// Generate sample monthly summary for an employee
const generateSampleSummary = async (employeeId, employeeEmail) => {
  try {
    // Get user_id from email
    const userResult = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [employeeEmail]
    );
    
    if (userResult.rows.length === 0) {
      console.log(`  ⚠️  No user found for employee email: ${employeeEmail}`);
      return null;
    }
    
    const userId = userResult.rows[0].id;
    
    // Generate realistic sample data
    const totalWorkingDays = randomBetween(20, 26); // 20-26 working days
    const totalWorkedHours = randomDecimal(150, 200); // 150-200 hours
    const totalOtHours = randomDecimal(10, 35); // 10-35 OT hours
    const approvedLeaves = randomDecimal(0, 3); // 0-3 leave days
    const absentDays = randomBetween(0, 2); // 0-2 absent days
    
    // Generate project breakdown
    const projectBreakdown = await generateProjectBreakdown(employeeId);
    
    // Calculate days in month
    const daysInMonth = new Date(SAMPLE_YEAR, SAMPLE_MONTH, 0).getDate();
    
    // Insert monthly summary
    const result = await db.query(
      `INSERT INTO monthly_summaries (
        employee_id,
        month,
        year,
        total_working_days,
        total_worked_hours,
        total_ot_hours,
        approved_leaves,
        absent_days,
        project_breakdown,
        status,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'DRAFT', NOW(), NOW())
      ON CONFLICT (employee_id, month, year) 
      DO UPDATE SET
        total_working_days = EXCLUDED.total_working_days,
        total_worked_hours = EXCLUDED.total_worked_hours,
        total_ot_hours = EXCLUDED.total_ot_hours,
        approved_leaves = EXCLUDED.approved_leaves,
        absent_days = EXCLUDED.absent_days,
        project_breakdown = EXCLUDED.project_breakdown,
        status = CASE 
          WHEN monthly_summaries.status = 'APPROVED' THEN 'APPROVED'
          ELSE 'DRAFT'
        END,
        updated_at = NOW()
      RETURNING id`,
      [
        employeeId,
        SAMPLE_MONTH,
        SAMPLE_YEAR,
        totalWorkingDays,
        totalWorkedHours,
        totalOtHours,
        approvedLeaves,
        absentDays,
        JSON.stringify(projectBreakdown),
      ]
    );
    
    return result.rows[0].id;
  } catch (error) {
    console.error(`  ❌ Error generating summary for employee ${employeeId}:`, error.message);
    return null;
  }
};

// Main function
const seedMonthlySummaries = async () => {
  try {
    console.log('\n🌱 Starting Monthly Summaries Sample Data Generation...\n');
    console.log(`📅 Month: ${SAMPLE_MONTH}, Year: ${SAMPLE_YEAR}\n`);
    
    // Get all employees with email addresses
    const employeesResult = await db.query(
      `SELECT id, name, email FROM employees WHERE email IS NOT NULL AND email != ''`
    );
    
    if (employeesResult.rows.length === 0) {
      console.log('❌ No employees found with email addresses.');
      console.log('   Please ensure employees have email addresses before generating summaries.\n');
      process.exit(1);
    }
    
    const employees = employeesResult.rows;
    console.log(`📋 Found ${employees.length} employees with email addresses\n`);
    
    const results = {
      success: [],
      failed: [],
      skipped: [],
    };
    
    // Generate summary for each employee
    for (const employee of employees) {
      console.log(`Processing: ${employee.name} (${employee.email})...`);
      
      // Check if summary already exists and is approved
      const existingCheck = await db.query(
        `SELECT id, status FROM monthly_summaries 
         WHERE employee_id = $1 AND month = $2 AND year = $3`,
        [employee.id, SAMPLE_MONTH, SAMPLE_YEAR]
      );
      
      if (existingCheck.rows.length > 0) {
        const existing = existingCheck.rows[0];
        if (existing.status === 'APPROVED') {
          console.log(`  ⏭️  Summary already approved. Skipping...\n`);
          results.skipped.push({
            employee_id: employee.id,
            employee_name: employee.name,
            employee_email: employee.email,
            reason: 'Summary already approved',
          });
          continue;
        } else {
          console.log(`  🔄 Updating existing summary (status: ${existing.status})...`);
        }
      }
      
      const summaryId = await generateSampleSummary(employee.id, employee.email);
      
      if (summaryId) {
        console.log(`  ✅ Summary generated successfully (ID: ${summaryId})\n`);
        results.success.push({
          employee_id: employee.id,
          employee_name: employee.name,
          employee_email: employee.email,
          summary_id: summaryId,
        });
      } else {
        console.log(`  ❌ Failed to generate summary\n`);
        results.failed.push({
          employee_id: employee.id,
          employee_name: employee.name,
          employee_email: employee.email,
          reason: 'Failed to generate summary',
        });
      }
    }
    
    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 GENERATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Successfully generated: ${results.success.length}`);
    console.log(`❌ Failed: ${results.failed.length}`);
    console.log(`⏭️  Skipped (already approved): ${results.skipped.length}`);
    console.log(`📝 Total processed: ${employees.length}`);
    console.log('='.repeat(60) + '\n');
    
    if (results.success.length > 0) {
      console.log('✅ Sample monthly summaries generated successfully!');
      console.log('📱 Staff can now view and sign these summaries in the mobile app.\n');
    }
    
    if (results.failed.length > 0) {
      console.log('⚠️  Some summaries failed to generate:');
      results.failed.forEach(item => {
        console.log(`   - ${item.employee_name} (${item.employee_email}): ${item.reason}`);
      });
      console.log('');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error seeding monthly summaries:', error);
    process.exit(1);
  }
};

// Run the script
if (require.main === module) {
  seedMonthlySummaries();
}

module.exports = { seedMonthlySummaries };

