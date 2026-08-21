// Xuất 1 báo cáo (bảng tính) ra Excel (.xlsx) — giá trị đã tính (ket_qua) + KHỐI DANH SÁCH + ô gộp
// + bề rộng cột + cố định hàng/cột + định dạng cơ bản. Lazy import exceljs để không phình bundle chính.
import { cellKey, parseKey, buildDsMap, colW, COL_W } from '../components/ReportGrid';
import { giaTriO } from './reportCells';

const THIN = { style: 'thin', color: { argb: 'FFD0D5DD' } };
const ALL_THIN = { top: THIN, left: THIN, bottom: THIN, right: THIN };
const ALIGN = { left: 'left', center: 'center', right: 'right' };

// content: { so_cot, so_hang, o, merges, dinh_dang, ket_qua, danh_sach, cot_w, hang_h, dong_bang, ten_bao_cao, ma_bao_cao }
export default async function exportReportExcel(content, fileName) {
  const ExcelJS = (await import('exceljs')).default || (await import('exceljs'));
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(content.ten_bao_cao?.slice(0, 28) || 'Báo cáo');
  const soCot = content.so_cot || 8;
  const o = content.o || {};
  const kq = content.ket_qua || {};
  // Khối danh sách: dựng CÙNG hàm với ReportGrid → Excel ra đúng những gì màn hình hiện.
  const ds = buildDsMap(o, content.danh_sach || {}, {});
  // Lưới nở đủ chứa dữ liệu khối danh sách (giống ReportGrid).
  const soHang = Math.max(content.so_hang || 20, ds.maxRow);

  // Bề rộng cột: px → "ký tự" của Excel (~7px/ký tự).
  ws.columns = Array.from({ length: soCot }, (_, c) => ({ width: Math.round((colW(content, c) || COL_W) / 7) }));

  for (let r = 0; r < soHang; r += 1) {
    const values = [];
    const oGiaTri = [];
    for (let c = 0; c < soCot; c += 1) {
      const k = cellKey(r, c);
      // ⚠⚠ GHI SỐ BẰNG SỐ THẬT, KHÔNG phải chuỗi đã format (fix 21/08/2026): bản cũ ghi `d.text` /
      //   `fmtSo(...)` nên MỌI ô trong file là CHỮ — bôi đen cột số ở WPS chỉ ra `Count`, `Sum=0`.
      //   Định dạng nghìn/%/tiền nay do `numFmt` của Excel lo (xem `NUM_FMT` ở `reportCells.js`).
      const g = giaTriO(o[k], kq[k], ds.map[k]);
      oGiaTri[c] = g;
      values[c] = g.giaTri;
    }
    const row = ws.addRow(values);
    row.height = Math.round((Number(content.hang_h?.[r]) || 24) * 0.75); // px → point
    for (let c = 0; c < soCot; c += 1) {
      const k = cellKey(r, c);
      const cell = row.getCell(c + 1);
      const src = o[k];
      const dd = src?.dinh_dang || {};
      const d = ds.map[k];
      const g = oGiaTri[c];
      const isNum = g.so;
      // Ô số ⇒ gắn mã định dạng của Excel; giá trị bên trong vẫn là SỐ nên cộng/lọc/vẽ được.
      if (isNum) cell.numFmt = g.dinhDang;
      cell.border = ALL_THIN;
      cell.alignment = {
        vertical: dd.can_doc === 'top' ? 'top' : dd.can_doc === 'duoi' ? 'bottom' : 'middle',
        horizontal: ALIGN[dd.can_le] || (isNum ? 'right' : 'left'),
        wrapText: !!dd.xuong_dong,
      };
      const font = {};
      if (dd.dam || d?.la_dau) font.bold = true; // tiêu đề khối danh sách luôn in đậm
      if (dd.nghieng) font.italic = true;
      if (dd.gach_chan) font.underline = true;
      if (dd.gach_ngang) font.strike = true;
      if (dd.mau_chu) font.color = { argb: `FF${String(dd.mau_chu).replace('#', '').toUpperCase()}` };
      if (Object.keys(font).length) cell.font = font;
      const nen = dd.mau_nen || (d?.la_dau ? '#EEF2F6' : null); // nền xám nhạt cho hàng tiêu đề
      if (nen) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${String(nen).replace('#', '').toUpperCase()}` } };
    }
  }

  // Cố định hàng/cột (freeze) — giữ nguyên như trên màn hình.
  const fz = content.dong_bang || {};
  if (fz.hang > 0 || fz.cot > 0) {
    ws.views = [{ state: 'frozen', xSplit: Number(fz.cot) || 0, ySplit: Number(fz.hang) || 0 }];
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
