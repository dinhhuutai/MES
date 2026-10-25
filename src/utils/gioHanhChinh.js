// GIỜ HÀNH CHÍNH 07:30 → 16:30 giờ VN — gương BE `backend/src/utils/gioHanhChinh.js` (sửa cả hai).
// Test Run: NGOÀI giờ này nút "QA xác nhận đạt" / "Xác nhận In Không Đạt" kiêm luôn Release 2 (BE tự kiểm lại giờ).
const BD_PHUT = 7 * 60 + 30;
const KT_PHUT = 16 * 60 + 30;

export function trongGioHanhChinh(d = new Date()) {
  const vn = new Date(new Date(d).getTime() + 7 * 3600 * 1000);
  const p = vn.getUTCHours() * 60 + vn.getUTCMinutes();
  return p >= BD_PHUT && p < KT_PHUT;
}
