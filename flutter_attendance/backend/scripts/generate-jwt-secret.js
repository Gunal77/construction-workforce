/**
 * Generate JWT Secret Key
 * 
 * This script generates a secure random JWT secret key
 * Usage: node scripts/generate-jwt-secret.js
 */

const crypto = require('crypto');

function generateJWTSecret() {
  // Generate a 64-byte (512-bit) random secret
  // This is more than enough for JWT signing
  const secret = crypto.randomBytes(64).toString('hex');
  
  return secret;
}

if (require.main === module) {
  console.log('\n🔐 Generating JWT Secret Key...\n');
  
  const secret = generateJWTSecret();
  
  console.log('✅ Generated JWT Secret:');
  console.log('='.repeat(80));
  console.log(secret);
  console.log('='.repeat(80));
  
  console.log('\n📋 Add this to your .env file:');
  console.log(`JWT_SECRET=${secret}`);
  
  console.log('\n💡 Tips:');
  console.log('   - Keep this secret secure and never commit it to version control');
  console.log('   - Use different secrets for development and production');
  console.log('   - If you lose this secret, users will need to log in again');
  console.log('   - Minimum recommended length: 32 bytes (64 hex characters)');
  console.log('   - This secret is 64 bytes (128 hex characters) - very secure!\n');
}

module.exports = { generateJWTSecret };

