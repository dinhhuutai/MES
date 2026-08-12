// Định dạng số / tiền / ngày theo vi-VN.
export const fmtNum = (n) =>
  n === null || n === undefined || n === '' ? '—' : Number(n).toLocaleString('vi-VN');

export const fmtCurrency = (n) =>
  n === null || n === undefined || n === '' ? '—' : Number(n).toLocaleString('vi-VN') + ' ₫';

export const fmtDate = (d) => {
  if (!d) return '—';
  const date = new Date(d);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('vi-VN');
};

// Đưa mã vừa quét về ĐÚNG `ma_tem` đang lưu trong bảng `tem`, để tra cứu (QR mã hóa cả tiền tố công đoạn).
// Xử được CẢ HAI định dạng (xem `printTemLabel.js` → temCode):
//   · '162608057689'   → '152608057689'  — barcode ERP 12 số: mọi công đoạn quy về tiền tố gốc `15`
//   · '172608057689-2' → '152608057689'  — bỏ luôn hậu tố lần giao
//   · '15-TEM00123'    → 'TEM00123'      — mã cũ
//   · '17-TEM00030-1'  → 'TEM00030'
// ⚠ Bản backend gương y hệt ở `backend/src/utils/temPrefix.js` — sửa luật thì sửa CẢ HAI.
const MA_TEM_ERP_RE = /^1[3-9]\d{10}$/;
export const baseMaTem = (code) => {
  const c = String(code || '').trim().replace(/-\d+$/, '');
  return MA_TEM_ERP_RE.test(c) ? `15${c.slice(2)}` : c.replace(/^\d+-/, '');
};

// Chiều NGƯỢC của `baseMaTem`: mã gốc + TIỀN TỐ CÔNG ĐOẠN (+ hậu tố lần giao).
// Tiền tố: 13 = hàng gia công về · 15 = KCS đạt · 16 = sửa · 17 = OQC/giao.
//   · mã ERP 12 số → THAY 2 số đầu   : temCode('152608057689', 16) → '162608057689'
//   · mã cũ TEM… → nối bằng gạch     : temCode('TEM00123', 16)     → '16-TEM00123'
// ⚠ Đặt ở đây (KHÔNG ở `printTemLabel.js`) để màn danh sách dùng được mà không phải nạp
//   thư viện `qrcode` + bộ render tem; `printTemLabel.js` re-export lại hàm này.
// ⚠ Bản backend gương y hệt ở `backend/src/utils/temPrefix.js` — sửa luật thì sửa CẢ HAI.
export function temCode(maTem, prefix, suffix) {
  const ma = String(maTem == null ? '' : maTem).trim();
  const s = suffix != null && suffix !== '' ? `-${suffix}` : '';
  if (prefix == null || prefix === '') return `${ma}${s}`;
  if (MA_TEM_ERP_RE.test(ma)) return `${String(prefix)}${ma.slice(2)}${s}`;
  return `${prefix}-${ma}${s}`;
}

export const fmtDateTime = (d) => {
  if (!d) return '—';
  const date = new Date(d);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
