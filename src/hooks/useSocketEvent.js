import { useEffect, useRef } from 'react';
import { getSocket } from '../services/socket';

// Đăng ký lắng nghe 1 sự kiện socket; handler mới nhất luôn được dùng.
export default function useSocketEvent(event, handler) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const s = getSocket();
    const fn = (...args) => ref.current(...args);
    s.on(event, fn);
    return () => s.off(event, fn);
  }, [event]);
}

// Trạng thái kết nối (chấm realtime).
export function useSocketConnected() {
  const ref = useRef(false);
  const s = getSocket();
  ref.current = s.connected;
  return s;
}
