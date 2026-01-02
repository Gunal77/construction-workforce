const path = require('path');
const dotenv = require('dotenv');

dotenv.config({
  path: path.resolve(process.cwd(), '.env'),
});

// Validate required environment variables for MongoDB
const requiredVariables = [
  'MONGODB_URI',
  'JWT_SECRET',
];

const missing = requiredVariables.filter((key) => !process.env[key]);

if (missing.length) {
  throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
}

const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number.parseInt(process.env.PORT, 10) || 4000,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  mongodbUri: process.env.MONGODB_URI,
  seedMode: process.env.SEED_MODE === 'true',
};

module.exports = config;
