/**
 * Create Sample Clients in MongoDB
 * 
 * This script creates sample client users in MongoDB
 * 
 * Usage: node scripts/create-sample-clients.js
 */

const { connectMongoDB, disconnectMongoDB } = require('../config/mongodb');
const User = require('../models/User');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

const sampleClients = [
  {
    name: 'ABC Construction Ltd',
    email: 'abc.construction@example.com',
    phone: '+65 6123 4567',
    password: 'client123'
  },
  {
    name: 'XYZ Developers Pte Ltd',
    email: 'xyz.developers@example.com',
    phone: '+65 6234 5678',
    password: 'client123'
  },
  {
    name: 'Global Builders Inc',
    email: 'global.builders@example.com',
    phone: '+65 6345 6789',
    password: 'client123'
  },
  {
    name: 'Premier Construction Group',
    email: 'premier.construction@example.com',
    phone: '+65 6456 7890',
    password: 'client123'
  },
  {
    name: 'Metro Infrastructure Co',
    email: 'metro.infrastructure@example.com',
    phone: '+65 6567 8901',
    password: 'client123'
  }
];

async function createSampleClients() {
  console.log('\n👥 Creating Sample Clients in MongoDB...\n');
  console.log('='.repeat(80));
  
  try {
    await connectMongoDB();
    console.log('✅ Connected to MongoDB\n');
    
    let created = 0;
    let skipped = 0;
    
    for (const clientData of sampleClients) {
      try {
        // Check if client already exists
        const existing = await User.findOne({ 
          email: clientData.email.toLowerCase() 
        }).lean();
        
        if (existing) {
          console.log(`   ⏭️  Skipped (already exists): ${clientData.name}`);
          skipped++;
          continue;
        }
        
        // Hash password
        const passwordHash = await bcrypt.hash(clientData.password, 12);
        
        // Create client user directly using collection.insertOne to bypass pre-save hook
        const clientId = uuidv4();
        await User.collection.insertOne({
          _id: clientId,
          name: clientData.name,
          email: clientData.email.toLowerCase(),
          phone: clientData.phone,
          password: passwordHash,
          role: 'CLIENT',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        console.log(`   ✅ Created: ${clientData.name} (${clientData.email})`);
        created++;
      } catch (error) {
        if (error.code === 11000) {
          console.log(`   ⏭️  Skipped (duplicate): ${clientData.name}`);
          skipped++;
        } else {
          console.error(`   ❌ Error creating ${clientData.name}:`, error.message);
        }
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 Summary:');
    console.log('='.repeat(80));
    console.log(`Clients created: ${created}`);
    console.log(`Clients skipped: ${skipped}`);
    console.log(`Total clients: ${created + skipped}`);
    console.log('='.repeat(80));
    
    // Verify
    console.log('\n🔍 Verifying clients...');
    const totalClients = await User.countDocuments({ role: 'CLIENT' });
    console.log(`   ✅ Total clients in MongoDB: ${totalClients}`);
    
    console.log('\n✅ Sample clients creation completed!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await disconnectMongoDB();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

if (require.main === module) {
  createSampleClients();
}

module.exports = { createSampleClients };

