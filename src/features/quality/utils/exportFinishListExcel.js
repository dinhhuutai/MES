// Xuất Excel "DANH SÁCH FINISH NGÀY …" — bám ĐÚNG khuôn tờ xưởng (03/10/2026):
//   dòng 1 tiêu đề + ngày · dòng 2 MỤC TIÊU · dòng 3 KẾT QUẢ (TỔNG PO · TỔNG MÃ · PHẦN · SLĐH · SLNV) ·
//   dòng 4 tiêu đề 22 cột A→V (có nút lọc, cố định đầu bảng) · từ dòng 5 là dữ liệu.
// Ngày ghi kiểu NGÀY thật (lọc/sắp xếp được trong Excel), số ghi số + định dạng `#,##0`, barcode ghi CHUỖI (số dài
// ghi kiểu số sẽ bị Excel đổi sang dạng 6.26E+10). Lazy import exceljs để không phình bundle chính.
import { fmtDMY } from './danhSachFinish';

const COT = [
  { h: 'Ngày cập nhật danh sách', w: 12, v: (r) => r.ngay, ngay: true },
  { h: 'Cty', w: 9, v: (r) => r.ten_khach_hang },
  { h: 'Đơn hàng', w: 17, v: (r) => r.ma_don_hang },
  { h: 'Mã hàng', w: 26, v: (r) => r.ma_hang },
  { h: 'MÀU VẢI', w: 20, v: (r) => r.mau_vai },
  { h: 'KÍCH VẢI', w: 11, v: (r) => r.kich_vai },
  { h: 'KÍCH FILM', w: 11, v: (r) => r.kich_phim },
  { h: 'BARCODE', w: 14, v: (r) => r.barcode },
  { h: 'Máy /bàn', w: 9, v: (r) => r.ma_chuyen },
  { h: 'SLDH', w: 9, v: (r) => r.so_luong_don_hang, so: true },
  { h: 'SLNV', w: 9, v: (r) => r.slnv, so: true },
  { h: 'SLIN', w: 9, v: (r) => r.slin, so: true },
  { h: 'Sgiao', w: 9, v: (r) => r.sgiao, so: true },
  { h: 'Chênh lệch giao/PO', w: 11, v: (r) => r.chenh_lech, so: true },
  { h: 'Tồn cuối', w: 8, v: (r) => r.ton_cuoi, so: true },
  { h: 'Thời gian giao hàng', w: 12, v: (r) => r.han_giao_hang, ngay: true },
  { h: 'Số ngày tồn đọng', w: 8, v: (r) => r.so_ngay_ton_dong, so: true },
  { h: 'Ngày cập nhật kết quả', w: 12, v: (r) => r.ngay_cap_nhat_ket_qua, ngay: true, vang: true },
  { h: 'Sửa đạt', w: 8, v: (r) => r.sua_dat, so: true },
  { h: 'Sửa hủy', w: 8, v: (r) => r.sua_huy, so: true },
  { h: 'SL còn lại', w: 8, v: (r) => r.sl_con_lai, so: true, do: true },
  { h: 'Ghi chú', w: 24, v: (r) => r.ghi_chu },
];

// 'YYYY-MM-DD' ⇒ Date mốc 00:00 UTC (exceljs ghi số ngày theo UTC ⇒ đúng ngày, không lùi múi giờ).
const ngayExcel = (s) => {
  if (!s) return null;
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
  return y && m && d ? new Date(Date.UTC(y, m - 1, d)) : null;
};

export default async function exportFinishListExcel(items, { ngay, mucTieu, ketQua }, fileName = 'danh-sach-finish') {
  const ExcelJS = (await import('exceljs')).default || (await import('exceljs'));
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Danh sách finish', { views: [{ state: 'frozen', ySplit: 4 }] });
  ws.columns = COT.map((c) => ({ width: c.w }));
  const N = COT.length;
  const thin = { style: 'thin', color: { argb: 'FFBFC5CF' } };
  const border = { top: thin, left: thin, bottom: thin, right: thin };

  // Dòng 1 — tiêu đề (A→H) + ngày (I→L), chữ to như tờ giấy.
  ws.mergeCells(1, 1, 1, 8); ws.mergeCells(1, 9, 1, 12);
  ws.getCell(1, 1).value = 'DANH SÁCH FINISH NGÀY';
  ws.getCell(1, 9).value = fmtDMY(ngay);
  ws.getCell(1, 1).font = { bold: true, size: 20 }; ws.getCell(1, 9).font = { bold: true, size: 20 };
  ws.getCell(1, 1).alignment = { horizontal: 'right', vertical: 'middle' };
  ws.getCell(1, 9).alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
  ws.getRow(1).height = 34;

  // Dòng 2–3 — MỤC TIÊU / KẾT QUẢ.
  const dongTong = (r, nhan, t) => {
    ws.mergeCells(r, 1, r, 2);
    const vals = [[1, nhan], [3, 'TỔNG PO:'], [4, t.tong_po], [5, 'TỔNG MÃ:'], [6, t.tong_ma], [7, 'PHẦN:'], [8, t.phan],
      [9, 'SLĐH:'], [10, t.sldh], [11, 'SLNV:'], [12, t.slnv]];
    for (const [c, v] of vals) {
      const cell = ws.getCell(r, c);
      cell.value = v;
      cell.font = { bold: true };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      if (typeof v === 'number') cell.numFmt = '#,##0';
    }
    for (let c = 1; c <= 12; c += 1) ws.getCell(r, c).border = border;
    ws.getRow(r).height = 22;
  };
  dongTong(2, 'MỤC TIÊU', mucTieu);
  dongTong(3, 'KẾT QUẢ', ketQua);

  // Dòng 4 — tiêu đề cột.
  const head = ws.getRow(4);
  COT.forEach((c, i) => {
    const cell = head.getCell(i + 1);
    cell.value = c.h;
    cell.font = { bold: true, color: { argb: c.do ? 'FFDC2626' : 'FF111827' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: c.vang ? 'FFFFFF00' : 'FFEFF2F7' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = border;
  });
  head.height = 44;
  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: N } };

  for (const r of items) {
    const row = ws.addRow(COT.map((c) => {
      const v = c.v(r);
      if (c.ngay) return ngayExcel(v);
      if (c.so) return v == null || v === '' ? null : Number(v);
      return v == null ? '' : String(v);
    }));
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      const c = COT[col - 1];
      if (!c) return;
      cell.border = border;
      cell.alignment = { vertical: 'middle', horizontal: c.so || c.ngay ? 'right' : 'left', wrapText: !c.so && !c.ngay };
      if (c.ngay) cell.numFmt = 'dd/mm/yyyy';
      if (c.so) cell.numFmt = '#,##0';
      if (c.do && Number(cell.value) > 0) cell.font = { bold: true, color: { argb: 'FFDC2626' } };
    });
  }

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${fileName}-${String(ngay || '').replace(/-/g, '')}.xlsx`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
