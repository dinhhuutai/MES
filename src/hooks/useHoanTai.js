import { useCallback, useEffect, useRef } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// HOÃN TẢI LẠI NGẦM TRONG LÚC MỞ MODAL NHẬP NHIỀU TEM (09/11/2026 — người dùng báo bảng "Tích tem" KCS "xoay và chậm").
//
//   const taiNgam = useHoanTai(tichTemOpen || nhieuOpen, () => load(true));
//   useSocketReload([...], taiNgam);   // + vòng tự làm mới định kỳ
//   // lưu xong: gọi taiNgam() rồi đóng modal ⇒ đóng xong tải ĐÚNG 1 lần
//
// Vì sao: mỗi tem lưu xong backend bắn `quality:updated` ⇒ trang tải lại CẢ danh sách (KCS prod 09/11: 1.981 tem, mỗi lần
//   ~1 s ở máy chủ + vài MB JSON) — 1 lượt xác nhận 10 tem kéo 3 lần, tranh luồng chính với chính modal đang lưu. Trong lúc
//   modal mở thì bảng phía sau bị che, tải cũng vô ích. Đang mở ⇒ chỉ ĐÁNH DẤU "nợ 1 lần tải"; đóng ⇒ trả nợ NGAY.
// Sau lần trả nợ, mọi lời gọi trong `NGHI_MS` bị bỏ: sự kiện socket của tem cuối thường tới SAU khi modal đã đóng (gộp 400 ms
//   ở `useSocketReload`, đường polling còn trễ hơn) ⇒ không tải lần 2. Thay đổi của người khác trong khoảng đó vẫn được bắt ở
//   sự kiện kế tiếp / vòng làm mới định kỳ của trang.
// ⚠ Hàm trả về ỔN ĐỊNH (đọc `tai` mới nhất qua ref) ⇒ đưa vào deps không làm effect chạy lại.
// ─────────────────────────────────────────────────────────────────────────────
const NGHI_MS = 1500;

export default function useHoanTai(dangMo, tai) {
  const ref = useRef({ dangMo, tai, no: false, lucTra: 0 });
  ref.current.dangMo = dangMo;
  ref.current.tai = tai;

  useEffect(() => {
    if (!dangMo && ref.current.no) {
      ref.current.no = false;
      ref.current.lucTra = Date.now();
      ref.current.tai();
    }
  }, [dangMo]);

  return useCallback(() => {
    const x = ref.current;
    if (x.dangMo) { x.no = true; return; }
    if (Date.now() - x.lucTra < NGHI_MS) return; // vừa trả nợ lúc đóng modal ⇒ gộp
    x.tai();
  }, []);
}
