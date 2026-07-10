// Xuất 1 báo cáo (bảng tính) ra Excel (.xlsx) — giá trị đã tính (ket_qua) + ô gộp + định dạng cơ bản.
// Lazy import exceljs để không phình bundle chính.
import { cellKey, parseKey, fmtSo } from '../components/ReportGrid';

const THIN = { style: 'thin', color: { argb: 'FFD0D5DD' } };
const ALL_THIN = { top: THIN, left: THIN, bottom: THIN, right: THIN };
const ALIGN = { left: 'left', center: 'center', right: 'right' };

// Chuỗi hiển thị 1 ô ở chế độ xem (khớp ReportGrid).
function cellText(cell, res) {
  const dd = cell?.dinh_dang || {};
  if (res) {
    if (res.loi) return String(res.value ?? '');
    if (res.kieu === 'bool') return res.value ? 'x' : '';
    if (res.kieu === 'text') return String(res.value ?? '');
    return fmtSo(res.value, dd.dinh_dang_so);
  }
  if (!cell) return '';
  if (cell.loai === 'text') return cell.gia_tri || '';
  if (cell.loai === 'so') return fmtSo(cell.gia_tri ?? '', dd.dinh_dang_so);
  if (cell.loai === 'hop_kiem') return cell.gia_tri ? 'x' : '';
  if (cell.loai === 'tha_xuong') return cell.gia_tri || '';
  return '';
}

// content: { so_cot, so_hang, o, merges, dinh_dang, ket_qua, ten_bao_cao, ma_bao_cao }
export default async function exportReportExcel(content, fileName) {
  const ExcelJS = (await import('exceljs')).default || (await import('exceljs'));
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(content.ten_bao_cao?.slice(0, 28) || 'Báo cáo');
  const soCot = content.so_cot || 8;
  const soHang = content.so_hang || 20;
  const o = content.o || {};
  const kq = content.ket_qua || {};

  ws.columns = Array.from({ length: soCot }, () => ({ width: 16 }));

  for (let r = 0; r < soHang; r += 1) {
    const values = [];
    for (let c = 0; c < soCot; c += 1) {
      values[c] = cellText(o[cellKey(r, c)], kq[cellKey(r, c)]);
    }
    const row = ws.addRow(values);
    row.height = 20;
    for (let c = 0; c < soCot; c += 1) {
      const cell = row.getCell(c + 1);
      const src = o[cellKey(r, c)];
      const dd = src?.dinh_dang || {};
      const res = kq[cellKey(r, c)];
      const isNum = res ? (res.kieu !== 'text' && res.kieu !== 'bool' && !res.loi) : src?.loai === 'so';
      cell.border = ALL_THIN;
      cell.alignment = {
        vertical: dd.can_doc === 'top' ? 'top' : dd.can_doc === 'duoi' ? 'bottom' : 'middle',
        horizontal: ALIGN[dd.can_le] || (isNum ? 'right' : 'left'),
        wrapText: !!dd.xuong_dong,
      };
      const font = {};
      if (dd.dam) font.bold = true;
      if (dd.nghieng) font.italic = true;
      if (dd.gach_chan) font.underline = true;
      if (dd.gach_ngang) font.strike = true;
      if (dd.mau_chu) font.color = { argb: `FF${String(dd.mau_chu).replace('#', '').toUpperCase()}` };
      if (Object.keys(font).length) cell.font = font;
      if (dd.mau_nen) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${String(dd.mau_nen).replace('#', '').toUpperCase()}` } };
    }
  }

  // Ô gộp.
  (content.merges || []).forEach((m) => {
    const p = parseKey(m.o); if (!p) return;
    const r0 = p.r + 1; const c0 = p.c + 1;
    const r1 = r0 + Math.max(1, m.r || 1) - 1; const c1 = c0 + Math.max(1, m.c || 1) - 1;
    try { ws.mergeCells(r0, c0, r1, c1); } catch { /* vùng gộp chồng — bỏ qua */ }
  });

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${fileName || content.ma_bao_cao || 'bao-cao'}.xlsx`; a.click();
  URL.revokeObjectURL(url);
}
