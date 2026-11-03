import { io } from 'socket.io-client';

let socket = null;

export function getSocket() {
  if (!socket) {
    const base = process.env.REACT_APP_BASE_URL || 'http://localhost:5000';
    socket = io(base, {
      // Bắt đầu bằng polling rồi nâng lên WebSocket (03/11/2026: IIS ARR đã trả 101). Mạng / proxy nào chặn WebSocket thì
      // lượt nâng cấp hỏng và socket vẫn chạy polling như trước, không ảnh hưởng người dùng.
      transports: ['polling', 'websocket'],
      upgrade: true,
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
