import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getSocket } from '../services/socket';
import { logout } from '../store/authSlice';

// Đọc claim `jti` (mã phiên) trong JWT — chỉ để so với sự kiện đăng xuất từ xa, KHÔNG dùng để
// xác thực (xác thực luôn do backend làm, token chỉ đọc chứ không tin).
// ⚠ Payload JWT là base64url ⇒ phải đổi `-`/`_` về `+`/`/` trước khi `atob`, và bọc try/catch:
//   token cũ / token lạ không được làm sập app.
function jtiCuaToken(token) {
  try {
    const p = String(token || '').split('.')[1];
    if (!p) return null;
    const json = atob(p.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json).jti || null;
  } catch { return null; }
}

// BỊ ĐĂNG XUẤT TỪ XA (mig 081) → về màn đăng nhập NGAY, không phải chờ tới request kế tiếp.
//
// ⚠ Đây chỉ là đường "cho nhanh". Chốt chặn THẬT nằm ở backend: token của phiên đã đăng xuất bị trả
//   401 ⇒ `axiosClient` tự dispatch logout. Nhờ vậy máy đang TẮT / mất mạng lúc bị đăng xuất vẫn bị
//   chặn khi mở lại — đừng bỏ lớp backend đi mà chỉ dựa vào socket.
export default function useBiDangXuat() {
  const dispatch = useDispatch();
  const token = useSelector((s) => s.auth?.token);
  const userId = useSelector((s) => s.auth?.user?.id);

  useEffect(() => {
    if (!token || !userId) return undefined;
    const socket = getSocket();
    const jti = jtiCuaToken(token);

    const onDangXuat = (p = {}) => {
      if (p.userId !== userId) return;
      // Sự kiện KHÔNG kèm jti = "đăng xuất mọi thiết bị" của tài khoản này ⇒ áp cho cả token cũ.
      if (p.jti && jti && p.jti !== jti) return;
      dispatch(logout());
    };

    socket.on('phien:dang-xuat', onDangXuat);
    return () => socket.off('phien:dang-xuat', onDangXuat);
  }, [token, userId, dispatch]);
}
