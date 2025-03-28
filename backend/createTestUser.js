require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');

const createTestUser = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/poss');
    console.log('Connected to MongoDB');

    // Delete existing test user if exists
    await User.deleteOne({ username: 'testuser' });
    console.log('Cleaned up existing test user');

    // Create test user
    const testUser = await User.create({
      username: 'testuser',
      password: 'password123',
      name: 'Test User'
    });

    console.log('Test user created successfully:', {
      username: testUser.username,
      name: testUser.name
    });

    process.exit(0);
  } catch (error) {
    console.error('Error creating test user:', error);
    process.exit(1);
  }
};

createTestUser(); 