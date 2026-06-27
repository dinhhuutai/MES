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
