// Xuất Excel dùng chung cho các SIDEBAR danh sách (Đã hoàn thành / Lịch sử...).
// Format sẵn: tiêu đề, phụ đề, header nền xanh #0058BE chữ trắng, viền mảnh, zebra,
// cột STT tự thêm, cột kiểu 'date' tô đỏ (trễ) / cam (gấp). Lazy import exceljs.
//
// exportPanelExcel({ cols, rows, title, subtitle, fileName })
//   cols: [{ header, value: (r,i)=>any, num?:bool, center?:bool, type?:'date',
//            red?:(r,i)=>bool (tô ĐỎ đậm — vd lần test không đạt), ok?:(r,i)=>bool (tô XANH — vd đạt) }]
//   (STT được TỰ thêm làm cột đầu — không cần khai báo.)

const pad = (n) => String(n).padStart(2, '0');
const fmtDMY = (s) => {
  if (!s) return '';
  const x = new Date(s);
  return Number.isNaN(+x) ? String(s) : `${pad(x.getDate())}/${pad(x.getMonth() + 1)}/${x.getFullYear()}`;
};
const daysDiff = (s) => {
  if (!s) return null;
  const h = new Date(s); if (Number.isNaN(+h)) return null;
  h.setHours(0, 0, 0, 0);
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.round((h - t) / 86400000);
};

export default async function exportPanelExcel({ cols = [], rows = [], title = 'Danh sách', subtitle, fileName = 'danh-sach' }) {
  const ExcelJS = (await import('exceljs')).default || (await import('exceljs'));
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Danh sách');

  const allCols = [{ header: 'STT', width: 6, center: true, value: (r, i) => i + 1 }, ...cols];
  ws.columns = allCols.map((c) => ({ width: c.width || 16 }));
  const N = allCols.length;

  const thin = { style: 'thin', color: { argb: 'FFD0D5DD' } };
  const border = { top: thin, left: thin, bottom: thin, right: thin };

  ws.mergeCells(1, 1, 1, N);
  const t = ws.getCell(1, 1);
  t.value = title;
  t.font = { bold: true, size: 14, color: { argb: 'FF0058BE' } };
  t.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 24;

  ws.mergeCells(2, 1, 2, N);
  const sub = ws.getCell(2, 1);
  sub.value = subtitle || `Xuất ngày ${fmtDMY(new Date())} · ${rows.length} dòng`;
  sub.font = { italic: true, size: 10, color: { argb: 'FF6B7280' } };
  sub.alignment = { horizontal: 'center' };

  const head = ws.addRow(allCols.map((c) => c.header));
  head.height = 22;
  head.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0058BE' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = border;
  });
  const headIdx = head.number;

  rows.forEach((r, i) => {
    const row = ws.addRow(allCols.map((c) => (c.type === 'date' ? fmtDMY(c.value(r, i)) : c.value(r, i))));
    const zebra = i % 2 === 1;
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      const c = allCols[col - 1];
      cell.border = border;
      cell.alignment = { vertical: 'middle', horizontal: c.center ? 'center' : c.num ? 'right' : 'left', wrapText: false };
      if (zebra) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF6F8FB' } };
      if (c.type === 'date') {
        const d = daysDiff(c.value(r, i));
        if (d != null && d < 0) cell.font = { bold: true, color: { argb: 'FFDC2626' } };
        else if (d != null && d <= 1) cell.font = { bold: true, color: { argb: 'FFB45309' } };
      }
      if (typeof c.red === 'function' && c.red(r, i)) cell.font = { bold: true, color: { argb: 'FFDC2626' } };
      else if (typeof c.ok === 'function' && c.ok(r, i)) cell.font = { color: { argb: 'FF16A34A' } };
    });
  });

  ws.views = [{ state: 'frozen', ySplit: headIdx }];

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = `${new Date().getFullYear()}${pad(new Date().getMonth() + 1)}${pad(new Date().getDate())}`;
  a.href = url; a.download = `${fileName}-${stamp}.xlsx`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
