// THỢ IN HIỆN Ở BÁO CÁO / EXCEL SẢN XUẤT (11/10/2026, người dùng chốt) — gương backend `utils/thoIn.js`:
//   · Chuyền MÁY (MTD) ⇒ lấy tên CHUYỀN TRƯỞNG của phiếu (máy in tự động không phân thợ in từng người);
//     phiếu chưa nhập chuyền trưởng thì lùi về thợ in.
//   · Loại chuyền khác (Bàn · Robot · Máy tròn · Logo · Ép…) ⇒ thợ in PHÂN CÔNG lúc chạy → thợ in KẾ HOẠCH
//     (chọn lúc Release 1, mig 111) → chuyền trưởng.
// Nhận dòng có `ma_loai_chuyen` · `tho_in` · `tho_in_kh` · `chuyen_truong` (thiếu trường nào coi như trống).
const sach = (v) => String(v == null ? '' : v).trim();

export const laChuyenMay = (r) => sach(r && r.ma_loai_chuyen).toUpperCase() === 'MAY';

export function thoInHienThi(r) {
  if (!r) return '';
  const tho = sach(r.tho_in) || sach(r.tho_in_kh);
  const chuyenTruong = sach(r.chuyen_truong);
  return laChuyenMay(r) ? (chuyenTruong || tho) : (tho || chuyenTruong);
}

// Tách chuỗi "A, B" thành từng người (khử trùng không phân biệt hoa thường) — báo cáo theo thợ in chia theo người.
export function tachTho(v) {
  const daCo = new Set();
  return sach(v).split(',').map((s) => s.replace(/\s+/g, ' ').trim()).filter((s) => {
    const k = s.toLowerCase();
    if (!s || daCo.has(k)) return false;
    daCo.add(k);
    return true;
  });
}
