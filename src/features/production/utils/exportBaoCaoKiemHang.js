// Xuất Excel BÁO CÁO KẾT QUẢ KIỂM HÀNG (02/10/2026) — 2 sheet:
//   · "Theo dây chuyền": đúng khuôn tờ "KẾT QUẢ KIỂM TRA CLSP THEO DÂY CHUYỀN" của xưởng (Dây chuyền · SL kiểm ·
//     SL đạt · %Đạt · SL sửa · %Sửa · SL hủy · %Hủy · %K.đạt) + các chuyền thụt lề dưới mỗi dây chuyền + Tổng.
//   · "Chi tiết": 1 dòng / 1 lượt KCS (đúng danh sách đang lọc trên trang).
// Ghi SỐ THẬT + numFmt (cộng/lọc tiếp được). `exceljs` LAZY import. Khuôn trình bày = `exportBaoCaoDungChuyen`.

const XANH = 'FF0058BE';
const vien = { style: 'thin', color: { argb: 'FFD0D5DD' } };
const VIEN = { top: vien, left: vien, bottom: vien, right: vien };
const PT = '0.00%';
const SO = '#,##0';

const ngayVN = (iso) => String(iso || '').split('-').reverse().join('/');
const gioVN = (t) => (t ? new Date(t).toLocaleString('vi-VN') : '');

function tieuDeBang(ws, cols) {
  const r = ws.addRow(cols.map((c) => c.header));
  r.height = 22;
  r.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XANH } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = VIEN;
  });
}

function dong(ws, cols, x, { dam = false, nen = null, thut = false } = {}) {
  const r = ws.addRow(cols.map((c) => c.value(x)));
  r.eachCell({ includeEmpty: true }, (cell, j) => {
    const c = cols[j - 1];
    cell.border = VIEN;
    cell.alignment = { vertical: 'middle', horizontal: c.num ? 'right' : 'left', indent: thut && j === 1 ? 2 : 0 };
    if (c.fmt) cell.numFmt = c.fmt;
    cell.font = { bold: dam, color: { argb: thut ? 'FF4B5563' : 'FF111827' } };
    if (nen) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: nen } };
  });
}

function dauTrang(ws, soCot, tieuDe, phuDe) {
  ws.mergeCells(ws.rowCount + 1, 1, ws.rowCount + 1, soCot);
  const t = ws.getCell(ws.rowCount, 1);
  t.value = tieuDe;
  t.font = { bold: true, size: 14, color: { argb: XANH } };
  t.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(ws.rowCount).height = 24;
  ws.mergeCells(ws.rowCount + 1, 1, ws.rowCount + 1, soCot);
  const s = ws.getCell(ws.rowCount, 1);
  s.value = phuDe;
  s.font = { italic: true, size: 10, color: { argb: 'FF6B7280' } };
  s.alignment = { horizontal: 'center' };
  ws.addRow([]);
}

const COT_SO = [
  { header: 'SL kiểm', width: 12, num: true, fmt: SO, value: (x) => x.sl_kiem },
  { header: 'SL đạt', width: 12, num: true, fmt: SO, value: (x) => x.sl_dat },
  { header: '%Đạt', width: 10, num: true, fmt: PT, value: (x) => x.ty_le_dat },
  { header: 'SL sửa', width: 11, num: true, fmt: SO, value: (x) => x.sl_sua },
  { header: '%Sửa', width: 10, num: true, fmt: PT, value: (x) => x.ty_le_sua },
  { header: 'SL hủy', width: 10, num: true, fmt: SO, value: (x) => x.sl_huy },
  { header: '%Hủy', width: 10, num: true, fmt: PT, value: (x) => x.ty_le_huy },
  { header: '% K.đạt', width: 10, num: true, fmt: PT, value: (x) => x.ty_le_khong_dat },
];

export default async function exportBaoCaoKiemHang(data, { chiTiet, moTaLoc = '' } = {}) {
  const ExcelJS = (await import('exceljs')).default || (await import('exceljs'));
  const wb = new ExcelJS.Workbook();
  const khoang = data.tu_ngay === data.den_ngay
    ? `Ngày SX ${ngayVN(data.tu_ngay)}` : `Ngày SX ${ngayVN(data.tu_ngay)} → ${ngayVN(data.den_ngay)}`;
  const phuDe = `${khoang} (06:00 → 06:00) · xuất lúc ${new Date().toLocaleString('vi-VN')}`;

  // ── Sheet 1: Theo dây chuyền ──────────────────────────────────────────────
  const cot1 = [{ header: 'Dây chuyền', width: 26, value: (x) => x.ten }, ...COT_SO];
  const ws1 = wb.addWorksheet('Theo dây chuyền');
  ws1.columns = cot1.map((c) => ({ width: c.width }));
  dauTrang(ws1, cot1.length, 'KẾT QUẢ KIỂM TRA CLSP THEO DÂY CHUYỀN', phuDe);
  tieuDeBang(ws1, cot1);
  (data.theo_day_chuyen || []).forEach((d) => {
    dong(ws1, cot1, d, { dam: true, nen: 'FFF1F5FB' });
    (d.chuyen || []).forEach((c) => dong(ws1, cot1, { ...c, ten: `${c.ma_chuyen || '—'}${c.ten_chuyen && c.ten_chuyen !== c.ma_chuyen ? ` · ${c.ten_chuyen}` : ''}` }, { thut: true }));
  });
  dong(ws1, cot1, { ...data.tong, ten: 'Tổng' }, { dam: true, nen: 'FFDCE7F7' });
  ws1.addRow([]);
  ws1.addRow([`SL kiểm = đạt + sửa + hủy · % K.đạt = (sửa + hủy) / kiểm · Sửa/hủy theo phiếu Phân loại lỗi`
    + `${data.chua_phan_loai ? ` (${data.chua_phan_loai} lượt có hàng hư CHƯA phân loại — đang tính là sửa)` : ''}`])
    .getCell(1).font = { italic: true, size: 10, color: { argb: 'FF6B7280' } };

  // ── Sheet 2: Chi tiết ──────────────────────────────────────────────────────
  const rows = chiTiet || data.chi_tiet || [];
  const cot2 = [
    { header: 'STT', width: 6, value: (x) => x._i },
    { header: 'Ngày SX', width: 12, value: (x) => ngayVN(x.ngay_sx) },
    { header: 'Lúc kiểm', width: 20, value: (x) => gioVN(x.tg_kiem) },
    { header: 'Mã tem', width: 16, value: (x) => x.ma_tem || '' },
    { header: 'Dây chuyền', width: 11, value: (x) => x.ten_nhom || '' },
    { header: 'Chuyền', width: 12, value: (x) => x.ma_chuyen || '' },
    { header: 'Mã lệnh', width: 14, value: (x) => x.ma_lenh_san_xuat || '' },
    { header: 'Code phần', width: 26, value: (x) => x.ma_phan || '' },
    { header: 'Khách hàng', width: 14, value: (x) => x.khach || '' },
    { header: 'Đơn hàng', width: 18, value: (x) => x.po || '' },
    { header: 'Mã hàng', width: 18, value: (x) => x.ma_hang || '' },
    { header: 'Màu vải', width: 16, value: (x) => x.mau_vai || '' },
    { header: 'SL kiểm', width: 10, num: true, fmt: SO, value: (x) => x.sl_kiem },
    { header: 'SL đạt', width: 10, num: true, fmt: SO, value: (x) => x.sl_dat },
    { header: 'SL sửa', width: 10, num: true, fmt: SO, value: (x) => x.sl_sua },
    { header: 'SL hủy', width: 10, num: true, fmt: SO, value: (x) => x.sl_huy },
    { header: 'Chưa phân loại', width: 14, value: (x) => (x.chua_phan_loai ? 'Chưa phân loại' : '') },
    { header: 'Người kiểm', width: 20, value: (x) => x.nguoi_kiem || '' },
  ];
  const ws2 = wb.addWorksheet('Chi tiết');
  ws2.columns = cot2.map((c) => ({ width: c.width }));
  dauTrang(ws2, cot2.length, 'KẾT QUẢ KIỂM HÀNG — CHI TIẾT LƯỢT KCS', `${rows.length} lượt · ${phuDe}${moTaLoc ? ` · lọc: ${moTaLoc}` : ''}`);
  tieuDeBang(ws2, cot2);
  ws2.views = [{ state: 'frozen', ySplit: ws2.rowCount }];
  rows.forEach((x, i) => dong(ws2, cot2, { ...x, _i: i + 1 }, { nen: i % 2 ? 'FFF8F9FB' : null }));

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `bao-cao-kiem-hang-${data.tu_ngay}${data.den_ngay !== data.tu_ngay ? `_${data.den_ngay}` : ''}.xlsx`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
