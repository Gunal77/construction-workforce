# Fix: Backend Connection Error (ECONNREFUSED)

## Problem
The admin portal is trying to connect to the backend API but getting `ECONNREFUSED` error. This means either:
1. The backend server is not running
2. The API URL is not configured correctly

## Solution

### Step 1: Start the Backend Server

1. Open a terminal and navigate to the backend directory:
   ```bash
   cd attendance-app/flutter_attendance/backend
   ```

2. Make sure you have a `.env` file with required variables:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_BUCKET`

3. Install dependencies (if not already done):
   ```bash
   npm install
   ```

4. Start the backend server:
   ```bash
   npm run dev
   # or
   npm start
   ```

   You should see: `Server listening on port 4000`

### Step 2: Configure Admin Portal Environment

1. Create a `.env.local` file in `attendance-app/admin-portal/`:
   ```bash
   cd attendance-app/admin-portal
   ```

2. Create `.env.local` with:
   ```
   NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
   ```

3. Restart the Next.js development server:
   ```bash
   npm run dev
   ```

### Step 3: Verify Connection

1. Check that backend is running:
   - Visit: http://localhost:4000/health
   - Should return: `{"status":"ok"}`

2. Check that admin portal can connect:
   - The dashboard should load without connection errors
   - Check browser console for any remaining errors

## Troubleshooting

### Backend won't start
- Check that all environment variables are set in `.env`
- Check that the database is accessible
- Check that port 4000 is not already in use

### Still getting ECONNREFUSED
- Verify backend is running: `curl http://localhost:4000/health`
- Check firewall settings
- Verify `.env.local` has correct URL
- Restart Next.js dev server after changing `.env.local`

### CORS Errors
- Backend should handle CORS for localhost:3000 (Next.js default)
- Check backend CORS configuration if needed

## Production Setup

For production, set:
```
NEXT_PUBLIC_API_BASE_URL=https://your-backend-domain.com
```

Make sure to:
- Use HTTPS in production
- Configure CORS on backend for production domain
- Set up proper authentication

