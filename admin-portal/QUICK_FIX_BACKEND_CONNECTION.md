# Quick Fix: Backend Connection Error (ECONNREFUSED)

## Issue
The dashboard shows `ECONNREFUSED` error because it can't connect to the backend.

## Solution

### Step 1: Verify Backend is Running
The backend should be running on port 4000. Check by running:
```bash
cd attendance-app/flutter_attendance/backend
npm run dev
```

You should see: `Server listening on port 4000`

### Step 2: Create/Update Environment File
Create or update `.env.local` in the `admin-portal` directory:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
```

### Step 3: Restart Next.js Dev Server
After creating/updating `.env.local`, restart your Next.js dev server:

1. Stop the current server (Ctrl+C)
2. Start it again:
```bash
cd attendance-app/admin-portal
npm run dev
```

### Step 4: Verify Connection
Open your browser and check:
- Dashboard should load without errors
- Network tab should show successful API calls to `http://localhost:4000`

## Already Fixed
- ✅ `lib/api-server.ts` now defaults to `http://localhost:4000` instead of `https://api.my-backend.com/v1`

## If Still Not Working
1. Check if backend is actually running: `netstat -ano | findstr :4000`
2. Verify `.env.local` exists and has correct URL
3. Restart both backend and frontend servers
4. Clear browser cache and cookies

