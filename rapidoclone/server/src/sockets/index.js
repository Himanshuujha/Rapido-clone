// src/sockets/index.js
const { Server } = require('socket.io');
const logger = require('../utils/logger');

const initializeRideSocket = require('./rideSocket');
const initializeLocationSocket = require('./locationSocket');
const initializeChatSocket = require('./chatSocket');

const { initSocketService } = require('../services/socketService');

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

  // Optional socket auth middleware
  io.use((socket, next) => {
    // Add token-based auth here if needed later
    next();
  });

  io.on('connection', (socket) => {
    logger.info(`Client connected: ${socket.id}`);

    // 🔑 JOIN USER ROOM
    socket.on('join:user', (userId) => {
      if (!userId) return;
      socket.join(`user:${userId}`);
      logger.info(`Socket ${socket.id} joined user:${userId}`);
    });

    // 🔑 JOIN CAPTAIN ROOM
    socket.on('join:captain', (captainId) => {
      if (!captainId) return;
      socket.join(`captain:${captainId}`);
      logger.info(`Socket ${socket.id} joined captain:${captainId}`);
    });

    socket.on('disconnect', () => {
      logger.info(`Client disconnected: ${socket.id}`);
    });

    socket.on('error', (error) => {
      logger.error(`Socket error for ${socket.id}:`, error);
    });
  });

  // Initialize feature-specific socket modules
  initializeRideSocket(io);
  initializeLocationSocket(io);
  initializeChatSocket(io);

  // 🔥 Make io available to socketService (VERY IMPORTANT)
  initSocketService(io);

  logger.info('✅ Socket.io initialized successfully');

  return io;
};

module.exports = initializeSocket;
