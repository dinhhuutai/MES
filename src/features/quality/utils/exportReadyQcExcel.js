// Xuất Excel danh sách "QC CHUẨN BỊ KỸ THUẬT (READY)" — theo đúng danh sách ĐANG LỌC trên màn hình.
// Định dạng sẵn: tiêu đề, header tô nền, viền, ✓ xanh, hạn giao trễ tô đỏ. Lazy import exceljs.

import { khuonRequired } from '../../technical-ready/constants';

const pad = (n) => String(n).padStart(2, '0');
const reqCount = (r) => (khuonRequired(r.ten_khach_hang) ? 3 : 2);
const fmtDMY = (s) => { if (!s) return ''; const x = new Date(s); return Number.isNaN(+x) ? '' : `${pad(x.getDate())}/${pad(x.getMonth() + 1)}/${x.getFullYear()}`; };
const daysDiff = (s) => {
  if (!s) return null;
  const h = new Date(s); h.setHours(0, 0, 0, 0);
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.round((h - t) / 86400000);
};

const COLS = [
  { h: 'STT', w: 6, key: (r, i) => i + 1, num: true },
  { h: 'Code phần', w: 24, key: (r) => r.ma_phan || '' },
  { h: 'Khách hàng', w: 22, key: (r) => r.ten_khach_hang || '' },
  { h: 'Đơn hàng', w: 16, key: (r) => r.ma_don_hang || '' },
  { h: 'Mã hàng', w: 16, key: (r) => r.ma_hang || '' },
  { h: 'Màu vải', w: 16, key: (r) => r.mau_vai || '' },
  { h: 'Kích vải', w: 12, key: (r) => r.kich_vai || '' },
  { h: 'Kích phim', w: 12, key: (r) => r.kich_phim || '' },
  { h: 'Loại đợt vải', w: 14, key: (r) => r.loai_dot_vai || '' },
  { h: 'Film', w: 8, key: (r) => (r.film_done ? '✓' : '–'), center: true, done: (r) => r.film_done },
  { h: 'Khuôn', w: 8, key: (r) => (!khuonRequired(r.ten_khach_hang) ? '—' : r.khuon_done ? '✓' : '–'), center: true, done: (r) => khuonRequired(r.ten_khach_hang) && r.khuon_done },
  { h: 'Mực', w: 8, key: (r) => (r.muc_done ? '✓' : '–'), center: true, done: (r) => r.muc_done },
  { h: 'Trạng thái KT', w: 16, key: (r) => (r.tech_done ? `Đủ ${reqCount(r)} mục` : `${r.n_tech_done || 0}/${reqCount(r)} mục`), center: true },
  { h: 'Hạn giao', w: 14, key: (r) => fmtDMY(r.han_giao_hang), center: true, han: true },
];

export default async function exportReadyQcExcel(rows, fileName = 'qc-ready') {
  const ExcelJS = (await import('exceljs')).default || (await import('exceljs'));
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('QC READY');
  ws.columns = COLS.map((c) => ({ width: c.w }));
  const N = COLS.length;

  const thin = { style: 'thin', color: { argb: 'FFD0D5DD' } };
  const border = { top: thin, left: thin, bottom: thin, right: thin };

  // Tiêu đề
  ws.mergeCells(1, 1, 1, N);
  const t = ws.getCell(1, 1);
  t.value = 'DANH SÁCH QC CHUẨN BỊ KỸ THUẬT (READY)';
  t.font = { bold: true, size: 15, color: { argb: 'FF0058BE' } };
  t.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 26;

  // Dòng phụ đề: ngày xuất + số dòng
  ws.mergeCells(2, 1, 2, N);
  const sub = ws.getCell(2, 1);
  sub.value = `Xuất ngày ${fmtDMY(new Date())} · ${rows.length} phần in`;
  sub.font = { italic: true, size: 10, color: { argb: 'FF6B7280' } };
  sub.alignment = { horizontal: 'center' };

  // Header bảng
  const head = ws.addRow(COLS.map((c) => c.h));
  head.height = 24;
  head.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0058BE' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = border;
  });
  const headRowIdx = head.number;

  rows.forEach((r, i) => {
    const row = ws.addRow(COLS.map((c) => c.key(r, i)));
    const zebra = i % 2 === 1;
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      const c = COLS[col - 1];
      cell.border = border;
      cell.alignment = { vertical: 'middle', horizontal: c.num ? 'center' : c.center ? 'center' : 'left', wrapText: false };
      if (zebra) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF6F8FB' } };
      if (c.done) cell.font = { bold: true, color: { argb: c.done(r) ? 'FF16A34A' : 'FF9CA3AF' } }; // ✓ xanh / – xám
      if (c.h === 'Trạng thái KT') cell.font = { color: { argb: r.tech_done ? 'FF16A34A' : 'FFB45309' }, bold: true };
      if (c.han) {
        const d = daysDiff(r.han_giao_hang);
        if (d != null && d < 0) cell.font = { bold: true, color: { argb: 'FFDC2626' } }; // trễ → đỏ
        else if (d != null && d <= 1) cell.font = { bold: true, color: { argb: 'FFB45309' } }; // gấp → cam
      }
    });
  });

  // Đóng băng header để cuộn vẫn thấy tiêu đề cột
  ws.views = [{ state: 'frozen', ySplit: headRowIdx }];

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = `${new Date().getFullYear()}${pad(new Date().getMonth() + 1)}${pad(new Date().getDate())}`;
  a.href = url; a.download = `${fileName}-${stamp}.xlsx`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
