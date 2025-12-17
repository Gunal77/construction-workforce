# Environment Variables Keys Reference

Quick reference guide for all environment variable keys used in the project.

## 🔧 Backend Environment Variables

**File:** `flutter_attendance/backend/.env`

| Key Name | Type | Description | Example Value |
|----------|------|-------------|---------------|
| `NODE_ENV` | Optional | Environment mode | `development` or `production` |
| `PORT` | Optional | Server port number | `4000` |
| `DATABASE_URL` | **Required** | PostgreSQL connection string | `postgresql://postgres:password@xxx.supabase.co:5432/postgres` |
| `JWT_SECRET` | **Required** | Secret key for JWT token signing | `super-secret-jwt-key-12345-...` |
| `SUPABASE_URL` | **Required** | Supabase project URL | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | **Required** | Supabase service role API key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `SUPABASE_BUCKET` | **Required** | Supabase storage bucket name | `attendance-images` |

## 🌐 Admin Portal Environment Variables

**File:** `admin-portal/.env.local`

| Key Name | Type | Description | Example Value |
|----------|------|-------------|---------------|
| `NEXT_PUBLIC_API_BASE_URL` | **Required** | Backend API base URL | `http://localhost:4000` |
| `NEXT_PUBLIC_SUPABASE_URL` | **Required** | Supabase project URL | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | **Required** | Supabase service role key | `eyJhbGciOiJIUzI1NiIs...` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Optional | Supabase anon key (alternative) | `eyJhbGciOiJIUzI1NiIs...` |

---

## 📝 Quick Copy-Paste Template

### Backend `.env` Template

```env
NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://postgres:[PASSWORD]@[PROJECT-REF].supabase.co:5432/postgres?pgbouncer=true
JWT_SECRET=[GENERATE-A-RANDOM-SECRET]
SUPABASE_URL=https://[PROJECT-REF].supabase.co
SUPABASE_SERVICE_ROLE_KEY=[YOUR-SERVICE-ROLE-KEY]
SUPABASE_BUCKET=attendance-images
```

### Admin Portal `.env.local` Template

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT-REF].supabase.co
SUPABASE_SERVICE_ROLE_KEY=[YOUR-SERVICE-ROLE-KEY]
```

---

## 🔑 How to Generate JWT_SECRET

**Option 1: Using OpenSSL**
```bash
openssl rand -base64 32
```

**Option 2: Using Node.js**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Option 3: Using Python**
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

---

## 📍 Where to Find Supabase Values

1. **DATABASE_URL**: Supabase Dashboard → Settings → Database → Connection string (use Connection pooling)
2. **SUPABASE_URL**: Supabase Dashboard → Settings → API → Project URL
3. **SUPABASE_SERVICE_ROLE_KEY**: Supabase Dashboard → Settings → API → Project API keys → `service_role` key
4. **SUPABASE_BUCKET**: Supabase Dashboard → Storage → Create/use bucket named `attendance-images`

---

## ⚠️ Important Notes

- All keys marked as **Required** must be set for the application to work
- Replace all placeholder values `[YOUR-...]` with actual values
- Never commit `.env` or `.env.local` files to version control
- Use different secrets for development and production environments

