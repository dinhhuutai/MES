// Xuất Excel "BẢNG CHECKLIST RELEASE" — bám ĐÚNG mẫu giấy xưởng (06/10/2026): tiêu đề (ngày tô đỏ) + 2 dòng
// tiêu đề nhóm/cột nền xanh lá + bảng. Bộ cột dùng chung với bảng trên màn hình: `cotChecklistRelease.js`.
// Lazy import exceljs để không phình bundle chính.
//
// ⚠ SỐ DÒNG ĐẾM THEO ĐỢT SẢN XUẤT: lệnh gom set cũ ra nhiều dòng (1 dòng/phần in) nhưng các ô MỨC LỆNH
//   (`mucLenh` trong bộ cột) được **mergeCells** dọc trên các dòng của cùng 1 đợt ⇒ mở Excel ra giống hệt
//   bảng trên màn hình. Dùng chung `gopTheoLenh` với modal.
import { gopTheoLenh } from './gopDongRelease';
import { COT_CHECKLIST, dongTieuDe, tieuDeChecklist } from './cotChecklistRelease';

const XANH = 'FFE2EFDA';   // nền tiêu đề như mẫu
const DO = 'FFFF0000';

export default async function exportReleaseListExcel(items, meta, { chip = '', fileName = 'checklist-release' } = {}) {
  const ExcelJS = (await import('exceljs')).default || (await import('exceljs'));
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Checklist release');
  const cols = COT_CHECKLIST;
  const N = cols.length;
  ws.columns = cols.map((c) => ({ width: c.width }));

  const thin = { style: 'thin', color: { argb: 'FF000000' } };
  const border = { top: thin, left: thin, bottom: thin, right: thin };

  // Dòng 1 — tiêu đề, phần NGÀY tô đỏ (rich text) như mẫu.
  ws.mergeCells(1, 1, 1, N);
  const tieuDe = tieuDeChecklist(chip, meta?.ngay, meta?.mode);
  const t = ws.getCell(1, 1);
  t.value = { richText: [
    { text: tieuDe.truoc, font: { bold: true, size: 18, name: 'Times New Roman' } },
    { text: tieuDe.ngay, font: { bold: true, size: 18, name: 'Times New Roman', color: { argb: DO } } },
  ] };
  t.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 30;

  // Dòng 2–3 — tiêu đề nhóm + tiêu đề cột.
  const { tren } = dongTieuDe(cols);
  const R1 = 2;
  const R2 = 3;
  const kieuTieuDe = (cell) => {
    cell.font = { bold: true, name: 'Times New Roman', size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XANH } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = border;
  };
  for (const h of tren) {
    const c1 = h.tuCot + 1;
    if (h.rowSpan === 2) {
      ws.getCell(R1, c1).value = h.nhan;
      ws.mergeCells(R1, c1, R2, c1);
    } else {
      ws.getCell(R1, c1).value = h.nhan;
      if (h.colSpan > 1) ws.mergeCells(R1, c1, R1, c1 + h.colSpan - 1);
      for (let k = 0; k < h.colSpan; k += 1) ws.getCell(R2, c1 + k).value = cols[h.tuCot + k].header;
    }
  }
  for (let c = 1; c <= N; c += 1) { kieuTieuDe(ws.getCell(R1, c)); kieuTieuDe(ws.getCell(R2, c)); }
  ws.getRow(R1).height = 22;
  ws.getRow(R2).height = 30;
  ws.autoFilter = { from: { row: R2, column: 1 }, to: { row: R2, column: N } };
  ws.views = [{ state: 'frozen', ySplit: R2 }];

  // Dữ liệu
  const ds = gopTheoLenh(items);
  const dongDau = [];
  for (const r of ds) {
    // Ô mức LỆNH chỉ ghi ở DÒNG ĐẦU của đợt SX; dòng sau để trống rồi merge lên.
    const row = ws.addRow(cols.map((c) => (c.mucLenh && !r._dau ? '' : c.value(r))));
    row.eachCell({ includeEmpty: true }, (cell, ci) => {
      const c = cols[ci - 1];
      cell.border = border;
      cell.font = { name: 'Times New Roman', size: 11, bold: ['tt', 'chuyen', 'khach', 'po', 'ten_hang', 'mau_vai', 'kich_vai', 'kich_phim', 'tinh_chat_in', 'sldh', 'slnv', 'sl_release', 'gio_bd', 'gio_kt'].includes(c?.key) };
      cell.alignment = { vertical: 'middle', horizontal: c?.num || ['gio_bd', 'gio_kt', 'han_ht', 'kt_khuon', 'kt_muc', 'kt_test', 'tinh_chat_in'].includes(c?.key) ? 'center' : 'left', wrapText: true };
      if (c?.num && typeof cell.value === 'number') cell.numFmt = '#,##0';
    });
    if (r._dau) dongDau.push({ r, rowNumber: row.number });
  }

  // Merge dọc các cột mức LỆNH cho đợt SX có >1 phần in (`_span` tính trên tập ĐANG XUẤT).
  const cotGop = cols.map((c, i) => (c.mucLenh ? i + 1 : null)).filter(Boolean);
  for (const { r, rowNumber } of dongDau) {
    if (r._span <= 1) continue;
    for (const col of cotGop) ws.mergeCells(rowNumber, col, rowNumber + r._span - 1, col);
  }

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${fileName}-${(meta?.ngay || '').replace(/-/g, '')}.xlsx`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
