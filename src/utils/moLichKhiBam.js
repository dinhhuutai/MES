// Ô chọn ngày gốc của trình duyệt (`<input type="date">`): Chrome/Edge chỉ mở lịch khi bấm ĐÚNG icon cuốn lịch sát mép
// phải, bấm vào phần còn lại của ô thì không có gì xảy ra (03/11/2026, người dùng: "thao tác không tiện").
// Gắn 1 bộ nghe ở mức TÀI LIỆU thay vì sửa từng ô: phủ mọi ô hiện có (~40 ô, cả `<input>` thuần lẫn `Input`) và ô thêm sau.
//   · Pha BẮT (capture) ⇒ vẫn chạy khi ô nằm trong bảng / modal có `stopPropagation`.
//   · `detail === 0` là click do mã gọi (`.click()`) ⇒ bỏ. Bấm chữ nhãn `<label>` bọc ô cũng mở lịch — cố ý, nhãn là 1 phần của ô.
//   · `showPicker` phải gọi trong cú bấm; trình duyệt cũ không có hàm / từ chối thì ô vẫn dùng như thường (không báo lỗi).
//   · Tab vào ô rồi gõ số vẫn nhập được (đi bàn phím không qua click).
const LOAI_CO_LICH = new Set(['date', 'datetime-local', 'month', 'week']);

export function moLichKhiBam(e) {
  const o = e.target;
  if (!o || o.tagName !== 'INPUT' || !LOAI_CO_LICH.has(o.type)) return;
  if (e.detail === 0 || o.disabled || o.readOnly) return;
  try { if (o.showPicker) o.showPicker(); } catch { /* trình duyệt không cho mở ⇒ ô vẫn như cũ */ }
}

export function batMoLichKhiBam() {
  document.addEventListener('click', moLichKhiBam, true);
}
