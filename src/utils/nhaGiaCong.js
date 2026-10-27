// NHÀ GIA CÔNG CỦA ĐỢT VẢI (ERP NGC) — khóa so sánh khi gom số lượng. Gương BE `backend/src/utils/nhaGiaCong.js`.
// 27/10/2026 (người dùng chốt): 1 phần in có 2 đợt của 2 nhà gia công khác nhau thì KHÔNG cộng số lượng lại.
export const khoaNgc = (v) => String(v == null ? '' : v).trim().replace(/\s+/g, ' ').toUpperCase();

// Khóa NGC của 1 dòng lệnh: BE trả `ngc_khoa` (các NGC khác nhau của lệnh, ngăn '|'); BE cũ thì lùi `nha_gia_cong`.
export const khoaNgcLenh = (r) => (r && r.ngc_khoa != null
  ? String(r.ngc_khoa)
  : String((r && r.nha_gia_cong) || '').split(',').map(khoaNgc).filter(Boolean).sort().join('|'));
