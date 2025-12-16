# JTC Data Import - Quick Start Guide

## Overview
This guide provides quick steps to import JTC project data into the system.

## Prerequisites
- Database connection configured
- Node.js installed
- Access to Supabase SQL Editor (for SQL method)

## Method 1: SQL Script Import (Recommended for Initial Setup)

### Steps:
1. **Open Supabase SQL Editor**
   - Navigate to your Supabase project
   - Open SQL Editor

2. **Run the Import Script**
   - Open `JTC_PROJECTS_IMPORT.sql`
   - Copy entire script
   - Paste into SQL Editor
   - Click "Run"

3. **Verify Import**
   - Check the summary output
   - Verify project and employee counts

### Advantages:
- ✅ Fastest method
- ✅ Handles all data at once
- ✅ Includes user account creation
- ✅ Provides summary statistics

## Method 2: Node.js Script Import (For Updates/Incremental)

### Steps:
1. **Prepare Data File**
   - Use `jtc_data_template.json` as reference
   - Convert Excel data to JSON format
   - Save as `jtc_data.json` in `scripts/` folder

2. **Test with Dry Run**
   ```bash
   cd attendance-app/flutter_attendance/backend
   npm run import:jtc:dry-run
   ```
   - Review the preview output
   - Check for errors

3. **Run Actual Import**
   ```bash
   npm run import:jtc
   ```

### Advantages:
- ✅ Can update existing records
- ✅ Handles incremental updates
- ✅ Better error handling
- ✅ Can be automated

## Data Format

### JSON Structure:
```json
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
```

### Role Formats:
- `RTO(C&S)` - Resident Technical Officer - Civil & Structural
- `RTO(M&E)` - Resident Technical Officer - Mechanical & Electrical
- `RTO(Archi)` - Resident Technical Officer - Architectural
- `RE(C&S)` - Resident Engineer - Civil & Structural
- `RE(M&E)` - Resident Engineer - Mechanical & Electrical
- `SRE(C&S)` - Senior Resident Engineer - Civil & Structural
- `RA` - Resident Architect
- `Stand-in RTO(C&S)` - Temporary replacement

## Default Credentials

All imported users get:
- **Password:** `worker123`
- **Email:** Generated from name if not provided (format: `firstname.lastname@jtc.com`)

**⚠️ Important:** Users should change password on first login!

## Verification Queries

After import, run these in Supabase SQL Editor:

```sql
-- Count projects
SELECT COUNT(*) as total_projects 
FROM projects 
WHERE name LIKE 'JTC%' OR name LIKE '%Demo%' OR name LIKE 'R&R%';

-- Count employees
SELECT COUNT(*) as total_employees 
FROM employees 
WHERE email LIKE '%@jtc.com';

-- Count user accounts
SELECT COUNT(*) as total_users 
FROM users 
WHERE email LIKE '%@jtc.com';

-- Projects with employee count
SELECT 
  p.name,
  COUNT(e.id) as staff_count
FROM projects p
LEFT JOIN employees e ON e.project_id = p.id
WHERE p.name LIKE 'JTC%' OR p.name LIKE '%Demo%' OR name LIKE 'R&R%'
GROUP BY p.name
ORDER BY p.name;

-- Employees by role
SELECT 
  role,
  COUNT(*) as count
FROM employees
WHERE email LIKE '%@jtc.com'
GROUP BY role
ORDER BY count DESC;
```

## Troubleshooting

### Issue: Duplicate email errors
**Solution:** The script handles duplicates automatically. Existing records are updated.

### Issue: Missing project references
**Solution:** Ensure project names match exactly. Use project IDs for reliability.

### Issue: Date format errors
**Solution:** Use YYYY-MM-DD format for all dates.

### Issue: Role format inconsistencies
**Solution:** Use standardized format: `TITLE(SPECIALIZATION)` or `Stand-in TITLE(SPECIALIZATION)`

## Next Steps

After successful import:
1. ✅ Test login with sample JTC employee
2. ✅ Verify project assignments
3. ✅ Check role-based access
4. ✅ Update project dates where needed
5. ✅ Send password reset emails (if configured)

## Support

For detailed workflow, see: `JTC_IMPORT_WORKFLOW.md`

