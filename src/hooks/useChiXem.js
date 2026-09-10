import { useSelector } from 'react-redux';

export const MA_QUYEN_CHI_XEM = 'CHI_XEM';

// Câu nhắc dùng CHUNG cho mọi nút bị khóa (tooltip) — sửa 1 chỗ, đổi khắp app.
export const NHAC_CHI_XEM = 'Tài khoản chỉ xem — không thao tác được';

// Tài khoản đang ở chế độ CHỈ XEM? (mig 096)
//
// ⚠⚠ SELECTOR PHẢI TRẢ VỀ **BOOLEAN**, không trả mảng: `useSelector` so kết quả bằng
// `===`, mà `selectPermissions` viết `s.auth.user?.permissions || []` — nhánh `|| []`
// dựng MẢNG MỚI mỗi lần chạy ⇒ dùng `usePermissions()` trong `Button` sẽ khiến **mọi
// nút trên màn re-render theo MỌI thay đổi của store** (app có 492 chỗ dùng `<Button>`).
// Trả boolean thì tham chiếu ổn định, không sinh render thừa.
//
// ⚠ Đây CHỈ là lớp trải nghiệm (khóa nút + nói lý do). Chốt chặn thật nằm ở backend
// (`middlewares/auth.js` + `utils/chiXem.js`) — sửa được chỗ này cũng không ghi được gì.
export default function useChiXem() {
  return useSelector((s) => (s.auth.user?.permissions || []).includes(MA_QUYEN_CHI_XEM));
}
