// Xuất Excel modal Danh sách release của Sản xuất — đúng các dòng ĐANG HIỆN (chip khu + chuyền thêm + bộ lọc). Lazy exceljs.
//   · `cheDo: 'RELEASE'` (mặc định) — "DANH SÁCH RELEASE <KHU> <ngày>", bộ cột `COT_DS_RELEASE_SX` (tiêu đề 2 tầng: PHẦN
//     IN · HẠN HOÀN THÀNH · SL IN) + dòng số tổng như tờ mẫu.
//   · `cheDo: 'NHAT_KY'` (26/10/2026) — "DANH SÁCH NHẬT KÝ IN" + dòng "Từ ngày … đến ngày …" như mẫu ERP, bộ cột
//     `COT_NHAT_KY_IN` (tiêu đề 2 tầng: Hàng hóa · Số lượng · Thông tin hàng in).
import { COT_DS_RELEASE_SX, COT_NHAT_KY_IN, tieuDeNhom, tongDsRelease } from './dsReleaseSx';

const XANH = 'FFE2EFDA';
const VANG = 'FFFFE699';
const TIM = 'FFD9E1F2';
const GIUA = ['chuyen', 'gio_bd', 'gio_kt', 'trang_thai', 'tho_in', 'to', 'ca', 'ngay', 'gio', 'gio_sx', 'btp', 'btp2', 'ngay_giao', 'ngay_xn_kiem', 'day_chuyen'];
const ngayHien = (iso) => String(iso || '').split('-').reverse().join('/');

export default async function exportDsReleaseSx(rows, { tieuDe, ngay, denNgay, cheDo = 'RELEASE' }) {
  const ExcelJS = (await import('exceljs')).default || (await import('exceljs'));
  const nhatKy = cheDo === 'NHAT_KY';
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(nhatKy ? 'Nhật ký in' : 'Danh sách release');
  const cols = nhatKy ? COT_NHAT_KY_IN : COT_DS_RELEASE_SX;
  const N = cols.length;
  ws.columns = cols.map((c) => ({ width: c.width }));
  const thin = { style: 'thin', color: { argb: 'FF000000' } };
  const border = { top: thin, left: thin, bottom: thin, right: thin };
  const font = (extra = {}) => ({ name: 'Calibri', size: 11, ...extra });
  const iCot = (k) => cols.findIndex((c) => c.key === k) + 1;

  // Dòng 1 — tiêu đề.
  ws.mergeCells(1, 1, 1, N);
  const t = ws.getCell(1, 1);
  t.value = tieuDe;
  t.font = font({ bold: true, size: 16 });
  t.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 26;

  if (nhatKy) {
    // Dòng 2 — "Từ ngày … đến ngày …" như mẫu ERP.
    ws.mergeCells(2, 1, 2, N);
    const d = ws.getCell(2, 1);
    d.value = `Từ ngày ${ngayHien(ngay)} đến ngày ${ngayHien(denNgay || ngay)}`;
    d.font = font({ size: 11 });
    d.alignment = { horizontal: 'center', vertical: 'middle' };
  } else {
    // Dòng 2–3 — số tổng như tờ mẫu: Tổng đơn · Tổng mã · Tổng phần release · SL RELEASE · SL IN.
    const tong = tongDsRelease(rows);
    const o = [
      ['TỔNG ĐƠN RELEASE', tong.tong_don, iCot('po'), null],
      ['TỔNG MÃ RELEASE', tong.tong_ma, iCot('ma'), null],
      ['TỔNG PHẦN RELEASE', tong.tong_phan, iCot('kich_vai'), null],
      ['SL RELEASE', tong.sl_release, iCot('sl_release'), 'FFD9D9D9'],
      ['SL IN', tong.sl_in, iCot('sl_in'), VANG],
    ];
    o.forEach(([nhan, v, c, nen]) => {
      const a = ws.getCell(2, c); const b = ws.getCell(3, c);
      a.value = nhan; b.value = v;
      a.font = font({ bold: true, size: 9 }); b.font = font({ bold: true });
      [a, b].forEach((x) => { x.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; if (nen) x.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: nen } }; });
      b.numFmt = '#,##0';
    });
    ws.getRow(2).height = 28;
  }

  // Dòng 4–5 — tiêu đề nhóm + cột.
  const R1 = 4; const R2 = 5;
  tieuDeNhom(cols).forEach((h) => {
    const c1 = h.tuCot + 1;
    ws.getCell(R1, c1).value = h.nhan;
    if (h.rowSpan === 2) ws.mergeCells(R1, c1, R2, c1);
    else {
      if (h.colSpan > 1) ws.mergeCells(R1, c1, R1, c1 + h.colSpan - 1);
      for (let k = 0; k < h.colSpan; k += 1) ws.getCell(R2, c1 + k).value = cols[h.tuCot + k].header;
    }
  });
  for (let c = 1; c <= N; c += 1) {
    [R1, R2].forEach((r) => {
      const cell = ws.getCell(r, c);
      cell.font = font({ bold: true });
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XANH } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = border;
    });
  }
  ws.getRow(R2).height = 30;
  ws.autoFilter = { from: { row: R2, column: 1 }, to: { row: R2, column: N } };
  ws.views = [{ state: 'frozen', ySplit: R2 }];

  const iTong = nhatKy ? 0 : iCot('tong');
  rows.forEach((r) => {
    const row = ws.addRow(cols.map((c) => c.value(r)));
    row.eachCell({ includeEmpty: true }, (cell, ci) => {
      const c = cols[ci - 1];
      cell.border = border;
      cell.font = font();
      cell.alignment = { vertical: 'middle', horizontal: c.num || GIUA.includes(c.key) ? 'center' : 'left', wrapText: true };
      if (c.num && typeof cell.value === 'number') cell.numFmt = '#,##0';
      if (ci === iTong) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TIM } };
    });
  });

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const hau = `${String(ngay || '').replace(/-/g, '')}${denNgay && denNgay !== ngay ? `-${String(denNgay).replace(/-/g, '')}` : ''}`;
  a.href = url; a.download = `${nhatKy ? 'nhat-ky-in' : 'danh-sach-release-sx'}-${hau}.xlsx`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
