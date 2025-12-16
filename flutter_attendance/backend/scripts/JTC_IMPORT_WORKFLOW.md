# JTC Project Data Import Workflow

## Overview
This workflow guides you through importing JTC project data from Excel spreadsheets into the Construction Workforce Management System.

## Data Structure

### Contract Information
- **Contract Awarded:** 31st March 2023
- **Contract Period:** 2023 to 2027
- **Part:** B&C (Building & Infrastructure)
- **Contract No:** C220110T02 - 2-YEAR TERM CONTRACT FOR PROVISION OF RESIDENT SITE SUPERVISORS FOR JTC'S BUILDING AND INFRASTRUCTURE PROJECTS (YEAR 2023 to 2025) (PART B & PART C)

### Project Data Fields
- **S:No:** Sequential number
- **Description:** Project name/description
- **Proposed Candidates:** List of assigned personnel with roles
- **Remark:** Additional notes
- **OT Details:** Overtime information (when applicable)

### Role Types
- **SRE(C&S):** Senior Resident Engineer - Civil & Structural
- **RE(C&S):** Resident Engineer - Civil & Structural
- **RE(M&E):** Resident Engineer - Mechanical & Electrical
- **RE(C&S/M&E):** Resident Engineer - Both C&S and M&E
- **RTO(C&S):** Resident Technical Officer - Civil & Structural
- **RTO(M&E):** Resident Technical Officer - Mechanical & Electrical
- **RTO(Archi):** Resident Technical Officer - Architectural
- **RA:** Resident Architect
- **Stand-in RTO/RE:** Temporary replacement (highlighted in red in source data)

## Workflow Steps

### Step 1: Data Preparation
1. **Extract Data from Excel**
   - Open the JTC project spreadsheet
   - Identify all projects and their assigned personnel
   - Note any special designations (Stand-in, OT Details, etc.)
   - Verify project names and locations

2. **Data Validation**
   - Check for duplicate project names
   - Verify email format consistency
   - Ensure role codes are standardized
   - Identify missing information (dates, locations, etc.)

### Step 2: Database Preparation
1. **Run Migrations** (if not already done)
   ```bash
   cd attendance-app/flutter_attendance/backend
   npm run migrate
   ```

2. **Verify Database Schema**
   - Projects table has: id, name, location, start_date, end_date, description, budget
   - Employees table has: id, name, email, phone, role, project_id
   - Users table has: id, email, password_hash

### Step 3: Import Process

#### Option A: SQL Script Import (Recommended for Initial Setup)
1. **Review the Import Script**
   - Open `JTC_PROJECTS_IMPORT_COMPLETE.sql`
   - Verify all projects and personnel are included
   - Check date formats and locations

2. **Execute in Supabase SQL Editor**
   - Copy the entire SQL script
   - Paste into Supabase SQL Editor
   - Execute the script
   - Review the summary output

3. **Verify Import**
   - Check project count matches expected
   - Verify all employees are assigned to projects
   - Confirm user accounts are created

#### Option B: Node.js Script Import (For Updates/Incremental)
1. **Prepare JSON Data File**
   - Convert Excel data to JSON format
   - Use `jtc_data_template.json` as reference
   - Include all required fields

2. **Run Import Script**
   ```bash
   cd attendance-app/flutter_attendance/backend
   node scripts/import_jtc_data.js
   ```

3. **Review Import Log**
   - Check for errors or warnings
   - Verify successful imports
   - Review skipped duplicates

### Step 4: Post-Import Tasks

1. **Verify Data Integrity**
   ```sql
   -- Check projects
   SELECT COUNT(*) FROM projects WHERE name LIKE 'JTC%' OR name LIKE '%Demo%';
   
   -- Check employees
   SELECT COUNT(*) FROM employees WHERE email LIKE '%@jtc.com';
   
   -- Check user accounts
   SELECT COUNT(*) FROM users WHERE email LIKE '%@jtc.com';
   
   -- Check assignments
   SELECT p.name, COUNT(e.id) as staff_count
   FROM projects p
   LEFT JOIN employees e ON e.project_id = p.id
   WHERE p.name LIKE 'JTC%' OR p.name LIKE '%Demo%'
   GROUP BY p.name
   ORDER BY p.name;
   ```

2. **Handle Stand-in Assignments**
   - Stand-in personnel are marked with "Stand-in" in their role
   - These are temporary assignments
   - Consider creating a separate tracking mechanism if needed

3. **Update Project Dates**
   - Review and update start_date and end_date where available
   - Set contract period dates for projects without specific dates

4. **Assign Default Passwords**
   - All imported users get default password: `worker123`
   - Users should change passwords on first login
   - Consider sending password reset emails

### Step 5: Testing

1. **Login Testing**
   - Test login with sample JTC employee email
   - Verify password: `worker123`
   - Check role assignment

2. **Project Assignment Testing**
   - Verify employees can see their assigned projects
   - Check project filtering works correctly
   - Test attendance tracking per project

3. **Role-Based Access Testing**
   - Verify RTO, RE, SRE roles are correctly assigned
   - Test role-based permissions (if implemented)

## Data Update Workflow

### Adding New Projects
1. Add project to `projects` table
2. Create employee records with project_id
3. Create user accounts for new employees
4. Update project assignments

### Updating Assignments
1. Update employee `project_id` in `employees` table
2. If role changed, update `role` field
3. If stand-in assignment, update role to include "Stand-in"

### Removing Assignments
1. Set employee `project_id` to NULL
2. Consider archiving instead of deleting
3. Update user account status if needed

## Troubleshooting

### Common Issues

1. **Duplicate Email Errors**
   - Check if employee already exists
   - Use `ON CONFLICT (email) DO UPDATE` to update existing records
   - Or skip duplicates if data is identical

2. **Missing Project References**
   - Verify project names match exactly
   - Check for typos in project names
   - Use project IDs instead of names for reliability

3. **Date Format Issues**
   - Ensure dates are in YYYY-MM-DD format
   - Check for NULL dates where required
   - Validate date ranges (start_date < end_date)

4. **Role Format Inconsistencies**
   - Standardize role format: `TITLE(SPECIALIZATION)`
   - Handle variations like "Stand-in RTO(C&S)" vs "RTO(C&S) Stand-in"
   - Create role mapping if needed

## Best Practices

1. **Backup Before Import**
   - Always backup database before large imports
   - Keep original Excel files as reference

2. **Incremental Updates**
   - Use Node.js script for regular updates
   - Track last import date
   - Only import new/changed records

3. **Data Validation**
   - Validate email formats
   - Check for required fields
   - Verify project names are unique

4. **Documentation**
   - Document any custom mappings
   - Keep changelog of imports
   - Note any data transformations

5. **Testing**
   - Test with small dataset first
   - Verify in staging environment
   - Get approval before production import

## Maintenance

### Regular Tasks
- Weekly: Review new project assignments
- Monthly: Update project end dates
- Quarterly: Audit employee-project assignments
- Annually: Review and archive completed projects

### Data Cleanup
- Archive completed projects (set status)
- Remove inactive employees (soft delete)
- Update expired stand-in assignments
- Clean up duplicate records

## Support

For issues or questions:
1. Check this workflow document
2. Review SQL script comments
3. Check database logs
4. Contact system administrator

