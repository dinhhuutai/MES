import { io } from 'socket.io-client';

let socket = null;

export function getSocket() {
  if (!socket) {
    const base = process.env.REACT_APP_BASE_URL || 'http://localhost:5000';
    socket = io(base, { transports: ['websocket', 'polling'] });
  }
  return socket;
}
