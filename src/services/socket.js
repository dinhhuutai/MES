import { io } from 'socket.io-client';

let socket = null;

export function getSocket() {
  if (!socket) {
    const base = process.env.REACT_APP_BASE_URL || 'http://localhost:5000';
    socket = io(base, {
      // CHỈ dùng polling + KHÔNG nâng cấp WebSocket. Reverse proxy api-mes hiện không cho WS upgrade
      // (wss://.../socket.io/ fail) → ép polling cho chạy ổn định qua HTTPS. Khi nào proxy bật WebSocket
      // (config Upgrade/Connection) thì đổi lại transports: ['polling','websocket'] để nhẹ hơn.
      transports: ['polling'],
      upgrade: false,
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });
    if (process.env.NODE_ENV !== 'production') {
      socket.on('connect', () => console.log('[socket] connected', socket.id));
      socket.on('connect_error', (e) => console.warn('[socket] connect_error', e.message));
    }
  }
  return socket;
}
