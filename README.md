# Construction Workforce Attendance Management System

A comprehensive attendance management system for construction projects with support for workers, supervisors, and administrators. The system includes mobile apps, web portal, backend API, and automated testing.

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Component Setup](#component-setup)
- [Configuration](#configuration)
- [Running the System](#running-the-system)
- [Testing](#testing)
- [API Documentation](#api-documentation)
- [Troubleshooting](#troubleshooting)

## 🎯 Overview

This system provides a complete solution for managing construction workforce attendance with:

- **Worker Mobile App**: Check in/out with GPS location and photo capture
- **Supervisor Mobile App**: Manage workers, assign tasks, view attendance
- **Admin Portal**: Web-based dashboard for comprehensive management
- **Backend API**: RESTful API with PostgreSQL/Supabase database
- **Automated Testing**: Selenium test suite for admin portal

### Key Features

- ✅ Real-time attendance tracking with GPS
- ✅ Photo capture for check-in/out verification
- ✅ Project and worker management
- ✅ Task assignment and tracking
- ✅ Attendance reports and analytics
- ✅ Multi-role support (Admin, Supervisor, Worker)
- ✅ Offline support for mobile apps
- ✅ Automated test coverage

## 🏗️ Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Mobile App    │     │ Supervisor App   │     │   Admin Portal  │
│    (Flutter)    │     │    (Flutter)     │     │   (Next.js)     │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                        │
         └───────────────────────┼────────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   Backend API (Node.js) │
                    │   Express + PostgreSQL │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   Database (Supabase)   │
                    │      PostgreSQL          │
                    └─────────────────────────┘
```

## 💻 Tech Stack

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL (via Supabase)
- **Authentication**: JWT
- **File Storage**: Supabase Storage

### Admin Portal
- **Framework**: Next.js 14
- **Language**: TypeScript
- **Styling**: TailwindCSS
- **Charts**: Recharts
- **Icons**: Lucide React

### Mobile Apps
- **Framework**: Flutter
- **State Management**: Riverpod (Supervisor App)
- **Local Storage**: SQLite, SharedPreferences
- **Networking**: HTTP, Dio
- **Location**: Geolocator
- **Image**: Image Picker

### Testing
- **Language**: Java 11
- **Framework**: Selenium WebDriver
- **Test Runner**: TestNG
- **Reporting**: Extent Reports
- **Build**: Maven

## 📁 Project Structure

```
attendance-flutter/
├── admin-portal/              # Next.js admin web portal
│   ├── app/                   # Next.js app router pages
│   ├── components/            # React components
│   └── lib/                   # Utilities and API clients
│
├── flutter_attendance/
│   ├── backend/               # Node.js backend API
│   │   ├── config/           # Configuration files
│   │   ├── controllers/      # Request handlers
│   │   ├── migrations/        # Database migrations
│   │   ├── routes/            # API routes
│   │   └── scripts/          # Utility scripts
│   │
│   └── mobile_app/           # Flutter worker mobile app
│       └── lib/              # Dart source code
│
├── supervisor_app/            # Flutter supervisor mobile app
│   └── lib/                  # Dart source code
│
└── selenium-tests/            # Selenium test automation
    ├── src/
    │   ├── main/java/        # Page objects and utilities
    │   └── test/java/        # Test classes
    └── testng.xml             # TestNG configuration
```

## 🔧 Prerequisites

### Required Software

- **Node.js** 18+ and npm
- **Flutter** 3.9.2+
- **Java** 11+ (for Selenium tests)
- **Maven** 3.6+ (for Selenium tests)
- **PostgreSQL** or Supabase account
- **Git**

### Development Tools

- VS Code / Android Studio / IntelliJ IDEA
- Chrome/Firefox browser (for Selenium tests)
- Android SDK / Xcode (for mobile development)

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd attendance-flutter
```

### 2. Backend Setup

```bash
cd flutter_attendance/backend
npm install

# Create .env file
cp .env.example .env
# Edit .env with your database credentials

# Run migrations
node scripts/run_migrations.js

# Start backend server
npm run dev
```

Backend runs on `http://localhost:3001`

### 3. Admin Portal Setup

```bash
cd admin-portal
npm install

# Create .env.local file
echo "NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/v1" > .env.local

# Start development server
npm run dev
```

Admin portal runs on `http://localhost:3000`

### 4. Mobile Apps Setup

**Worker App:**
```bash
cd flutter_attendance/mobile_app
flutter pub get
flutter run
```

**Supervisor App:**
```bash
cd supervisor_app
flutter pub get
flutter run
```

## 📦 Component Setup

### Backend API

#### Environment Variables

Create `.env` in `flutter_attendance/backend/`:

```env
PORT=3001
NODE_ENV=development

# Database (Supabase)
SUPABASE_URL=your-supabase-url
SUPABASE_KEY=your-supabase-key
SUPABASE_SERVICE_KEY=your-service-key

# JWT
JWT_SECRET=your-jwt-secret-key
JWT_EXPIRES_IN=7d

# CORS
CORS_ORIGIN=http://localhost:3000
```

#### Database Migrations

```bash
cd flutter_attendance/backend
node scripts/run_migrations.js
```

#### Seed Data (Optional)

```bash
node scripts/seed_all_data.js
```

#### Start Server

```bash
# Development
npm run dev

# Production
npm start
```

### Admin Portal

#### Environment Variables

Create `.env.local` in `admin-portal/`:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/v1
```

#### Start Development Server

```bash
cd admin-portal
npm run dev
```

Access at `http://localhost:3000`

#### Build for Production

```bash
npm run build
npm start
```

### Mobile Apps

#### Worker App Configuration

Update API base URL in `flutter_attendance/mobile_app/lib/services/api_service.dart`:

```dart
static const String baseUrl = 'http://your-backend-url:3001/v1';
```

#### Supervisor App Configuration

Update API base URL in `supervisor_app/lib/core/constants/api_constants.dart`:

```dart
static const String baseUrl = 'http://your-backend-url:3001/v1';
```

#### Run on Device/Emulator

```bash
# List available devices
flutter devices

# Run on specific device
flutter run -d <device-id>

# Build APK (Android)
flutter build apk

# Build iOS
flutter build ios
```

### Selenium Test Suite

#### Configuration

Edit `selenium-tests/src/main/resources/config/config.properties`:

```properties
base.url=http://localhost:3000
browser=chrome
headless=false
admin.email=admin@example.com
admin.password=your-password
```

#### Run Tests

```bash
cd selenium-tests

# Install dependencies
mvn clean install

# Run all tests
mvn test

# Run specific test class
mvn test -Dtest=LoginTests

# Use convenience script
./run-tests.sh all
```

**Note**: Admin portal must be running before executing tests.

## ⚙️ Configuration

### Database Schema

The system uses the following main tables:

- `employees` - Worker information
- `supervisors` - Supervisor information
- `projects` - Project details
- `attendance` - Attendance records
- `tasks` - Task assignments
- `notifications` - System notifications
- `admins` - Admin users

See `flutter_attendance/backend/migrations/` for complete schema.

### API Endpoints

#### Authentication
- `POST /auth/login` - User login
- `POST /admin/auth/login` - Admin login
- `POST /supervisor/auth/login` - Supervisor login

#### Workers/Employees
- `GET /admin/employees` - Get all workers
- `POST /admin/employees` - Create worker
- `PUT /admin/employees/:id` - Update worker
- `DELETE /admin/employees/:id` - Delete worker

#### Projects
- `GET /admin/projects` - Get all projects
- `POST /admin/projects` - Create project
- `PUT /admin/projects/:id` - Update project
- `DELETE /admin/projects/:id` - Delete project

#### Attendance
- `GET /attendance/admin/all` - Get all attendance records
- `POST /attendance` - Create attendance record
- `GET /attendance/user/:id` - Get user attendance

See backend route files for complete API documentation.

## 🏃 Running the System

### Development Mode

1. **Start Backend**:
   ```bash
   cd flutter_attendance/backend
   npm run dev
   ```

2. **Start Admin Portal** (in new terminal):
   ```bash
   cd admin-portal
   npm run dev
   ```

3. **Run Mobile Apps** (in new terminals):
   ```bash
   # Worker App
   cd flutter_attendance/mobile_app
   flutter run

   # Supervisor App
   cd supervisor_app
   flutter run
   ```

### Production Deployment

#### Backend
```bash
cd flutter_attendance/backend
npm install --production
NODE_ENV=production npm start
```

#### Admin Portal
```bash
cd admin-portal
npm run build
npm start
```

#### Mobile Apps
```bash
# Android
flutter build apk --release

# iOS
flutter build ios --release
```

## 🧪 Testing

### Selenium Tests

The Selenium test suite covers:

- Login functionality
- Dashboard validation
- Worker management (CRUD)
- Project management (CRUD)
- Attendance management
- End-to-end workflows

**Run Tests:**
```bash
cd selenium-tests
mvn test
```

**View Reports:**
- HTML Reports: `test-output/ExtentReport_*.html`
- Screenshots: `test-output/screenshots/`
- Logs: `test-output/logs/`

### Test Structure

- **Page Object Model (POM)** pattern
- **Data-driven** testing with JSON/CSV
- **Parallel execution** support
- **Automatic screenshots** on failure
- **Extent Reports** integration

## 🔐 Authentication & Authorization

### User Roles

1. **Admin**: Full system access
   - Manage workers, projects, supervisors
   - View all attendance records
   - Generate reports

2. **Supervisor**: Project-level access
   - Manage assigned workers
   - Assign tasks
   - View project attendance

3. **Worker**: Limited access
   - Check in/out
   - View own attendance history

### JWT Tokens

All API requests require JWT authentication:
```
Authorization: Bearer <token>
```

## 🐛 Troubleshooting

### Common Issues

#### Backend Connection Refused
- Ensure backend is running on port 3001
- Check firewall settings
- Verify database connection

#### Admin Portal Not Loading
- Verify backend is running
- Check `NEXT_PUBLIC_API_BASE_URL` in `.env.local`
- Clear browser cache

#### Mobile App API Errors
- Verify backend URL in API service files
- Check network connectivity
- Ensure backend CORS is configured

#### Selenium Tests Failing
- Ensure admin portal is running
- Verify credentials in `config.properties`
- Check browser driver installation

#### Database Connection Issues
- Verify Supabase credentials
- Check network connectivity
- Ensure migrations are run

### Getting Help

1. Check logs:
   - Backend: Console output
   - Admin Portal: Browser console
   - Mobile Apps: Flutter logs
   - Selenium: `test-output/logs/`

2. Verify configuration files
3. Check database connectivity
4. Review error messages in console

## 📝 Development Guidelines

### Code Style

- **Backend**: Follow Node.js/Express conventions
- **Admin Portal**: Follow Next.js/React best practices
- **Mobile Apps**: Follow Flutter/Dart style guide
- **Tests**: Follow Page Object Model pattern

### Git Workflow

```bash
# Create feature branch
git checkout -b feature/your-feature

# Commit changes
git commit -m "Description of changes"

# Push to remote
git push origin feature/your-feature
```

### Database Migrations

Always create migrations for schema changes:

```bash
cd flutter_attendance/backend/migrations
# Create new migration file: 014_your_migration.sql
```

## 📄 License

[Your License Here]

## 👥 Contributors

[Your Team/Contributors]

## 📞 Support

For issues and questions:
- Create an issue in the repository
- Check existing documentation
- Review code comments

---

**Built with ❤️ for construction workforce management**

