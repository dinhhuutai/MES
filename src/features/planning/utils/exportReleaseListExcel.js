// Xuất Excel "DANH SÁCH RELEASE" — bám ĐÚNG bố cục form giấy (tiêu đề + dòng tổng + bảng).
// Lazy import exceljs để không phình bundle chính.

const HEADERS = [
  'CHUYỀN', 'KH', 'PO', 'MÃ', 'Màu vải', 'Kích vải', 'Kích phim',
  'SLĐH', 'SLNV', 'SL ĐÃ IN', 'SL ĐÃ GIAO', 'SL RELEASE',
  'OWNER', 'GIỜ BD', 'GIỜ KT', 'XÁC NHẬN RELEASE',
];
const WIDTHS = [10, 8, 15, 22, 20, 12, 14, 9, 9, 10, 11, 11, 12, 10, 10, 16];
const NUM_COLS = [8, 9, 10, 11, 12]; // căn phải: SLĐH..SL RELEASE

const pad = (n) => String(n).padStart(2, '0');
const fmtDMY = (s) => { if (!s) return ''; const x = new Date(s); return Number.isNaN(+x) ? '' : `${pad(x.getDate())}/${pad(x.getMonth() + 1)}/${x.getFullYear()}`; };
// Giờ 12h AM/PM giống form ("7:30 AM").
const fmtClock = (ts) => {
  if (!ts) return '';
  const x = new Date(ts); if (Number.isNaN(+x)) return '';
  let h = x.getHours(); const m = x.getMinutes(); const ap = h < 12 ? 'AM' : 'PM';
  h = h % 12; if (h === 0) h = 12;
  return `${h}:${pad(m)} ${ap}`;
};

export default async function exportReleaseListExcel(items, meta, fileName = 'danh-sach-release') {
  const ExcelJS = (await import('exceljs')).default || (await import('exceljs'));
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Danh sách release');
  ws.columns = WIDTHS.map((w) => ({ width: w }));
  const N = HEADERS.length;

  const thin = { style: 'thin', color: { argb: 'FFD0D5DD' } };
  const border = { top: thin, left: thin, bottom: thin, right: thin };

  // Tiêu đề
  ws.mergeCells(1, 1, 1, N);
  const t = ws.getCell(1, 1);
  t.value = `DANH SÁCH RELEASE NGÀY ${fmtDMY(meta?.ngay)}`;
  t.font = { bold: true, size: 15 };
  t.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 24;

  // Dòng tổng
  const sum = ws.addRow([
    'TỔNG ĐƠN', meta?.tong_don ?? 0, 'TỔNG MÃ', meta?.tong_ma ?? 0,
    'TỔNG PHẦN', meta?.tong_phan ?? 0, 'SL RELEASE', meta?.sl_release ?? 0,
  ]);
  sum.eachCell((c) => { c.font = { bold: true }; c.alignment = { vertical: 'middle' }; });

  ws.addRow([]); // spacer

  // Header bảng
  const head = ws.addRow(HEADERS);
  head.height = 26;
  head.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FF111827' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF2F7' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = border;
  });

  for (const r of items || []) {
    const row = ws.addRow([
      r.ten_chuyen || '', r.ten_khach_hang || '', r.ma_don_hang || '', r.ten_ma_hang || r.ma_hang || '',
      r.mau_vai || '', r.kich_vai || '', r.kich_phim || '',
      r.so_luong_don_hang ?? '', r.slnv ?? 0, r.sl_da_in ?? 0, r.sl_da_giao ?? 0, r.so_luong_release ?? 0,
      '', fmtClock(r.tg_bd_kh), fmtClock(r.tg_kt_kh), '',
    ]);
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.border = border;
      cell.alignment = { vertical: 'middle', horizontal: NUM_COLS.includes(col) ? 'right' : 'left', wrapText: false };
    });
  }

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${fileName}-${(meta?.ngay || '').replace(/-/g, '')}.xlsx`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
