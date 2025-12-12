// src/sockets/chatSocket.js
const logger = require('../utils/logger');

/**
 * Initialize chat socket events
 */
const initializeChatSocket = (io) => {
  // Store chat messages (in production, use database)
  const chatMessages = new Map();

  io.on('connection', (socket) => {
    /**
     * User joins chat room (ride-specific chat)
     */
    socket.on('join-chat', (data) => {
      const { rideId, userId, userName } = data;
      socket.join(`chat-${rideId}`);
      
      // Notify others
      io.to(`chat-${rideId}`).emit('user-joined', {
        rideId,
        userId,
        userName,
        timestamp: new Date(),
      });

      logger.info(`User ${userName} joined chat for ride: ${rideId}`);
    });

    /**
     * User leaves chat room
     */
    socket.on('leave-chat', (data) => {
      const { rideId, userName } = data;
      socket.leave(`chat-${rideId}`);
      
      io.to(`chat-${rideId}`).emit('user-left', {
        rideId,
        userName,
        timestamp: new Date(),
      });

      logger.info(`User ${userName} left chat for ride: ${rideId}`);
    });

    /**
     * Send message in chat
     */
    socket.on('send-message', (data) => {
      const { rideId, message, userId, userName, senderType } = data;
      
      const messageData = {
        id: `msg-${Date.now()}-${Math.random()}`,
        rideId,
        userId,
        userName,
        senderType, // 'user', 'captain', 'admin'
        message,
        timestamp: new Date(),
        read: false,
      };

      // Store message
      if (!chatMessages.has(rideId)) {
        chatMessages.set(rideId, []);
      }
      chatMessages.get(rideId).push(messageData);

      // Broadcast to all in chat room
      io.to(`chat-${rideId}`).emit('new-message', messageData);

      logger.debug(`New message in ride ${rideId} from ${userName}`);
    });

    /**
     * Typing indicator
     */
    socket.on('typing', (data) => {
      const { rideId, userId, userName } = data;
      io.to(`chat-${rideId}`).emit('user-typing', {
        rideId,
        userId,
        userName,
      });
    });

    /**
     * Stop typing indicator
     */
    socket.on('stop-typing', (data) => {
      const { rideId, userId } = data;
      io.to(`chat-${rideId}`).emit('user-stopped-typing', {
        rideId,
        userId,
      });
    });

    /**
     * Mark message as read
     */
    socket.on('mark-as-read', (data) => {
      const { rideId, messageId } = data;
      io.to(`chat-${rideId}`).emit('message-read', {
        rideId,
        messageId,
      });
    });

    /**
     * Cleanup on disconnect
     */
    socket.on('disconnect', () => {
      logger.info(`Client disconnected from chat: ${socket.id}`);
    });
  });
};

module.exports = initializeChatSocket;
