// ─── MỤC KỸ THUẬT READY THEO KHÁCH HÀNG + TÍNH CHẤT IN ───────────────────────
// Gương của `backend/src/utils/tech.js` (`ktCan`) — **sửa luật phải sửa CẢ HAI**, nếu không giao diện và
// backend hiểu khác nhau (BE chặn nhưng FE vẫn cho bấm, hoặc ngược lại).
//
// LUẬT (chốt 2026-08-14 + 16/11/2026):
//   · Khách THƯỜNG           → hiện **Khuôn + Film + Mực**, nhưng xác nhận Khuôn thì Film TỰ ĐẠT
//                               theo (backend làm) ⇒ chỉ cần bấm Khuôn + Mực. Film vẫn hiện để
//                               nhìn thấy trạng thái, vẫn bấm riêng được.
//   · Khách HÀNG GIA CÔNG    → **ẨN cả Khuôn LẪN Film**, chỉ còn **Mực**. Nhóm này không làm khuôn,
//     (`KHUON_OPTIONAL_KH`)     mà Film nay đi theo Khuôn nên giữ lại thì họ mắc kẹt vĩnh viễn.
//   · CÔNG ĐOẠN ÉP/LOGO (16/11/2026, mig 133) → KHÔNG có Film; Khuôn / Mực theo cấu hình của tính chất in
//     (`kt_yc` backend trả theo dòng: KHUON_MUC · KHUON · MUC · KHONG — KHONG = không qua KT). `kt_ep` = dòng ép/logo.
// Các hàm nhận DÒNG (có `ten_khach_hang`, `kt_yc`, `kt_ep`) hoặc chuỗi tên khách (luật cũ).
export const KHUON_OPTIONAL_KH = ['II', 'AD'];

const laGiaCong = (tenKhach) => KHUON_OPTIONAL_KH.includes(String(tenKhach || '').trim());
const tachDong = (x) => (x && typeof x === 'object'
  ? { ten: x.ten_khach_hang, yc: x.kt_yc || 'KHUON_MUC', ep: !!x.kt_ep }
  : { ten: x, yc: 'KHUON_MUC', ep: false });

// Hàng gia công (miễn cả Khuôn lẫn Film).
export const laHangGiaCong = laGiaCong;

export const khuonRequired = (x) => {
  const d = tachDong(x);
  return !laGiaCong(d.ten) && (d.yc === 'KHUON_MUC' || d.yc === 'KHUON');
};

export const mucRequired = (x) => {
  const { yc } = tachDong(x);
  return yc === 'KHUON_MUC' || yc === 'MUC';
};

// Có HIỆN mục/cột Film không: cần Khuôn và KHÔNG phải công đoạn Ép/Logo.
export const filmHien = (x) => khuonRequired(x) && !tachDong(x).ep;

// Công đoạn Ép/Logo phải "Xác nhận HSKT" (mig 134 — BE `utils/tech.js ktHsktSql`, dòng trả `kt_hskt`; tính chất in bật +
//   công tắc tổng Cài đặt tính năng). Chuỗi tên khách (luật cũ) ⇒ không.
export const hsktRequired = (x) => !!(x && typeof x === 'object' && x.kt_hskt);

// Số mục kỹ thuật PHẢI BẤM (dựng nhãn "x/N"). ⚠ Film KHÔNG tính vào N — nó tự đạt theo Khuôn.
export const soMucKtCan = (x) => (khuonRequired(x) ? 1 : 0) + (mucRequired(x) ? 1 : 0) + (hsktRequired(x) ? 1 : 0);

// Nhãn yêu cầu KT của công đoạn Ép/Logo (trang Tính chất in + badge).
export const NHAN_KT_YC = {
  KHUON_MUC: 'Khuôn + Mực',
  KHUON: 'Chỉ Khuôn',
  MUC: 'Chỉ Mực',
  KHONG: 'Không qua KT',
};
