# Environment Variables Setup Guide

This guide explains how to set up environment variables for the backend and admin portal.

## 📋 Table of Contents

1. [Backend Environment Variables](#backend-environment-variables)
2. [Admin Portal Environment Variables](#admin-portal-environment-variables)
3. [Where to Get Values](#where-to-get-values)

---

## 🔧 Backend Environment Variables

**Location:** `flutter_attendance/backend/.env`

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string (Supabase) | `postgresql://postgres:password@xxx.supabase.co:5432/postgres` |
| `JWT_SECRET` | Secret key for JWT token signing | `your-super-secret-jwt-key` |
| `SUPABASE_URL` | Your Supabase project URL | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (bypasses RLS) | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `SUPABASE_BUCKET` | Supabase storage bucket name for file uploads | `attendance-images` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode (`development` or `production`) | `development` |
| `PORT` | Server port number | `4000` |
| `DB_PROVIDER` | Database provider: `supabase` or `mongodb` | `supabase` |
| `MONGODB_URI` | MongoDB connection string (required when `DB_PROVIDER=mongodb`) | - |

### Example `.env` File

#### Option 1: Using Supabase (Default)

```env
NODE_ENV=development
PORT=4000

# Database Provider (optional - defaults to 'supabase')
DB_PROVIDER=supabase

DATABASE_URL=postgresql://postgres:yourpassword@abcdefghijklmnop.supabase.co:5432/postgres?pgbouncer=true
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
SUPABASE_URL=https://abcdefghijklmnop.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNjQ1NzI4MDAwLCJleHAiOjE5NjEzMDQwMDB9.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SUPABASE_BUCKET=attendance-images
```

#### Option 2: Using MongoDB

```env
NODE_ENV=development
PORT=4000

# Database Provider - Set to 'mongodb' to use MongoDB
DB_PROVIDER=mongodb

# MongoDB Connection String (required when DB_PROVIDER=mongodb)
# Format: mongodb+srv://username:password@cluster.mongodb.net/database_name
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/construction_workforce?retryWrites=true&w=majority

# Still need Supabase for file storage (attendance images, leave documents)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
SUPABASE_URL=https://abcdefghijklmnop.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNjQ1NzI4MDAwLCJleHAiOjE5NjEzMDQwMDB9.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SUPABASE_BUCKET=attendance-images

# Note: DATABASE_URL is still required but only used for Supabase mode
# When using MongoDB, you can keep it for backward compatibility or remove it
DATABASE_URL=postgresql://postgres:yourpassword@abcdefghijklmnop.supabase.co:5432/postgres?pgbouncer=true
```

---

## 🌐 Admin Portal Environment Variables

**Location:** `admin-portal/.env.local`

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_BASE_URL` | Backend API base URL | `http://localhost:4000` |

### Example `.env.local` File

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
```

**Note:** For production, change this to your deployed backend URL (e.g., `https://api.yourdomain.com`).

---

## 🔍 Where to Get Values

### 1. Supabase Database URL (`DATABASE_URL`)

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to **Settings** → **Database**
4. Scroll down to **Connection string**
5. Select **Connection pooling** mode
6. Copy the connection string
7. Replace `[YOUR-PASSWORD]` with your database password

**Example:**
```
postgresql://postgres.abcdefghijklmnop:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

### 2. Supabase URL (`SUPABASE_URL`)

1. Go to your Supabase Dashboard
2. Select your project
3. Navigate to **Settings** → **API**
4. Copy the **Project URL**

**Example:**
```
https://abcdefghijklmnop.supabase.co
```

### 3. Supabase Service Role Key (`SUPABASE_SERVICE_ROLE_KEY`)

1. Go to your Supabase Dashboard
2. Select your project
3. Navigate to **Settings** → **API**
4. Scroll down to **Project API keys**
5. Copy the **`service_role`** key (⚠️ Keep this secret!)

**Warning:** The service role key bypasses Row Level Security (RLS). Never expose this in client-side code!

### 4. Supabase Storage Bucket (`SUPABASE_BUCKET`)

1. Go to your Supabase Dashboard
2. Select your project
3. Navigate to **Storage**
4. Create a new bucket (if it doesn't exist) named `attendance-images`
5. Set the bucket to **Public** if you want public access, or **Private** for authenticated access only

**Default bucket name:** `attendance-images`

### 5. JWT Secret (`JWT_SECRET`)

Generate a strong random secret key:

**Using OpenSSL:**
```bash
openssl rand -base64 32
```

**Using Node.js:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Using Python:**
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

**Important:** Use a different secret for production!

---

## 🚀 Quick Setup Steps

### Backend Setup

1. Navigate to backend directory:
   ```bash
   cd flutter_attendance/backend
   ```

2. Copy the example file:
   ```bash
   cp .env.example .env
   ```

3. Edit `.env` and fill in your values:
   ```bash
   nano .env  # or use your preferred editor
   ```

4. Verify all required variables are set:
   ```bash
   node -e "require('./config/env')"
   ```

### Admin Portal Setup

1. Navigate to admin portal directory:
   ```bash
   cd admin-portal
   ```

2. Copy the example file:
   ```bash
   cp .env.example .env.local
   ```

3. Edit `.env.local` and set your backend URL:
   ```bash
   nano .env.local  # or use your preferred editor
   ```

4. Restart the Next.js dev server if it's running:
   ```bash
   npm run dev
   ```

---

## ✅ Verification

### Backend Verification

1. Start the backend server:
   ```bash
   cd flutter_attendance/backend
   npm run dev
   ```

2. Check if server starts without errors
3. Test health endpoint:
   ```bash
   curl http://localhost:4000/health
   ```
   Should return: `{"status":"ok"}`

### Admin Portal Verification

1. Start the admin portal:
   ```bash
   cd admin-portal
   npm run dev
   ```

2. Open browser to `http://localhost:3000`
3. Check browser console for connection errors
4. Try logging in to verify backend connection

---

## 🔒 Security Best Practices

1. **Never commit `.env` or `.env.local` files to git** (they're already in `.gitignore`)
2. **Use different secrets for development and production**
3. **Rotate JWT secrets periodically**
4. **Keep Supabase service role key secure** - never expose in client code
5. **Use environment-specific values** for production deployments

---

## 🆘 Troubleshooting

### Backend won't start

- Check that all required variables are set in `.env`
- Verify `DATABASE_URL` is correct and database is accessible
- Check that port 4000 is not already in use
- Verify Supabase project is active (not paused)

### Admin portal can't connect to backend

- Verify backend is running: `curl http://localhost:4000/health`
- Check `NEXT_PUBLIC_API_BASE_URL` in `.env.local` matches backend URL
- Restart Next.js dev server after changing `.env.local`
- Check browser console for CORS errors

### Database connection errors

- Verify `DATABASE_URL` format is correct
- Check that database password is correct
- Ensure Supabase project is not paused
- Try using connection pooling URL instead of direct connection

---

## 📝 Notes

- The `.env` file is automatically loaded by the backend using `dotenv`
- The `.env.local` file is automatically loaded by Next.js
- Environment variables prefixed with `NEXT_PUBLIC_` are exposed to the browser
- Changes to `.env` files require restarting the respective servers

