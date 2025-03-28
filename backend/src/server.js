import express from 'express';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import authRoutes from './routes/authRoutes.js';
import projectRoutes from './routes/projectRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import moduleRoutes from './routes/moduleRoutes.js';
import jwt from 'jsonwebtoken';
import userRoutes from './routes/userRoutes.js';
import communityRoutes from './routes/communityRoutes.js';

// Load environment variables
dotenv.config();

// Create Express app
const app = express();

// Create HTTP server and Socket.io instance
const httpServer = createServer(app);

// Declare server variable
let server = null;

// Function to validate origin
const validateOrigin = (origin, callback) => {
  const allowedOrigins = [
    process.env.FRONTEND_URL,
    'http://localhost:5173', // Vite's default port
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000'
  ];
  if (!origin || allowedOrigins.includes(origin)) {
    callback(null, true);
  } else {
    callback(new Error('Not allowed by CORS'));
  }
};

// Socket.io authentication middleware
const authenticateSocket = (socket, next) => {
  const token = socket.handshake.auth.token;
  
  if (!token) {
    console.error('No token provided for socket connection');
    return next(new Error('Authentication error: No token provided'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded;
    console.log('Socket authenticated for user:', decoded._id);
    next();
  } catch (error) {
    console.error('Socket authentication failed:', error);
    next(new Error('Authentication error: Invalid token'));
  }
};

// CORS configuration
const corsOptions = {
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

// Apply CORS middleware
app.use(cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database connection with retry logic
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/modules', moduleRoutes);
app.use('/api/users', userRoutes);
app.use('/api/communities', communityRoutes);

// Basic route
app.get('/', (req, res) => {
  res.json({ 
    success: true,
    message: 'Welcome to DevCollab API',
    version: '1.0.0'
  });
});

// Socket.io configuration
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

// Apply authentication middleware to all socket connections
io.use(authenticateSocket);

// Socket.io connection handler
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join room', (room) => {
    socket.join(room);
    console.log(`Socket ${socket.id} joined room ${room}`);
  });

  socket.on('leave room', (room) => {
    socket.leave(room);
    console.log(`Socket ${socket.id} left room ${room}`);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Start server with port fallback
const startServer = async (initialPort) => {
  const findAvailablePort = async (startPort) => {
    return new Promise((resolve, reject) => {
      try {
        const serverInstance = httpServer.listen(startPort, () => {
          console.log(`Server is running on port ${startPort}`);
          console.log(`CORS enabled for origins: ${process.env.FRONTEND_URL}`);
          server = serverInstance;
          resolve(startPort);
        });

        serverInstance.on('error', (err) => {
          if (err.code === 'EADDRINUSE') {
            console.log(`Port ${startPort} is in use, trying ${startPort + 1}...`);
            serverInstance.close();
            resolve(findAvailablePort(startPort + 1));
          } else {
            reject(err);
          }
        });
      } catch (err) {
        reject(err);
      }
    });
  };

  try {
    const port = await findAvailablePort(initialPort);
    if (port !== initialPort) {
      console.log(`Note: Original port ${initialPort} was in use, now running on port ${port}`);
    }
    return port;
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

// Initialize server after MongoDB connection
mongoose.connection.once('open', async () => {
  try {
    const PORT = parseInt(process.env.PORT) || 5001;
    await startServer(PORT);
    console.log('Server started successfully');
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
});

// Handle MongoDB connection errors
mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

// Handle MongoDB disconnection
mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
});

// Update the SIGINT handler
process.on('SIGINT', async () => {
  try {
    await mongoose.connection.close();
    if (server) {
      server.close(() => {
        console.log('Server closed. Database instance disconnected');
        process.exit(0);
      });
    } else {
      console.log('Database instance disconnected');
      process.exit(0);
    }
  } catch (err) {
    console.error('Server shutdown error:', err);
    process.exit(1);
  }
});

// Handle server shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  httpServer.close(() => {
    console.log('Server closed');
    mongoose.connection.close(false, () => {
      console.log('MongoDB disconnected');
      process.exit(0);
    });
  });
}); 