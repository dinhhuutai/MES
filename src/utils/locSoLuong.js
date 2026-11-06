// LỌC THEO SỐ LƯỢNG (06/11/2026) — GƯƠNG backend `utils/locSoLuong.js` (sửa luật thì sửa cả hai).
// Nhận: `500` · `100-500` · `500-` · `>500` · `>=500` · `<500` · `<=500` (cả `≥` `≤`); bỏ dấu chấm / phẩy / khoảng trắng
//   (`1.200` = 1200). FE chỉ dùng để BÁO ô gõ sai và KHÔNG gửi giá trị sai lên (backend gặp giá trị sai thì bỏ lọc).
export function docLocSoLuong(v) {
  const s = String(v == null ? '' : v)
    .replace(/[\s.,]/g, '').replace(/[–—~]/g, '-').replace(/≥/g, '>=').replace(/≤/g, '<=');
  if (!s) return null;
  let m = /^(\d{1,9})$/.exec(s);
  if (m) return { tu: Number(m[1]), den: Number(m[1]) };
  m = /^(\d{1,9})-(\d{1,9})$/.exec(s);
  if (m) {
    const a = Number(m[1]); const b = Number(m[2]);
    return { tu: Math.min(a, b), den: Math.max(a, b) };
  }
  m = /^(\d{1,9})-$/.exec(s);
  if (m) return { tu: Number(m[1]), den: null };
  m = /^(>=|>|<=|<)(\d{1,9})$/.exec(s);
  if (m) {
    const n = Number(m[2]);
    if (m[1] === '>') return { tu: n + 1, den: null };
    if (m[1] === '>=') return { tu: n, den: null };
    if (m[1] === '<') return { tu: null, den: n - 1 };
    return { tu: null, den: n };
  }
  return null;
}

export const GOI_Y_SO_LUONG = 'vd 500 · 100-500 · >500';

// Câu báo dưới ô lọc (FieldFilters `kiem`): rỗng hoặc đúng dạng ⇒ ''.
export const loiLocSoLuong = (v) => (String(v || '').trim() && !docLocSoLuong(v)
  ? 'Gõ 500 · 100-500 · >500 · <=500' : '');

// Giá trị gửi lên server: sai dạng ⇒ bỏ (không lọc), không gửi chuỗi rác.
export const soLuongGui = (v) => (docLocSoLuong(v) ? String(v).trim() : '');
