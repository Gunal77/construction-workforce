# Leave Management Data Seed

This script populates the leave management system with sample data for testing and demonstration.

## What It Does

1. **Initializes Leave Balances**: Creates leave balances for all employees for the current year
   - Annual Leave: 12 days per employee
   - Sick Leave: Unlimited
   - Unpaid Leave: Unlimited

2. **Creates Sample Leave Requests**: Generates various leave requests with different statuses:
   - **Pending Requests** (6 requests): Future-dated requests awaiting approval
   - **Approved Requests** (9 requests): Past and recent approved requests (auto-deducts from balance)
   - **Rejected Requests** (4 requests): Rejected requests with reasons

3. **Updates Balances**: Automatically calculates and updates used days based on approved requests

## Usage

### Option 1: Run SQL Directly in Supabase

1. Open Supabase SQL Editor
2. Copy the entire content of `seed_leave_management_data.sql`
3. Paste and run it
4. You should see a summary message at the end

### Option 2: Run via Node.js Script

```bash
cd attendance-app/flutter_attendance/backend
npm run seed:leave
```

## Expected Results

After running the seed:

- **Leave Balances**: All employees will have leave balances initialized
- **Pending Requests**: ~6 pending requests (visible in yellow)
- **Approved Requests**: ~9 approved requests (visible in green)
- **Rejected Requests**: ~4 rejected requests (visible in red)
- **Total Requests**: ~19 total leave requests

## Sample Data Details

### Employees 1-3:
- 2 pending requests each (Annual Leave + Sick Leave)

### Employees 4-6:
- 3 approved requests each (2 Annual Leave + 1 Sick Leave)
- These will show reduced annual leave balances

### Employees 7-8:
- 2 rejected requests each (Annual Leave + Unpaid Leave)

### Employees 9-10:
- Mix of 1 approved, 1 pending, and 1 rejected request each

## Verification

After seeding, check the Leave Management page:
- Statistics cards should show non-zero counts
- Leave requests table should display various requests
- Employee leave balances should show used/remaining days

## Troubleshooting

### No data appears:
1. Make sure migration `015_create_leave_management_tables.sql` has been run
2. Verify you have employees in the database
3. Check that leave types exist (Annual, Sick, Unpaid)

### Errors about missing employees:
- The script uses the first 10 employees from your database
- If you have fewer than 10 employees, it will create requests for all available employees

### Balance not updating:
- Approved requests should auto-deduct via trigger
- If balances seem incorrect, run the balance update section manually

## Notes

- The script is **idempotent** - safe to run multiple times
- It uses `ON CONFLICT DO NOTHING` to avoid duplicates
- Dates are relative to current date (future for pending, past for approved)
- Working days are automatically calculated (excludes weekends)

