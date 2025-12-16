/**
 * JTC Project Data Import Script
 * 
 * This script imports JTC project data from JSON format into the database.
 * It handles projects, employees, and user account creation.
 * 
 * Usage:
 *   node scripts/import_jtc_data.js [--file path/to/data.json] [--dry-run]
 * 
 * Options:
 *   --file: Path to JSON data file (default: jtc_data.json)
 *   --dry-run: Preview changes without committing to database
 */

const db = require('../config/db');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

// Default password hash for all imported users (password: worker123)
const DEFAULT_PASSWORD_HASH = '$2b$12$8P23VIwZRrwTUZL5shUEE.MbToVquXB0HdmFZctDWYHKDfJXUFCXu';

// Parse command line arguments
const args = process.argv.slice(2);
const fileIndex = args.indexOf('--file');
const dataFile = fileIndex !== -1 && args[fileIndex + 1] 
  ? args[fileIndex + 1] 
  : path.join(__dirname, 'jtc_data.json');
const isDryRun = args.includes('--dry-run');

// Statistics
const stats = {
  projects: { created: 0, updated: 0, skipped: 0 },
  employees: { created: 0, updated: 0, skipped: 0 },
  users: { created: 0, skipped: 0 },
  errors: []
};

/**
 * Generate email from name
 */
function generateEmail(name) {
  if (!name) return null;
  
  // Remove special characters and extra spaces
  let email = name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '.')
    .replace(/\.+/g, '.')
    .trim();
  
  // Remove common prefixes/suffixes
  email = email
    .replace(/^mr\.|^ms\.|^mrs\./g, '')
    .replace(/\(.*?\)/g, '')
    .trim();
  
  return email ? `${email}@jtc.com` : null;
}

/**
 * Normalize role format
 */
function normalizeRole(role) {
  if (!role) return null;
  
  // Standardize role format
  role = role.trim();
  
  // Handle variations
  if (role.includes('Stand-in') || role.includes('Stand in')) {
    role = role.replace(/Stand[- ]?in\s*/i, 'Stand-in ');
  }
  
  return role;
}

/**
 * Import a single project
 */
async function importProject(projectData) {
  try {
    const { name, location, start_date, end_date, description, budget } = projectData;
    
    if (!name) {
      stats.projects.skipped++;
      stats.errors.push(`Project skipped: Missing name`);
      return null;
    }
    
    // Check if project exists
    const existing = await db.query(
      'SELECT id FROM projects WHERE name = $1',
      [name]
    );
    
    if (existing.rows.length > 0) {
      // Update existing project
      if (!isDryRun) {
        await db.query(
          `UPDATE projects 
           SET location = COALESCE($1, location),
               start_date = COALESCE($2, start_date),
               end_date = COALESCE($3, end_date),
               description = COALESCE($4, description),
               budget = COALESCE($5, budget)
           WHERE name = $6`,
          [location || null, start_date || null, end_date || null, description || null, budget || null, name]
        );
      }
      stats.projects.updated++;
      return existing.rows[0].id;
    } else {
      // Create new project
      if (!isDryRun) {
        const result = await db.query(
          `INSERT INTO projects (id, name, location, start_date, end_date, description, budget, created_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW())
           RETURNING id`,
          [name, location || null, start_date || null, end_date || null, description || null, budget || null]
        );
        stats.projects.created++;
        return result.rows[0].id;
      } else {
        stats.projects.created++;
        return 'dry-run-id';
      }
    }
  } catch (error) {
    stats.errors.push(`Error importing project "${projectData.name}": ${error.message}`);
    stats.projects.skipped++;
    return null;
  }
}

/**
 * Import a single employee
 */
async function importEmployee(employeeData, projectId) {
  try {
    const { name, email, phone, role } = employeeData;
    
    if (!name) {
      stats.employees.skipped++;
      stats.errors.push(`Employee skipped: Missing name`);
      return null;
    }
    
    // Generate email if not provided
    const employeeEmail = email || generateEmail(name);
    
    if (!employeeEmail) {
      stats.employees.skipped++;
      stats.errors.push(`Employee skipped: Could not generate email for "${name}"`);
      return null;
    }
    
    // Normalize role
    const normalizedRole = normalizeRole(role);
    
    // Check if employee exists
    const existing = await db.query(
      'SELECT id, project_id FROM employees WHERE email = $1',
      [employeeEmail]
    );
    
    if (existing.rows.length > 0) {
      // Update existing employee
      if (!isDryRun) {
        await db.query(
          `UPDATE employees 
           SET name = $1,
               phone = COALESCE($2, phone),
               role = COALESCE($3, role),
               project_id = COALESCE($4, project_id)
           WHERE email = $5`,
          [name, phone || null, normalizedRole || null, projectId || null, employeeEmail]
        );
      }
      stats.employees.updated++;
      return existing.rows[0].id;
    } else {
      // Create new employee
      if (!isDryRun) {
        const result = await db.query(
          `INSERT INTO employees (id, name, email, phone, role, project_id, created_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW())
           RETURNING id`,
          [name, employeeEmail, phone || null, normalizedRole || null, projectId || null]
        );
        stats.employees.created++;
        return result.rows[0].id;
      } else {
        stats.employees.created++;
        return 'dry-run-id';
      }
    }
  } catch (error) {
    stats.errors.push(`Error importing employee "${employeeData.name}": ${error.message}`);
    stats.employees.skipped++;
    return null;
  }
}

/**
 * Create user account for employee
 */
async function createUserAccount(email) {
  try {
    if (!email) return;
    
    // Check if user exists
    const existing = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );
    
    if (existing.rows.length > 0) {
      stats.users.skipped++;
      return;
    }
    
    // Create new user
    if (!isDryRun) {
      await db.query(
        `INSERT INTO users (id, email, password_hash, created_at)
         VALUES (gen_random_uuid(), $1, $2, NOW())`,
        [email, DEFAULT_PASSWORD_HASH]
      );
    }
    stats.users.created++;
  } catch (error) {
    stats.errors.push(`Error creating user account for "${email}": ${error.message}`);
  }
}

/**
 * Main import function
 */
async function importData(data) {
  console.log('🚀 Starting JTC data import...\n');
  
  if (isDryRun) {
    console.log('⚠️  DRY RUN MODE - No changes will be committed\n');
  }
  
  // Import projects and employees
  for (const projectData of data.projects || []) {
    console.log(`📁 Processing project: ${projectData.name}`);
    
    // Import project
    const projectId = await importProject(projectData);
    
    if (!projectId) {
      console.log(`   ⚠️  Project skipped\n`);
      continue;
    }
    
    // Import employees for this project
    const employees = projectData.employees || [];
    for (const employeeData of employees) {
      const employeeId = await importEmployee(employeeData, projectId);
      
      // Create user account
      const email = employeeData.email || generateEmail(employeeData.name);
      if (email) {
        await createUserAccount(email);
      }
    }
    
    console.log(`   ✅ Project processed (${employees.length} employees)\n`);
  }
  
  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 IMPORT SUMMARY');
  console.log('='.repeat(60));
  console.log(`\n📁 Projects:`);
  console.log(`   Created: ${stats.projects.created}`);
  console.log(`   Updated: ${stats.projects.updated}`);
  console.log(`   Skipped: ${stats.projects.skipped}`);
  
  console.log(`\n👥 Employees:`);
  console.log(`   Created: ${stats.employees.created}`);
  console.log(`   Updated: ${stats.employees.updated}`);
  console.log(`   Skipped: ${stats.employees.skipped}`);
  
  console.log(`\n👤 User Accounts:`);
  console.log(`   Created: ${stats.users.created}`);
  console.log(`   Skipped: ${stats.users.skipped}`);
  
  if (stats.errors.length > 0) {
    console.log(`\n❌ Errors (${stats.errors.length}):`);
    stats.errors.slice(0, 10).forEach((error, index) => {
      console.log(`   ${index + 1}. ${error}`);
    });
    if (stats.errors.length > 10) {
      console.log(`   ... and ${stats.errors.length - 10} more errors`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  
  if (isDryRun) {
    console.log('\n⚠️  This was a DRY RUN - No changes were committed');
    console.log('   Run without --dry-run to commit changes');
  } else {
    console.log('\n✅ Import completed successfully!');
  }
}

// Main execution
async function main() {
  try {
    // Check if data file exists
    if (!fs.existsSync(dataFile)) {
      console.error(`❌ Error: Data file not found: ${dataFile}`);
      console.error(`\nPlease create a JSON file with the following structure:`);
      console.error(`
{
  "projects": [
    {
      "name": "Project Name",
      "location": "Location",
      "start_date": "2024-01-01",
      "end_date": "2027-12-31",
      "description": "Project description",
      "budget": 1000000,
      "employees": [
        {
          "name": "Employee Name",
          "email": "employee@jtc.com",
          "phone": "+65 1234 5678",
          "role": "RTO(C&S)"
        }
      ]
    }
  ]
}
      `);
      process.exit(1);
    }
    
    // Read and parse data file
    const fileContent = fs.readFileSync(dataFile, 'utf8');
    const data = JSON.parse(fileContent);
    
    // Validate data structure
    if (!data.projects || !Array.isArray(data.projects)) {
      throw new Error('Invalid data format: "projects" array is required');
    }
    
    // Run import
    await importData(data);
    
    process.exit(0);
  } catch (error) {
    console.error(`\n❌ Fatal error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  } finally {
    // Close database connection
    if (db && db.end) {
      await db.end();
    }
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { importData, importProject, importEmployee, createUserAccount };

