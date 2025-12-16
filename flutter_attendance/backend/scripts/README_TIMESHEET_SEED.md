# Timesheet Seed Data

This script populates the `timesheets` table with sample data for testing and development.

## Prerequisites

1. The `timesheets` table must exist (run migration `016_create_timesheets_table.sql` first)
2. You must have employees in the `employees` table
3. You must have projects in the `projects` table

## Usage

### Option 1: Run SQL directly in Supabase

1. Open Supabase SQL Editor
2. Copy and paste the contents of `seed_timesheets.sql`
3. Execute the script

### Option 2: Use Node.js script

```bash
cd attendance-app/flutter_attendance/backend
npm run seed:timesheets
```

## What the Script Does

- Creates timesheet entries for the last 30 days
- For up to 10 employees
- Randomly assigns:
  - Work days (70% chance on weekdays, 30% on weekends)
  - Check-in times (7 AM - 9 AM)
  - Check-out times (4 PM - 7 PM, resulting in 8-10 hour days)
  - Task types (Construction, Maintenance, Installation)
  - Status (Present, Half-Day)
  - Approval status (Draft, Submitted, Approved, Rejected)
- Automatically calculates `total_hours` and `overtime_hours` via database triggers
- Sets OT approval status for entries with overtime

## Expected Results

After running the seed:
- Multiple timesheet entries across different dates
- Some entries with overtime (when total_hours > 8)
- Various approval statuses for testing workflows
- Mix of different task types and projects

## Troubleshooting

**Error: "No employees found"**
- Run employee seed scripts first
- Ensure you have at least one employee in the database

**Error: "No projects found"**
- Run project seed scripts first
- Ensure you have at least one project in the database

**Error: "relation timesheets does not exist"**
- Run the migration `016_create_timesheets_table.sql` first

**No data showing in admin portal**
- Check that the backend server is running
- Verify the API endpoint `/api/timesheets` is accessible
- Try clicking "All" button to see all timesheets regardless of date

