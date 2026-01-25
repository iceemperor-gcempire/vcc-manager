const mongoose = require('mongoose');

const connectDB = async (retries = 5) => {
  try {
    // MongoDB connection options for production stability
    const options = {
      maxPoolSize: 10, // Maximum number of connections
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      bufferCommands: false, // Disable mongoose buffering
    };

    const conn = await mongoose.connect(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/vcc-manager',
      options
    );
    
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    
    // Handle MongoDB connection events
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected');
    });
    
    mongoose.connection.on('reconnected', () => {
      console.log('MongoDB reconnected');
    });
    
  } catch (error) {
    console.error(`Error connecting to MongoDB (attempt ${6 - retries}/5):`, error.message);
    
    if (retries > 0) {
      console.log(`Retrying in 5 seconds... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, 5000));
      return connectDB(retries - 1);
    } else {
      console.error('Failed to connect to MongoDB after 5 attempts. Exiting...');
      process.exit(1);
    }
  }
};

module.exports = connectDB;