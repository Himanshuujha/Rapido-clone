// src/sockets/locationSocket.js
const logger = require('../utils/logger');

/**
 * Initialize location tracking socket events
 */
const initializeLocationSocket = (io) => {
  // Store active location tracking
  const trackedLocations = new Map();

  io.on('connection', (socket) => {
    /**
     * Start tracking location for ride
     */
    socket.on('start-tracking', (rideId) => {
      socket.join(`location-${rideId}`);
      if (!trackedLocations.has(rideId)) {
        trackedLocations.set(rideId, []);
      }
      logger.info(`Location tracking started for ride: ${rideId}`);
    });

    /**
     * Stop tracking location for ride
     */
    socket.on('stop-tracking', (rideId) => {
      socket.leave(`location-${rideId}`);
      logger.info(`Location tracking stopped for ride: ${rideId}`);
    });

    /**
     * Update current location
     */
    socket.on('location-update', (data) => {
      const { rideId, lat, lng, accuracy } = data;
      
      // Validate coordinates
      if (typeof lat === 'number' && typeof lng === 'number') {
        // Store location history
        if (trackedLocations.has(rideId)) {
          trackedLocations.get(rideId).push({
            lat,
            lng,
            accuracy,
            timestamp: new Date(),
          });
        }

        // Broadcast to all users in ride room
        io.to(`location-${rideId}`).emit('location-updated', {
          rideId,
          lat,
          lng,
          accuracy,
          timestamp: new Date(),
          userId: socket.id,
        });

        logger.debug(`Location update for ride ${rideId}: [${lat}, ${lng}]`);
      }
    });

    /**
     * Request current location of captain
     */
    socket.on('request-location', (data) => {
      const { rideId, userId } = data;
      io.to(`location-${rideId}`).emit('location-requested', {
        rideId,
        requestedBy: socket.id,
      });
    });

    /**
     * Cleanup on disconnect
     */
    socket.on('disconnect', () => {
      trackedLocations.forEach((_, rideId) => {
        io.to(`location-${rideId}`).emit('user-disconnected', {
          userId: socket.id,
        });
      });
    });
  });
};

module.exports = initializeLocationSocket;
