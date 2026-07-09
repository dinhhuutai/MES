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

// Tách mã tem gốc từ mã có tiền tố công đoạn / hậu tố lần giao (QR nay mã hóa cả tiền tố).
// Vd: '15-TEM00123' → 'TEM00123'; '17-TEM00030-1' → 'TEM00030'. Dùng khi quét QR để tra tem.
export const baseMaTem = (code) =>
  String(code || '').trim().replace(/^\d+-/, '').replace(/-\d+$/, '');

export const fmtDateTime = (d) => {
  if (!d) return '—';
  const date = new Date(d);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
