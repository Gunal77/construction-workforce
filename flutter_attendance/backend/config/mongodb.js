const mongoose = require('mongoose');
const env = require('./env');

let isConnected = false;

const connectMongoDB = async () => {
  if (isConnected) {
    return;
  }

  if (!env.mongodbUri) {
    throw new Error('MONGODB_URI is not set in environment variables');
  }

  // Clean up the URI - remove any accidental variable name prefix
  let cleanUri = env.mongodbUri.trim();
  if (cleanUri.startsWith('MONGODB_URI=')) {
    cleanUri = cleanUri.replace(/^MONGODB_URI=/, '');
    console.warn('⚠️  Warning: MONGODB_URI value contains variable name. Please fix your .env file!');
  }

  // Validate URI format
  if (!cleanUri.startsWith('mongodb://') && !cleanUri.startsWith('mongodb+srv://')) {
    throw new Error(`Invalid MongoDB URI format. URI must start with "mongodb://" or "mongodb+srv://". Got: ${cleanUri.substring(0, 50)}...`);
  }

  try {
    const options = {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    await mongoose.connect(cleanUri, options);
    isConnected = true;
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    isConnected = false;
    throw error;
  }
};

const disconnectMongoDB = async () => {
  if (!isConnected) {
    return;
  }

  try {
    await mongoose.disconnect();
    isConnected = false;
    console.log('MongoDB disconnected');
  } catch (error) {
    console.error('MongoDB disconnection error:', error);
    throw error;
  }
};

// Handle connection events
mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
  isConnected = false;
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
  isConnected = false;
});

module.exports = {
  connectMongoDB,
  disconnectMongoDB,
  mongoose,
  isConnected: () => isConnected,
};

