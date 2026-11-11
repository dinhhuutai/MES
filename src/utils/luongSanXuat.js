// ─────────────────────────────────────────────────────────────────────────────
// LUỒNG SẢN XUẤT THEO TÍNH CHẤT IN (mig 126) — GƯƠNG của backend `utils/luongSanXuat.js` (sửa luật thì sửa cả hai).
//   · `luong_sx` của phần in: THUONG · IN_KIENG · IN_EP · LOGO · KIENG_KHONG_EP (in kiếng đã bỏ ép — 1 công đoạn,
//     tem vẫn nhập kiếng).
//   · Phần in 2 công đoạn (IN_KIENG / IN_EP) ⇒ lệnh / dòng Kế hoạch có `giai_doan` 'IN' hoặc 'EP_UI' (ép ủi).
//   · Bỏ 1 công đoạn (Quản trị phần in): bỏ In ⇒ Logo · bỏ Ép ⇒ In kiếng (không ép) / In thường — `luongSauKhiBo`.
// ─────────────────────────────────────────────────────────────────────────────
export const GD_IN = 'IN';
export const GD_EP = 'EP_UI';

export const LUONG_SX = [
  { ma: 'THUONG', ten: 'In thường' },
  { ma: 'IN_KIENG', ten: 'In kiếng' },
  { ma: 'IN_EP', ten: 'In + ép' },
  { ma: 'LOGO', ten: 'Logo' },
  { ma: 'KIENG_KHONG_EP', ten: 'In kiếng (không ép)' },
];

export const laHaiCongDoan = (luong) => luong === 'IN_KIENG' || luong === 'IN_EP';
export const laLogo = (luong) => luong === 'LOGO';
export const laKieng = (luong) => luong === 'IN_KIENG' || luong === 'KIENG_KHONG_EP';
export function luongSauKhiBo(luong, bo) {
  if (!laHaiCongDoan(luong)) return null;
  if (bo !== GD_EP) return 'LOGO';
  return luong === 'IN_KIENG' ? 'KIENG_KHONG_EP' : 'THUONG';
}
export const chuanGd = (gd) => (gd === GD_EP ? GD_EP : GD_IN);
export const laEp = (r) => chuanGd(r && r.giai_doan) === GD_EP;
// Dòng ép ủi của đợt CHƯA Ready mà chưa lưu được Kế hoạch tạm (BE chưa chạy mig 128 ⇒ không gắn `ep_tam_duoc`) — khóa
//   ô chọn ở Release 1 / Gom đợt vải. Có mig 128 ⇒ dòng ép chưa Ready lưu Kế hoạch tạm như dòng in.
export const epChoLapSau = (r) => laEp(r) && !r.qc_done && !r.ep_tam_duoc;

// Nhãn công đoạn — null với phần in 1 công đoạn (không vẽ badge).
export function nhanCongDoan(luong, gd) {
  if (!laHaiCongDoan(luong)) return null;
  if (chuanGd(gd) === GD_EP) return 'Ép ủi';
  return luong === 'IN_KIENG' ? 'In kiếng' : 'In';
}

export const tenLuong = (luong) => (LUONG_SX.find((l) => l.ma === luong) || LUONG_SX[0]).ten;

// Khóa so sánh "cùng công đoạn" khi gom dòng / gộp lệnh — lệnh in và lệnh ép ủi KHÔNG BAO GIỜ gom chung.
export const khoaCongDoan = (r) => chuanGd(r && r.giai_doan);
