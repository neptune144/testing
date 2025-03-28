require('dotenv').config();
const app = require('./src/app');

const PORT = process.env.PORT || 5000;

// Check if required environment variables are set
const requiredEnvVars = ['JWT_SECRET'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingEnvVars.join(', '));
  process.exit(1);
}

// Create HTTP server
const server = app.listen(PORT, () => {
  console.log('🚀 Server is running on port', PORT);
  console.log('📝 Environment:', process.env.NODE_ENV || 'development');
  console.log('🌐 CORS enabled for:', process.env.FRONTEND_URL || 'http://localhost:5173');
  console.log('🔗 Test the server at: http://localhost:' + PORT + '/health');
});

// Handle server errors
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
    console.log('Please either:');
    console.log('1. Kill the process using this port');
    console.log('2. Change the PORT in your .env file');
  } else {
    console.error('❌ Server error:', error);
  }
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Promise Rejection:', err);
  server.close(() => process.exit(1));
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  server.close(() => process.exit(1));
}); 