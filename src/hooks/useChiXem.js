import { useSelector } from 'react-redux';
import { useLocation } from 'react-router-dom';
import { chiXemHeThong } from '../constants/modules';

export const MA_QUYEN_CHI_XEM = 'CHI_XEM';

// Câu nhắc dùng CHUNG cho mọi nút bị khóa (tooltip) — sửa 1 chỗ, đổi khắp app.
export const NHAC_CHI_XEM = 'Tài khoản chỉ xem — không thao tác được';

// Tài khoản đang ở chế độ CHỈ XEM? (mig 096)
//   · cờ `CHI_XEM` ⇒ chỉ xem MỌI màn;
//   · `HE_THONG_XEM` (30/09/2026) ⇒ chỉ xem ở TRANG HỆ THỐNG mà người đó không có quyền thật của trang
//     (xem `constants/modules.chiXemHeThong`). Ở module khác vẫn thao tác theo quyền của mình.
//
// ⚠⚠ SELECTOR PHẢI TRẢ VỀ **BOOLEAN**, không trả mảng: `useSelector` so kết quả bằng
// `===`, mà `selectPermissions` viết `s.auth.user?.permissions || []` — nhánh `|| []`
// dựng MẢNG MỚI mỗi lần chạy ⇒ dùng `usePermissions()` trong `Button` sẽ khiến **mọi
// nút trên màn re-render theo MỌI thay đổi của store** (app có 492 chỗ dùng `<Button>`).
// Trả boolean thì tham chiếu ổn định, không sinh render thừa.
//
// ⚠ Đây CHỈ là lớp trải nghiệm (khóa nút + nói lý do). Chốt chặn thật nằm ở backend
// (`middlewares/auth.js` + `utils/chiXem.js` + `middlewares/rbac.js`) — sửa được chỗ này cũng không ghi được gì.
export default function useChiXem() {
  const { pathname } = useLocation();
  return useSelector((s) => {
    const p = s.auth.user?.permissions || [];
    return p.includes(MA_QUYEN_CHI_XEM) || chiXemHeThong(pathname, p);
  });
}
