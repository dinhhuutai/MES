import { createContext, useContext, useEffect } from 'react';
import { createPortal } from 'react-dom';

// ─────────────────────────────────────────────────────────────────────────────
// KHE HÀNG ĐẦU (29/10/2026, người dùng: trang Xác nhận chạy đưa ô tìm + nút "Chờ chạy" + "Danh sách & theo dõi" lên
// THẲNG HÀNG dải sĩ số "Theo dõi"). Hàng đó do `ModuleLayout` vẽ (breadcrumb · dải sĩ số) — trang bọc phần muốn đưa lên
// bằng `<HangDau>…</HangDau>`, nội dung được portal vào khe nằm giữa breadcrumb và dải sĩ số. Khi có trang dùng khe,
// `ModuleLayout` thu gọn hàng (ẩn breadcrumb dưới 2xl, bớt đệm) để nhường chỗ.
// Trang render ngoài `ModuleLayout` (không có khe) ⇒ nội dung hiện tại chỗ như thường.
// ─────────────────────────────────────────────────────────────────────────────
export const HangDauContext = createContext(null); // { khe: HTMLElement | null, setDung: (fn) => void }

export default function HangDau({ children }) {
  const ctx = useContext(HangDauContext);
  const setDung = ctx ? ctx.setDung : null;
  useEffect(() => {
    if (!setDung) return undefined;
    setDung((n) => n + 1);
    return () => setDung((n) => n - 1);
  }, [setDung]);
  if (!ctx) return children;
  return ctx.khe ? createPortal(children, ctx.khe) : null;
}
