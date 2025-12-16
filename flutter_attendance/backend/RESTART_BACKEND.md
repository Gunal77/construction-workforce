# How to Restart Backend Server

## Option 1: If running in terminal
1. Go to the terminal where backend is running
2. Press `Ctrl + C` to stop it
3. Run: `npm start`

## Option 2: If running in background
1. Open Task Manager (Ctrl + Shift + Esc)
2. Find "Node.js: Server-side JavaScript"
3. Right-click → End Task
4. Open new terminal in backend folder
5. Run: `npm start`

## Option 3: PowerShell Command
```powershell
# Stop all node processes (BE CAREFUL - this stops ALL node processes)
Get-Process node | Stop-Process -Force

# Then start backend
cd c:/projects/Construction-Workforce/attendance-app/flutter_attendance/backend
npm start
```

## Verify it's working
After restart, you should see:
```
Server listening on port 3000
```

Then check the logs when you try to access /clients - you should see:
```
[Client Routes] GET /api/admin/clients - Request received
[Client Routes] Admin user: { id: '...', email: '...', role: 'admin' }
```

If you see these logs, the routes are working!

