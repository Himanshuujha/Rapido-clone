// src/sockets/index.js
const { Server } = require('socket.io');
const logger = require('../utils/logger');
const initializeRideSocket = require('./rideSocket');
const initializeLocationSocket = require('./locationSocket');
const initializeChatSocket = require('./chatSocket');

/**
 * Initialize Socket.io with all socket handlers
 */
const initializeSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: [
        process.env.CLIENT_URL || 'http://localhost:3000',
        process.env.CAPTAIN_APP_URL || 'http://localhost:3001',
        process.env.ADMIN_URL || 'http://localhost:3002',
      ],
      credentials: true,
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
  });

  // Middleware for socket authentication (optional)
  io.use((socket, next) => {
    // Add authentication logic here if needed
    // For now, allow all connections
    next();
  });

  // Connection event handler
  io.on('connection', (socket) => {
    logger.info(`Client connected: ${socket.id}`);

    socket.on('disconnect', () => {
      logger.info(`Client disconnected: ${socket.id}`);
    });

    socket.on('error', (error) => {
      logger.error(`Socket error for ${socket.id}:`, error);
    });
  });

  // Initialize socket modules
  initializeRideSocket(io);
  initializeLocationSocket(io);
  initializeChatSocket(io);

  logger.info('✅ Socket.io initialized successfully');

  return io;
};

module.exports = initializeSocket;
