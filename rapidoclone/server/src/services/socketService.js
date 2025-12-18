let io = null;

const initSocketService = (ioInstance) => {
  io = ioInstance;
  console.log('✅ SocketService initialized');
};

const emitToUser = (userId, event, payload = {}) => {
  if (!io || !userId) return;
  io.to(`user:${userId}`).emit(event, payload);
};

const emitToCaptain = (captainId, event, payload = {}) => {
  if (!io || !captainId) return;
  io.to(`captain:${captainId}`).emit(event, payload);
};

module.exports = {
  initSocketService,
  emitToUser,
  emitToCaptain,
};
