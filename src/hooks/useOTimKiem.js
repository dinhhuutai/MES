import { useCallback, useEffect, useRef } from 'react';

// ─── Ô TÌM KIẾM "QUÉT LIÊN TỤC" (02/10/2026) ───────────────────────────────────────────────
// Màn KCS · Phân loại lỗi · Sửa · OQC: người kiểm cầm đầu đọc mã vạch USB, quét mã tem vào ô tìm kiếm
// trên Toolbar → mở tem → xác nhận → quét tem kế. Người dùng chốt:
//   · vào trang là con trỏ nằm sẵn trong ô tìm kiếm;
//   · xác nhận xong thì ô được XÓA và con trỏ quay lại ô (bên gọi tự xóa giá trị, rồi gọi `datConTro()`).
// Dùng: `const oTim = useOTimKiem();` → `<Toolbar searchRef={oTim.ref} …/>` → sau khi lưu: `oTim.datConTro()`.
//
// ⚠ Máy CẢM ỨNG (điện thoại / máy tính bảng) KHÔNG tự đặt con trỏ: focus là bật bàn phím ảo che nửa
//   màn hình, mà trên điện thoại người dùng quét bằng camera (nút "Quét QR"). Cùng luật `IS_TOUCH` của
//   `ScanCollectModal`.
// ⚠ Đóng SidePanel/Modal (Headless UI) xong, thư viện TRẢ focus về nút đã mở nó — xảy ra SAU lúc bên gọi
//   đổi state ⇒ đặt con trỏ ở vài nhịp (0 · 150 · 400ms), nhịp nào còn hộp thoại đang mở thì bỏ qua.
// ⚠ Không giành con trỏ khi người dùng đang gõ ở ô nhập KHÁC (ô lọc, ô ngày…) — chỉ lấy lại từ nút /
//   nền trang (chỗ Headless UI trả focus về).
const LA_CAM_UNG = typeof window !== 'undefined' && window.matchMedia
  ? window.matchMedia('(pointer: coarse)').matches : false;

const KHONG_PHAI_O_GO = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file']);
const dangGoOKhac = (el, oTim) => {
  if (!el || el === oTim || el === document.body) return false;
  if (el.isContentEditable || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return true;
  return el.tagName === 'INPUT' && !KHONG_PHAI_O_GO.has(String(el.type || '').toLowerCase());
};

export default function useOTimKiem({ tuFocus = true } = {}) {
  const ref = useRef(null);
  const hen = useRef([]);

  const datConTro = useCallback(() => {
    if (LA_CAM_UNG) return;
    const lam = () => {
      const el = ref.current;
      if (!el || el.disabled || !el.isConnected) return;
      if (document.querySelector('[role="dialog"]')) return;   // panel/modal chưa đóng hẳn
      const dang = document.activeElement;
      if (dang === el || dangGoOKhac(dang, el)) return;
      try { el.focus({ preventScroll: true }); } catch (_) { el.focus(); }
    };
    hen.current.forEach(clearTimeout);
    hen.current = [0, 150, 400].map((ms) => setTimeout(lam, ms));
  }, []);

  useEffect(() => { if (tuFocus) datConTro(); }, [tuFocus, datConTro]);
  useEffect(() => () => hen.current.forEach(clearTimeout), []);

  return { ref, datConTro };
}
