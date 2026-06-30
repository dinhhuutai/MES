import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { getSocket } from '../services/socket';
import { MODULES } from '../constants/modules';

// Tên trang thân thiện từ path (khớp menu trong MODULES).
export function titleFor(pathname) {
  for (const m of MODULES) {
    for (const c of m.children || []) {
      if (c.route === pathname) return `${m.ten} · ${c.ten}`;
    }
  }
  if (pathname === '/') return 'Trang chủ (Portal)';
  if (pathname === '/thong-tin-ca-nhan') return 'Thông tin cá nhân';
  return pathname;
}

// Báo cho server: user đang online + đang ở trang nào (ghi lịch sử điều hướng).
export default function usePresenceTracker() {
  const location = useLocation();
  const token = useSelector((s) => s.auth.token);
  const user = useSelector((s) => s.auth.user);
  const hoTen = user?.hoTen || user?.ho_ten || user?.ten_dang_nhap;

  const locRef = useRef(location.pathname);
  locRef.current = location.pathname;
  const lastPathRef = useRef(null);

  // Xác thực lại khi (re)connect hoặc khi đăng nhập.
  useEffect(() => {
    if (!token) { lastPathRef.current = null; return undefined; }
    const s = getSocket();
    const sendHello = () => {
      const path = locRef.current;
      s.emit('presence:hello', { token, path, title: titleFor(path), hoTen });
      lastPathRef.current = path; // hello đã ghi nav cho trang này
    };
    if (s.connected) sendHello();
    s.on('connect', sendHello);
    return () => s.off('connect', sendHello);
  }, [token, hoTen]);

  // Đổi trang.
  useEffect(() => {
    if (!token) return;
    const path = location.pathname;
    if (lastPathRef.current === path) return; // đã ghi qua hello
    getSocket().emit('presence:page', { path, title: titleFor(path) });
    lastPathRef.current = path;
  }, [location.pathname, token]);
}
