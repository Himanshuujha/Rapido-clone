// src/hooks/useSocket.js
import { useSocket as useSocketContext } from '../context/SocketContext';

/**
 * Simple wrapper around SocketContext hook.
 * SocketContext.jsx should export `useSocket`.
 *
 * Returns: { socket, isConnected }
 */
const useSocket = () => {
  return useSocketContext();
};

export default useSocket;