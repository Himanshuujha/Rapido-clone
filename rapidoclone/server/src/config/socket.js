// src/config/socket.js
const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Captain = require('../models/Captain');
const Ride = require('../models/Ride');
const logger = require('../utils/logger');
const { cache } = require('./redis');

// Store active connections
const activeConnections = {
  users: new Map(),      // userId -> socketId
  captains: new Map(),   // captainId -> socketId
  rides: new Map(),      // rideId -> { user: socketId, captain: socketId }
};

/**
 * Initialize Socket.io server
 * @param {http.Server} server - HTTP server instance
 * @returns {socketIO.Server} - Socket.io server instance
 */
const initializeSocket = (server) => {
  const io = socketIO(server, {
    cors: {
      origin: [
        process.env.CLIENT_URL || 'http://localhost:3000',
        process.env.CAPTAIN_APP_URL || 'http://localhost:3001',
        process.env.ADMIN_URL || 'http://localhost:3002',
      ],
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling'],
    allowEIO3: true,
  });

  // ==========================================
  // AUTHENTICATION MIDDLEWARE
  // ==========================================
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth.token ||
        socket.handshake.headers.authorization?.split(' ')[1] ||
        socket.handshake.query.token;

      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Determine user type and fetch user data
      if (decoded.type === 'captain') {
        const captain = await Captain.findById(decoded.id).select('-password');
        if (!captain) {
          return next(new Error('Authentication error: Captain not found'));
        }
        if (captain.status !== 'approved') {
          return next(new Error('Authentication error: Captain not approved'));
        }
        socket.user = captain;
        socket.userType = 'captain';
        socket.userId = captain._id.toString();
      } else if (decoded.type === 'admin') {
        // Admin socket connection
        socket.userType = 'admin';
        socket.userId = decoded.id;
      } else {
        const user = await User.findById(decoded.id).select('-password');
        if (!user) {
          return next(new Error('Authentication error: User not found'));
        }
        if (!user.isActive) {
          return next(new Error('Authentication error: Account is deactivated'));
        }
        socket.user = user;
        socket.userType = 'user';
        socket.userId = user._id.toString();
      }

      next();
    } catch (error) {
      logger.error('Socket authentication error:', error.message);
      
      if (error.name === 'TokenExpiredError') {
        return next(new Error('Authentication error: Token expired'));
      }
      if (error.name === 'JsonWebTokenError') {
        return next(new Error('Authentication error: Invalid token'));
      }
      
      next(new Error('Authentication error'));
    }
  });

  // ==========================================
  // CONNECTION HANDLER
  // ==========================================
  io.on('connection', (socket) => {
    const { userId, userType, user } = socket;

    logger.info(`Socket connected: ${userId} (${userType}) - Socket ID: ${socket.id}`);

    // Store connection
    if (userType === 'user') {
      activeConnections.users.set(userId, socket.id);
    } else if (userType === 'captain') {
      activeConnections.captains.set(userId, socket.id);
    }

    // Join personal room
    socket.join(userId);

    // Join role-based room
    socket.join(`${userType}s`); // 'users', 'captains', 'admins'

    // Emit connection success
    socket.emit('connected', {
      message: 'Successfully connected',
      userId,
      userType,
      socketId: socket.id,
    });

    // ==========================================
    // CAPTAIN EVENTS
    // ==========================================
    if (userType === 'captain') {
      // Captain goes online
      socket.on('captain:go-online', async (data) => {
        try {
          const { latitude, longitude } = data || {};

          await Captain.findByIdAndUpdate(userId, {
            isOnline: true,
            currentLocation: {
              type: 'Point',
              coordinates: [longitude || 0, latitude || 0],
            },
            lastLocationUpdate: new Date(),
          });

          // Cache captain location in Redis for quick lookups
          await cache.set(`captain:location:${userId}`, {
            latitude,
            longitude,
            isOnline: true,
            updatedAt: new Date().toISOString(),
          }, 300); // 5 minutes TTL

          socket.emit('captain:status-updated', { isOnline: true });
          logger.info(`Captain ${userId} is now online`);
        } catch (error) {
          logger.error('Error going online:', error);
          socket.emit('error', { message: 'Failed to go online' });
        }
      });

      // Captain goes offline
      socket.on('captain:go-offline', async () => {
        try {
          await Captain.findByIdAndUpdate(userId, {
            isOnline: false,
          });

          await cache.del(`captain:location:${userId}`);

          socket.emit('captain:status-updated', { isOnline: false });
          logger.info(`Captain ${userId} is now offline`);
        } catch (error) {
          logger.error('Error going offline:', error);
          socket.emit('error', { message: 'Failed to go offline' });
        }
      });

      // Captain location update
      socket.on('captain:update-location', async (data) => {
        try {
          const { latitude, longitude, heading, speed } = data;

          // Update in database
          await Captain.findByIdAndUpdate(userId, {
            currentLocation: {
              type: 'Point',
              coordinates: [longitude, latitude],
            },
            lastLocationUpdate: new Date(),
          });

          // Update in Redis cache
          await cache.set(`captain:location:${userId}`, {
            latitude,
            longitude,
            heading,
            speed,
            isOnline: true,
            updatedAt: new Date().toISOString(),
          }, 300);

          // If captain is on a ride, emit to the user
          const activeRide = await Ride.findOne({
            captain: userId,
            status: { $in: ['accepted', 'arriving', 'arrived', 'started'] },
          });

          if (activeRide) {
            io.to(activeRide.user.toString()).emit('captain:location', {
              rideId: activeRide._id,
              location: { latitude, longitude, heading, speed },
              updatedAt: new Date().toISOString(),
            });

            // Store in ride tracking
            await Ride.findByIdAndUpdate(activeRide._id, {
              $push: {
                tracking: {
                  coordinates: { latitude, longitude },
                  timestamp: new Date(),
                },
              },
            });
          }
        } catch (error) {
          logger.error('Error updating captain location:', error);
        }
      });

      // Captain accepts ride
      socket.on('ride:accept', async (data) => {
        try {
          const { rideId } = data;

          const ride = await Ride.findById(rideId);
          if (!ride) {
            return socket.emit('error', { message: 'Ride not found' });
          }

          if (ride.status !== 'searching') {
            return socket.emit('error', { message: 'Ride is no longer available' });
          }

          // Update ride
          ride.captain = userId;
          ride.status = 'accepted';
          ride.timestamps.accepted = new Date();
          await ride.save();

          // Update captain status
          await Captain.findByIdAndUpdate(userId, { isOnRide: true });

          // Get captain details for user
          const captain = await Captain.findById(userId).select(
            'firstName lastName phone avatar vehicle ratings currentLocation'
          );

          // Notify user
          io.to(ride.user.toString()).emit('ride:accepted', {
            ride: ride.toObject(),
            captain: captain.toObject(),
          });

          // Notify captain
          socket.emit('ride:accepted-confirm', { ride: ride.toObject() });

          // Notify other captains that ride is taken
          io.to('captains').emit('ride:taken', { rideId });

          // Store ride connection mapping
          activeConnections.rides.set(rideId.toString(), {
            user: activeConnections.users.get(ride.user.toString()),
            captain: socket.id,
          });

          logger.info(`Ride ${rideId} accepted by captain ${userId}`);
        } catch (error) {
          logger.error('Error accepting ride:', error);
          socket.emit('error', { message: 'Failed to accept ride' });
        }
      });

      // Captain rejects ride
      socket.on('ride:reject', async (data) => {
        try {
          const { rideId, reason } = data;

          // Log rejection for analytics
          logger.info(`Ride ${rideId} rejected by captain ${userId}: ${reason}`);

          socket.emit('ride:rejected-confirm', { rideId });
        } catch (error) {
          logger.error('Error rejecting ride:', error);
        }
      });

      // Captain arrived at pickup
      socket.on('ride:captain-arrived', async (data) => {
        try {
          const { rideId } = data;

          const ride = await Ride.findByIdAndUpdate(
            rideId,
            {
              status: 'arrived',
              'timestamps.captainArrived': new Date(),
            },
            { new: true }
          );

          if (ride) {
            io.to(ride.user.toString()).emit('ride:captain-arrived', {
              rideId,
              message: 'Your captain has arrived',
            });

            socket.emit('ride:status-updated', { rideId, status: 'arrived' });
          }
        } catch (error) {
          logger.error('Error updating arrival status:', error);
          socket.emit('error', { message: 'Failed to update status' });
        }
      });

      // Captain starts ride (with OTP verification)
      socket.on('ride:start', async (data) => {
        try {
          const { rideId, otp } = data;

          const ride = await Ride.findById(rideId);
          if (!ride) {
            return socket.emit('error', { message: 'Ride not found' });
          }

          // Verify OTP
          if (ride.otp.code !== otp) {
            return socket.emit('error', { message: 'Invalid OTP' });
          }

          ride.status = 'started';
          ride.otp.verified = true;
          ride.timestamps.started = new Date();
          await ride.save();

          // Notify both parties
          io.to(ride.user.toString()).emit('ride:started', { rideId });
          socket.emit('ride:started', { rideId });

          logger.info(`Ride ${rideId} started`);
        } catch (error) {
          logger.error('Error starting ride:', error);
          socket.emit('error', { message: 'Failed to start ride' });
        }
      });

      // Captain completes ride
      socket.on('ride:complete', async (data) => {
        try {
          const { rideId, finalFare } = data;

          const ride = await Ride.findById(rideId);
          if (!ride) {
            return socket.emit('error', { message: 'Ride not found' });
          }

          ride.status = 'completed';
          ride.timestamps.completed = new Date();
          ride.payment.status = 'completed';
          
          if (finalFare) {
            ride.fare.total = finalFare;
          }
          
          await ride.save();

          // Update captain stats
          await Captain.findByIdAndUpdate(userId, {
            isOnRide: false,
            $inc: {
              'stats.totalRides': 1,
              'stats.totalEarnings': ride.fare.captainEarnings || ride.fare.total * 0.8,
              'stats.totalDistance': ride.route.distance || 0,
            },
          });

          // Notify user
          io.to(ride.user.toString()).emit('ride:completed', {
            ride: ride.toObject(),
          });

          // Notify captain
          socket.emit('ride:completed', {
            ride: ride.toObject(),
          });

          // Clean up ride connection mapping
          activeConnections.rides.delete(rideId.toString());

          logger.info(`Ride ${rideId} completed`);
        } catch (error) {
          logger.error('Error completing ride:', error);
          socket.emit('error', { message: 'Failed to complete ride' });
        }
      });

      // Captain cancels ride
      socket.on('ride:captain-cancel', async (data) => {
        try {
          const { rideId, reason } = data;

          const ride = await Ride.findByIdAndUpdate(
            rideId,
            {
              status: 'cancelled',
              'timestamps.cancelled': new Date(),
              'cancellation.by': 'captain',
              'cancellation.reason': reason,
            },
            { new: true }
          );

          if (ride) {
            // Update captain
            await Captain.findByIdAndUpdate(userId, {
              isOnRide: false,
              $inc: { 'stats.cancellationRate': 1 },
            });

            // Notify user
            io.to(ride.user.toString()).emit('ride:cancelled', {
              rideId,
              cancelledBy: 'captain',
              reason,
            });

            socket.emit('ride:cancelled-confirm', { rideId });

            activeConnections.rides.delete(rideId.toString());
          }
        } catch (error) {
          logger.error('Error cancelling ride (captain):', error);
          socket.emit('error', { message: 'Failed to cancel ride' });
        }
      });
    }

    // ==========================================
    // USER EVENTS
    // ==========================================
    if (userType === 'user') {
      // User requests ride
      socket.on('ride:request', async (data) => {
        try {
          const { rideId, pickup, vehicleType } = data;

          // Find nearby captains
          const nearbyCaptains = await Captain.find({
            isOnline: true,
            isOnRide: false,
            status: 'approved',
            'vehicle.type': vehicleType,
            currentLocation: {
              $near: {
                $geometry: {
                  type: 'Point',
                  coordinates: [pickup.longitude, pickup.latitude],
                },
                $maxDistance: 5000, // 5km radius
              },
            },
          })
            .select('_id firstName')
            .limit(15);

          // Emit to nearby captains
          nearbyCaptains.forEach((captain) => {
            const captainSocketId = activeConnections.captains.get(captain._id.toString());
            if (captainSocketId) {
              io.to(captainSocketId).emit('ride:new-request', data);
            }
          });

          logger.info(`Ride request ${rideId} sent to ${nearbyCaptains.length} captains`);
        } catch (error) {
          logger.error('Error broadcasting ride request:', error);
        }
      });

      // User cancels ride
      socket.on('ride:cancel', async (data) => {
        try {
          const { rideId, reason } = data;

          const ride = await Ride.findByIdAndUpdate(
            rideId,
            {
              status: 'cancelled',
              'timestamps.cancelled': new Date(),
              'cancellation.by': 'user',
              'cancellation.reason': reason,
            },
            { new: true }
          );

          if (ride && ride.captain) {
            // Notify captain
            io.to(ride.captain.toString()).emit('ride:cancelled', {
              rideId,
              cancelledBy: 'user',
              reason,
            });

            // Update captain status
            await Captain.findByIdAndUpdate(ride.captain, {
              isOnRide: false,
            });
          }

          socket.emit('ride:cancelled-confirm', { rideId });
          activeConnections.rides.delete(rideId.toString());

          logger.info(`Ride ${rideId} cancelled by user`);
        } catch (error) {
          logger.error('Error cancelling ride (user):', error);
          socket.emit('error', { message: 'Failed to cancel ride' });
        }
      });

      // User sends SOS
      socket.on('ride:sos', async (data) => {
        try {
          const { rideId, location } = data;

          const ride = await Ride.findById(rideId).populate('user captain');

          if (ride) {
            // Notify admin
            io.to('admins').emit('sos:alert', {
              rideId,
              user: ride.user,
              captain: ride.captain,
              location,
              timestamp: new Date(),
            });

            // TODO: Send SMS to emergency contacts
            // TODO: Alert nearby authorities if configured

            socket.emit('sos:confirmed', {
              message: 'Emergency services have been notified',
            });

            logger.warn(`SOS triggered for ride ${rideId}`);
          }
        } catch (error) {
          logger.error('Error handling SOS:', error);
        }
      });
    }

    // ==========================================
    // CHAT EVENTS (Both user and captain)
    // ==========================================
    socket.on('chat:message', async (data) => {
      try {
        const { rideId, message, timestamp } = data;

        const ride = await Ride.findById(rideId);
        if (!ride) return;

        const recipientId =
          userType === 'user'
            ? ride.captain?.toString()
            : ride.user?.toString();

        if (recipientId) {
          io.to(recipientId).emit('chat:message', {
            rideId,
            message,
            sender: userType,
            senderId: userId,
            timestamp: timestamp || new Date().toISOString(),
          });
        }
      } catch (error) {
        logger.error('Error sending chat message:', error);
      }
    });

    socket.on('chat:typing', (data) => {
      const { rideId, isTyping } = data;
      // Broadcast typing status to the other party
      socket.to(rideId).emit('chat:typing', {
        rideId,
        userId,
        userType,
        isTyping,
      });
    });

    // ==========================================
    // COMMON EVENTS
    // ==========================================
    
    // Ping/Pong for connection health
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });

    // Join ride room
    socket.on('ride:join', (data) => {
      const { rideId } = data;
      socket.join(`ride:${rideId}`);
      logger.info(`${userType} ${userId} joined ride room: ${rideId}`);
    });

    // Leave ride room
    socket.on('ride:leave', (data) => {
      const { rideId } = data;
      socket.leave(`ride:${rideId}`);
      logger.info(`${userType} ${userId} left ride room: ${rideId}`);
    });

    // ==========================================
    // DISCONNECT HANDLER
    // ==========================================
    socket.on('disconnect', async (reason) => {
      logger.info(`Socket disconnected: ${userId} (${userType}) - Reason: ${reason}`);

      // Remove from active connections
      if (userType === 'user') {
        activeConnections.users.delete(userId);
      } else if (userType === 'captain') {
        activeConnections.captains.delete(userId);

        // Optionally mark captain as offline after disconnect
        // You might want to add a delay or handle reconnection logic
        try {
          await Captain.findByIdAndUpdate(userId, {
            isOnline: false,
            lastSeen: new Date(),
          });
          await cache.del(`captain:location:${userId}`);
        } catch (error) {
          logger.error('Error updating captain status on disconnect:', error);
        }
      }
    });

    // Error handler
    socket.on('error', (error) => {
      logger.error(`Socket error for ${userId}:`, error);
    });
  });

  // ==========================================
  // ADMIN NAMESPACE (Optional)
  // ==========================================
  const adminNamespace = io.of('/admin');

  adminNamespace.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('No token provided'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.type !== 'admin') {
        return next(new Error('Not authorized'));
      }

      socket.userId = decoded.id;
      socket.userType = 'admin';
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  adminNamespace.on('connection', (socket) => {
    logger.info(`Admin connected: ${socket.userId}`);

    socket.on('disconnect', () => {
      logger.info(`Admin disconnected: ${socket.userId}`);
    });
  });

  // Store io instance globally
  global.io = io;

  logger.info('Socket.io initialized successfully');

  return io;
};

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Get socket ID for a user
 * @param {string} userId - User ID
 * @returns {string|undefined} - Socket ID if connected
 */
const getUserSocketId = (userId) => {
  return activeConnections.users.get(userId);
};

/**
 * Get socket ID for a captain
 * @param {string} captainId - Captain ID
 * @returns {string|undefined} - Socket ID if connected
 */
const getCaptainSocketId = (captainId) => {
  return activeConnections.captains.get(captainId);
};

/**
 * Emit event to a specific user
 * @param {string} userId - User ID
 * @param {string} event - Event name
 * @param {object} data - Event data
 */
const emitToUser = (userId, event, data) => {
  if (global.io) {
    global.io.to(userId).emit(event, data);
  }
};

/**
 * Emit event to a specific captain
 * @param {string} captainId - Captain ID
 * @param {string} event - Event name
 * @param {object} data - Event data
 */
const emitToCaptain = (captainId, event, data) => {
  if (global.io) {
    global.io.to(captainId).emit(event, data);
  }
};

/**
 * Emit event to all users
 * @param {string} event - Event name
 * @param {object} data - Event data
 */
const emitToAllUsers = (event, data) => {
  if (global.io) {
    global.io.to('users').emit(event, data);
  }
};

/**
 * Emit event to all captains
 * @param {string} event - Event name
 * @param {object} data - Event data
 */
const emitToAllCaptains = (event, data) => {
  if (global.io) {
    global.io.to('captains').emit(event, data);
  }
};

/**
 * Emit event to all admins
 * @param {string} event - Event name
 * @param {object} data - Event data
 */
const emitToAdmins = (event, data) => {
  if (global.io) {
    global.io.of('/admin').emit(event, data);
  }
};

/**
 * Get connection statistics
 * @returns {object} - Connection stats
 */
const getConnectionStats = () => {
  return {
    users: activeConnections.users.size,
    captains: activeConnections.captains.size,
    activeRides: activeConnections.rides.size,
  };
};

module.exports = {
  initializeSocket,
  getUserSocketId,
  getCaptainSocketId,
  emitToUser,
  emitToCaptain,
  emitToAllUsers,
  emitToAllCaptains,
  emitToAdmins,
  getConnectionStats,
};