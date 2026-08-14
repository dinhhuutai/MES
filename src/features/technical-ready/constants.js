// ─── MỤC KỸ THUẬT READY THEO KHÁCH HÀNG ──────────────────────────────────────
// Gương của `backend/src/utils/tech.js` — **sửa luật phải sửa CẢ HAI**, nếu không giao diện và
// backend hiểu khác nhau (BE chặn nhưng FE vẫn cho bấm, hoặc ngược lại).
//
// LUẬT (chốt 2026-08-14):
//   · Khách THƯỜNG           → hiện **Khuôn + Film + Mực**, nhưng xác nhận Khuôn thì Film TỰ ĐẠT
//                               theo (backend làm) ⇒ chỉ cần bấm Khuôn + Mực. Film vẫn hiện để
//                               nhìn thấy trạng thái, vẫn bấm riêng được.
//   · Khách HÀNG GIA CÔNG    → **ẨN cả Khuôn LẪN Film**, chỉ còn **Mực**. Nhóm này không làm khuôn,
//     (`KHUON_OPTIONAL_KH`)     mà Film nay đi theo Khuôn nên giữ lại thì họ mắc kẹt vĩnh viễn.
export const KHUON_OPTIONAL_KH = ['II', 'AD'];

const laGiaCong = (tenKhach) => KHUON_OPTIONAL_KH.includes(String(tenKhach || '').trim());

// Hàng gia công (miễn cả Khuôn lẫn Film).
export const laHangGiaCong = laGiaCong;

export const khuonRequired = (tenKhach) => !laGiaCong(tenKhach);

// Có HIỆN mục/cột Film cho khách này không. (Khác `khuonRequired` về ý nghĩa nhưng hiện cùng điều
// kiện — tách tên riêng để sau này đổi luật một bên không phải sửa nhầm bên kia.)
export const filmHien = (tenKhach) => !laGiaCong(tenKhach);

// Số mục kỹ thuật PHẢI BẤM của khách này (dựng nhãn "x/N"): gia công 1 (Mực) · còn lại 2 (Khuôn+Mực).
// ⚠ Film KHÔNG tính vào N — nó tự đạt theo Khuôn, đếm vào thì nhãn không bao giờ tới N.
export const soMucKtCan = (tenKhach) => (laGiaCong(tenKhach) ? 1 : 2);
