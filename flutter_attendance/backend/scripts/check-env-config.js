/**
 * Check and Fix Environment Configuration
 * 
 * This script checks all .env files and ensures MongoDB keys are properly configured
 * Usage: node scripts/check-env-config.js
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const projectRoot = path.resolve(__dirname, '../..');
const backendRoot = path.resolve(__dirname, '..');
const adminPortalRoot = path.resolve(projectRoot, '../admin-portal');

// Files to check
const envFiles = [
  {
    path: path.join(backendRoot, '.env'),
    name: 'Backend .env',
    required: true,
  },
  {
    path: path.join(backendRoot, '.env.example'),
    name: 'Backend .env.example',
    required: false,
  },
  {
    path: path.join(adminPortalRoot, '.env.local'),
    name: 'Admin Portal .env.local',
    required: false,
  },
  {
    path: path.join(adminPortalRoot, '.env.example'),
    name: 'Admin Portal .env.example',
    required: false,
  },
];

// Required backend variables
const requiredBackendVars = {
  'DB_PROVIDER': 'mongodb',
  'MONGODB_URI': 'mongodb+srv://...',
  'DATABASE_URL': 'postgresql://...',
  'JWT_SECRET': '64-byte hex string',
  'JWT_EXPIRES_IN': '15m',
};

// Optional backend variables (for Supabase fallback)
const optionalBackendVars = {
  'SUPABASE_URL': 'https://...',
  'SUPABASE_SERVICE_ROLE_KEY': 'eyJhbGci...',
  'SUPABASE_BUCKET': 'attendance',
};

// Admin portal variables
const adminPortalVars = {
  'NEXT_PUBLIC_API_BASE_URL': 'http://localhost:4000',
};

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const vars = {};

  lines.forEach((line, index) => {
    // Remove comments and trim
    const cleanLine = line.split('#')[0].trim();
    
    if (!cleanLine || !cleanLine.includes('=')) {
      return;
    }

    const [key, ...valueParts] = cleanLine.split('=');
    const value = valueParts.join('=').trim();
    
    if (key && value) {
      vars[key.trim()] = value;
    }
  });

  return vars;
}

function validateMongoDBUri(uri) {
  if (!uri) return { valid: false, error: 'Missing' };
  if (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://')) {
    return { valid: false, error: 'Invalid format (must start with mongodb:// or mongodb+srv://)' };
  }
  if (uri.includes('mongodb+srv://') && !uri.includes('@')) {
    return { valid: false, error: 'Missing credentials' };
  }
  return { valid: true };
}

function validateJWTSecret(secret) {
  if (!secret) return { valid: false, error: 'Missing' };
  if (secret.length < 64) {
    return { valid: false, error: 'Too short (minimum 64 hex characters)' };
  }
  if (!/^[a-f0-9]+$/i.test(secret)) {
    return { valid: false, error: 'Invalid format (must be hex string)' };
  }
  return { valid: true };
}

function generateJWTSecret() {
  return crypto.randomBytes(64).toString('hex');
}

function checkEnvFile(envFile) {
  console.log(`\n📄 Checking: ${envFile.name}`);
  console.log('='.repeat(80));

  if (!fs.existsSync(envFile.path)) {
    if (envFile.required) {
      console.log(`❌ File not found: ${envFile.path}`);
      console.log(`   This file is REQUIRED!`);
      return { exists: false, required: true };
    } else {
      console.log(`⚠️  File not found: ${envFile.path} (optional)`);
      return { exists: false, required: false };
    }
  }

  const vars = parseEnvFile(envFile.path);
  const issues = [];
  const suggestions = [];

  if (envFile.name.includes('Backend')) {
    // Check backend variables
    console.log('\n🔍 Checking Backend Variables:');

    // Check DB_PROVIDER
    const dbProvider = vars['DB_PROVIDER'];
    if (!dbProvider) {
      issues.push('DB_PROVIDER is missing');
      suggestions.push('DB_PROVIDER=mongodb');
    } else if (dbProvider.toLowerCase() !== 'mongodb') {
      issues.push(`DB_PROVIDER is set to "${dbProvider}" (should be "mongodb")`);
      suggestions.push('DB_PROVIDER=mongodb');
    } else {
      console.log('   ✅ DB_PROVIDER=mongodb');
    }

    // Check MONGODB_URI
    const mongoUri = vars['MONGODB_URI'];
    const mongoValidation = validateMongoDBUri(mongoUri);
    if (!mongoValidation.valid) {
      issues.push(`MONGODB_URI: ${mongoValidation.error}`);
      suggestions.push('MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/dbname?retryWrites=true&w=majority');
    } else {
      // Hide password in display
      const displayUri = mongoUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
      console.log(`   ✅ MONGODB_URI=${displayUri}`);
    }

    // Check JWT_SECRET
    const jwtSecret = vars['JWT_SECRET'];
    const jwtValidation = validateJWTSecret(jwtSecret);
    if (!jwtValidation.valid) {
      issues.push(`JWT_SECRET: ${jwtValidation.error}`);
      const newSecret = generateJWTSecret();
      suggestions.push(`JWT_SECRET=${newSecret}`);
      console.log(`   ⚠️  JWT_SECRET: ${jwtValidation.error}`);
      console.log(`   💡 Generated new secret: ${newSecret.substring(0, 32)}...`);
    } else {
      console.log(`   ✅ JWT_SECRET=${jwtSecret.substring(0, 32)}... (${jwtSecret.length} chars)`);
    }

    // Check JWT_EXPIRES_IN
    const jwtExpires = vars['JWT_EXPIRES_IN'];
    if (!jwtExpires) {
      issues.push('JWT_EXPIRES_IN is missing');
      suggestions.push('JWT_EXPIRES_IN=15m');
    } else {
      console.log(`   ✅ JWT_EXPIRES_IN=${jwtExpires}`);
    }

    // Check DATABASE_URL (still needed for some legacy queries)
    const dbUrl = vars['DATABASE_URL'];
    if (!dbUrl) {
      issues.push('DATABASE_URL is missing (still needed for some legacy queries)');
      suggestions.push('DATABASE_URL=postgresql://user:pass@host:5432/dbname');
    } else {
      const displayUrl = dbUrl.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
      console.log(`   ✅ DATABASE_URL=${displayUrl}`);
    }

    // Check optional Supabase vars (warn if missing but don't require)
    console.log('\n📦 Optional Variables (Supabase - not needed for MongoDB):');
    const supabaseUrl = vars['SUPABASE_URL'];
    const supabaseKey = vars['SUPABASE_SERVICE_ROLE_KEY'];
    const supabaseBucket = vars['SUPABASE_BUCKET'];
    
    if (!supabaseUrl || !supabaseKey || !supabaseBucket) {
      console.log('   ℹ️  Supabase variables are optional (files stored in MongoDB GridFS)');
    } else {
      console.log('   ℹ️  Supabase variables present (will be ignored when DB_PROVIDER=mongodb)');
    }

  } else if (envFile.name.includes('Admin Portal')) {
    // Check admin portal variables
    console.log('\n🔍 Checking Admin Portal Variables:');

    const apiUrl = vars['NEXT_PUBLIC_API_BASE_URL'];
    if (!apiUrl) {
      issues.push('NEXT_PUBLIC_API_BASE_URL is missing');
      suggestions.push('NEXT_PUBLIC_API_BASE_URL=http://localhost:4000');
    } else {
      console.log(`   ✅ NEXT_PUBLIC_API_BASE_URL=${apiUrl}`);
    }
  }

  // Summary
  if (issues.length > 0) {
    console.log('\n❌ Issues Found:');
    issues.forEach(issue => console.log(`   - ${issue}`));
    
    console.log('\n💡 Suggestions:');
    suggestions.forEach(suggestion => console.log(`   ${suggestion}`));
    
    return { exists: true, issues, suggestions };
  } else {
    console.log('\n✅ All required variables are properly configured!');
    return { exists: true, issues: [], suggestions: [] };
  }
}

function main() {
  console.log('🔍 Environment Configuration Checker');
  console.log('='.repeat(80));

  const results = envFiles.map((file, index) => ({
    ...checkEnvFile(file),
    fileIndex: index,
    fileName: file.name,
  }));
  
  const requiredFilesMissing = results.filter((r, i) => !r.exists && envFiles[i].required);
  const filesWithIssues = results.filter((r, i) => r.exists && r.issues && r.issues.length > 0 && !envFiles[i].name.includes('.example'));

  console.log('\n\n📊 Summary');
  console.log('='.repeat(80));

  if (requiredFilesMissing.length > 0) {
    console.log('\n❌ Required files missing:');
    requiredFilesMissing.forEach((r, i) => {
      const fileIndex = results.findIndex(res => res === r);
      if (fileIndex >= 0) {
        const file = envFiles[fileIndex];
        console.log(`   - ${file.path}`);
      }
    });
  }

  if (filesWithIssues.length > 0) {
    console.log('\n⚠️  Files with configuration issues:');
    filesWithIssues.forEach((result, index) => {
      const fileIndex = results.findIndex(res => res === result);
      if (fileIndex >= 0) {
        const file = envFiles[fileIndex];
        console.log(`   ${index + 1}. ${file.name}`);
        result.issues.forEach(issue => console.log(`      - ${issue}`));
      }
    });
  }

  if (requiredFilesMissing.length === 0 && filesWithIssues.length === 0) {
    console.log('\n✅ All environment files are properly configured!');
    console.log('\n📋 Configuration Status:');
    results.forEach((result, i) => {
      if (result.exists && !envFiles[i].name.includes('.example')) {
        if (result.issues && result.issues.length > 0) {
          console.log(`   ⚠️  ${envFiles[i].name} - Has issues`);
        } else {
          console.log(`   ✅ ${envFiles[i].name} - OK`);
        }
      }
    });
  } else {
    console.log('\n💡 Run: npm run generate:jwt-secret (to generate a new JWT secret)');
    console.log('💡 Update your .env files with the suggestions above');
  }

  console.log('\n');
}

if (require.main === module) {
  main();
}

module.exports = { checkEnvFile, validateMongoDBUri, validateJWTSecret };

