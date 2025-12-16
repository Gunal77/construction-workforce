# Reports Data Seed Script

This script populates the database with sample data for the Reports page, including:

- **Projects**: Budget, start/end dates, status (ACTIVE, COMPLETED, ON HOLD)
- **Employees**: Email addresses, project assignments
- **Users**: User accounts linked to employees via email
- **Attendance Records**: Check-in/check-out times with hours for the last 90 days

## What It Does

1. **Updates Projects**:
   - Adds budget values ($500K - $10M)
   - Sets start/end dates if missing
   - Sets status based on dates (COMPLETED if past end date, ON HOLD if near deadline, ACTIVE otherwise)

2. **Ensures Employees Have Emails**:
   - Creates email addresses for employees missing them (format: `name@construction.com`)

3. **Assigns Employees to Projects**:
   - Distributes employees evenly across all projects
   - Ensures all employees have valid project assignments

4. **Creates Users**:
   - Creates user accounts for all employees (linked by email)
   - Uses password hash for `worker123`

5. **Creates Attendance Records**:
   - Generates attendance records for the last 90 days
   - 80% attendance rate on weekdays, 20% on weekends
   - Random check-in times (7-9 AM)
   - Random check-out times (4-7 PM, 8-10 hours after check-in)

## How to Run

### Option 1: Using npm script (Recommended)

```bash
cd attendance-app/flutter_attendance/backend
npm run seed:reports
```

### Option 2: Direct Node.js execution

```bash
cd attendance-app/flutter_attendance/backend
node scripts/run_reports_seed.js
```

### Option 3: Direct SQL execution

```bash
# Using psql
psql -h your-host -U your-user -d your-database -f scripts/seed_reports_data.sql

# Or copy-paste the SQL into Supabase SQL Editor
```

## Expected Results

After running the script, you should see:

- Projects with budget values displayed
- Projects with completion percentages (calculated from dates)
- Projects with staff counts (employees assigned)
- Projects with total hours (from attendance records)
- Projects with spent amounts (calculated from completion %)
- Status badges: ACTIVE (blue), COMPLETED (green), ON HOLD (orange)

## Notes

- The script is **idempotent** - it can be run multiple times safely
- Existing data is preserved (uses `ON CONFLICT DO NOTHING` where appropriate)
- Attendance records are created for up to 50 employees
- Each employee gets attendance records for the last 90 days

## Troubleshooting

If you see errors:

1. **"No employees found"**: Run employee seed scripts first
2. **"No projects found"**: Run project seed scripts first
3. **"Column does not exist"**: Ensure all migrations have been run
4. **"Permission denied"**: Check database user permissions

## Related Scripts

- `seed:timesheets` - Creates timesheet data
- `seed:leave` - Creates leave management data
- `seed:all` - Runs all seed scripts
