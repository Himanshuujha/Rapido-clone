// src/sockets/rideSocket.js
const logger = require('../utils/logger');

/**
 * Initialize ride-related socket events
 */
const initializeRideSocket = (io) => {
  // Store active ride connections
  const activeRides = new Map();

  io.on('connection', (socket) => {
    /**
     * User joins a ride room
     */
    socket.on('join-ride', (rideId) => {
      socket.join(`ride-${rideId}`);
      logger.info(`User joined ride: ${rideId}`);
      
      activeRides.set(rideId, {
        ...activeRides.get(rideId),
        [socket.id]: socket.id,
      });
    });

    /**
     * User leaves a ride room
     */
    socket.on('leave-ride', (rideId) => {
      socket.leave(`ride-${rideId}`);
      logger.info(`User left ride: ${rideId}`);
    });

    /**
     * Update ride status
     */
    socket.on('ride-status-update', (data) => {
      const { rideId, status } = data;
      io.to(`ride-${rideId}`).emit('ride-status-changed', {
        rideId,
        status,
        timestamp: new Date(),
      });
      logger.info(`Ride ${rideId} status updated to ${status}`);
    });

    /**
     * Captain accepted ride
     */
    socket.on('ride-accepted', (data) => {
      io.to(`ride-${data.rideId}`).emit('ride-accepted', data);
      logger.info(`Ride ${data.rideId} accepted by captain`);
    });

    /**
     * Captain rejected ride
     */
    socket.on('ride-rejected', (data) => {
      io.to(`ride-${data.rideId}`).emit('ride-rejected', data);
      logger.info(`Ride ${data.rideId} rejected by captain`);
    });

    /**
     * Ride started
     */
    socket.on('ride-started', (data) => {
      io.to(`ride-${data.rideId}`).emit('ride-started', data);
      logger.info(`Ride ${data.rideId} started`);
    });

    /**
     * Ride completed
     */
    socket.on('ride-completed', (data) => {
      io.to(`ride-${data.rideId}`).emit('ride-completed', data);
      activeRides.delete(data.rideId);
      logger.info(`Ride ${data.rideId} completed`);
    });

    /**
     * Cleanup on disconnect
     */
    socket.on('disconnect', () => {
      activeRides.forEach((participants, rideId) => {
        delete participants[socket.id];
      });
    });
  });
};

module.exports = initializeRideSocket;
