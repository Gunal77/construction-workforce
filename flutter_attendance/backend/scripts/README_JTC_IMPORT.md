# JTC Project Data Import - Complete Guide

## 📋 Overview

This directory contains tools and documentation for importing JTC project data from Excel spreadsheets into the Construction Workforce Management System.

## 📁 Files

### Documentation
- **`JTC_IMPORT_WORKFLOW.md`** - Complete workflow guide with detailed steps
- **`JTC_IMPORT_QUICK_START.md`** - Quick reference for common tasks
- **`README_JTC_IMPORT.md`** - This file (overview and index)

### Scripts
- **`import_jtc_data.js`** - Node.js script for importing JSON data
- **`jtc_data_template.json`** - Template for JSON data format

### SQL Scripts
- **`../JTC_PROJECTS_IMPORT.sql`** - Complete SQL import script (in parent directory)

## 🚀 Quick Start

### Option 1: SQL Import (Fastest)
```sql
-- Run in Supabase SQL Editor
-- Copy and paste contents of JTC_PROJECTS_IMPORT.sql
```

### Option 2: Node.js Import (Flexible)
```bash
# Dry run (preview changes)
npm run import:jtc:dry-run

# Actual import
npm run import:jtc
```

## 📊 Data Structure

### Projects
- Name, Location, Dates, Description, Budget
- Contract information (awarded date, period)

### Employees
- Name, Email, Phone, Role
- Project assignment
- Role types: RTO, RE, SRE, RA, Stand-in

### User Accounts
- Auto-generated from employee emails
- Default password: `worker123`

## 🔄 Workflow

1. **Prepare Data** → Extract from Excel, validate
2. **Choose Method** → SQL (initial) or Node.js (updates)
3. **Run Import** → Execute script
4. **Verify** → Check counts and assignments
5. **Test** → Login, verify access

## 📖 Documentation

- **Quick Start:** See `JTC_IMPORT_QUICK_START.md`
- **Full Workflow:** See `JTC_IMPORT_WORKFLOW.md`
- **Data Template:** See `jtc_data_template.json`

## ⚙️ Configuration

### Default Settings
- Password hash: `worker123` (bcrypt)
- Email domain: `@jtc.com`
- Date format: `YYYY-MM-DD`

### Customization
Edit `import_jtc_data.js` to modify:
- Password generation
- Email format
- Role normalization
- Error handling

## ✅ Verification

After import, verify:
- [ ] Project count matches expected
- [ ] Employee count matches expected
- [ ] User accounts created
- [ ] Project assignments correct
- [ ] Roles properly formatted
- [ ] Login works with default password

## 🐛 Troubleshooting

See `JTC_IMPORT_WORKFLOW.md` → Troubleshooting section

Common issues:
- Duplicate emails → Handled automatically
- Missing projects → Check name matching
- Date errors → Use YYYY-MM-DD format
- Role format → Standardize to `TITLE(SPECIALIZATION)`

## 📞 Support

For issues:
1. Check documentation files
2. Review script comments
3. Check database logs
4. Contact system administrator

## 📝 Notes

- **Stand-in Assignments:** Marked with "Stand-in" in role field
- **OT Details:** Tracked in project description or separate field
- **Updates:** Node.js script updates existing records
- **Backups:** Always backup before large imports

