// Khách hàng KHÔNG bắt buộc xác nhận Khuôn ở READY (READY xong = Film + Mực).
// Đồng bộ với backend/src/utils/tech.js (KHUON_OPTIONAL_KH). Khớp theo ten_khach_hang.
export const KHUON_OPTIONAL_KH = ['II', 'AD'];

export const khuonRequired = (tenKhach) =>
  !KHUON_OPTIONAL_KH.includes(String(tenKhach || '').trim());
