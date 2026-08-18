import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// KÊNH NỐI "BỘ LỌC CỦA TRANG" → DẢI "THEO DÕI" (sĩ số checkpoint).
//
// ⚠⚠ VÌ SAO PHẢI CÓ CONTEXT: `SiSoTram` render ở `components/layout/ModuleLayout.js` (hàng
//   breadcrumb), tức là NGOÀI trang — nó không thấy được state bộ lọc nằm trong trang. Không có
//   kênh này thì 4 con số luôn là của TOÀN TRẠM trong khi bảng bên dưới đang lọc ⇒ 2 con số trên
//   cùng màn hình đá nhau, đúng cái người dùng phàn nàn.
//
// CÁCH DÙNG (ở trang):
//   useSiSoLoc({ timKiem: search, khach: filters.khach, loaiChuyen: chipLoai, ... });
// Trang KHÔNG khai gì ⇒ dải "Theo dõi" chạy y như cũ (toàn trạm) — an toàn cho màn chưa nối.
//
// ⚠ KHÓA HỢP LỆ (khớp `LOC_TRANG_KEYS` ở `backend/src/modules/siso/siso.service.js`):
//   timKiem · khach · don · maHang · codePhan · mauVai · kichVai · kichPhim · chuyen · nhaGiaCong
//   · loaiNgay/ngayTu/ngayDen · phuongAnIn · loaiChuyen · maChuyen
//   Sai tên khóa thì backend BỎ QUA IM LẶNG (không lỗi) ⇒ dải số không nhúc nhích. Nhớ đối chiếu.
// ─────────────────────────────────────────────────────────────────────────────

const SiSoLocContext = createContext(null);

export function SiSoLocProvider({ children }) {
  const [loc, setLoc] = useState(null);
  const giaTri = useMemo(() => ({ loc, setLoc }), [loc]);
  return <SiSoLocContext.Provider value={giaTri}>{children}</SiSoLocContext.Provider>;
}

// Dải "Theo dõi" đọc bộ lọc trang đang công bố (null = trang không nối ⇒ đếm toàn trạm).
export function useSiSoLocHienTai() {
  const ctx = useContext(SiSoLocContext);
  return ctx ? ctx.loc : null;
}

// Trang gọi hook này để CÔNG BỐ bộ lọc của mình.
export default function useSiSoLoc(loc) {
  const ctx = useContext(SiSoLocContext);
  const setLoc = ctx && ctx.setLoc;

  // ⚠⚠ SO SÁNH BẰNG CHUỖI JSON, KHÔNG đưa thẳng object vào deps: trang dựng object mới ở MỖI lần
  //   render (`{ timKiem: search, ... }` là literal) ⇒ để nguyên vào deps thì effect chạy mỗi
  //   render → `setLoc` → cha render lại → vòng lặp vô hạn. Đây đúng bẫy deps đã ghi ở §9
  //   (ca `useToast()` làm bắn request tới `ERR_INSUFFICIENT_RESOURCES`).
  // ⚠ Bỏ khóa rỗng TRƯỚC khi so chuỗi: `{khach: ''}` và `{}` phải coi là MỘT, nếu không mỗi lần
  //   người dùng xóa trắng ô lọc lại tính là "đổi" và bắn thêm 1 lượt tải.
  const goi = JSON.stringify(
    Object.entries(loc || {})
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .sort(([a], [b]) => (a < b ? -1 : 1))
  );

  // Giữ hàm setter trong ref để không phải đưa `ctx` vào deps (ctx đổi mỗi lần `loc` đổi).
  const setRef = useRef(setLoc);
  setRef.current = setLoc;

  useEffect(() => {
    const f = setRef.current;
    if (!f) return undefined;
    f(goi ? Object.fromEntries(JSON.parse(goi)) : {});
    // ⚠ DỌN KHI RỜI TRANG: không dọn thì sang màn khác dải "Theo dõi" vẫn dính bộ lọc của màn cũ
    //   — số sai mà không có gì trên giao diện giải thích vì sao.
    return () => f(null);
  }, [goi]);
}
