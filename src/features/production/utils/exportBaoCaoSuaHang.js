// Xuất Excel BÁO CÁO SỬA HÀNG (09/10/2026) — 3 sheet:
//   · "Báo cáo sửa hàng": đúng khuôn tờ xưởng — tiêu đề 3 tầng gộp ô (Kết quả sửa · Kết quả kiểm hàng sửa · Tồn Sửa ·
//     Nghẽn › Hiện trạng / Kết quả xử lý), 1 dòng / dây chuyền + các chuyền thụt lề + Tổng cộng.
//   · "Chi tiết theo tem" / "Lượt sửa": đúng danh sách đang lọc trên trang.
// Ghi SỐ THẬT + numFmt (cộng/lọc tiếp được). `exceljs` LAZY import. Khuôn trình bày = `exportBaoCaoKiemHang`.

const XANH = 'FF0058BE';
const vien = { style: 'thin', color: { argb: 'FFD0D5DD' } };
const VIEN = { top: vien, left: vien, bottom: vien, right: vien };
const SO = '#,##0';
const GIO = '#,##0.0';

const ngayVN = (iso) => String(iso || '').split('-').reverse().join('/');
const gioVN = (t) => (t ? new Date(t).toLocaleString('vi-VN') : '');

function oTieuDe(cell, value) {
  cell.value = value;
  cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XANH } };
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  cell.border = VIEN;
}

function tieuDeBang(ws, cols) {
  const r = ws.addRow(cols.map((c) => c.header));
  r.height = 22;
  r.eachCell((cell, j) => oTieuDe(cell, cols[j - 1].header));
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

const so = (k) => ({ width: 10, num: true, fmt: SO, value: (x) => Number(x[k]) || 0 });
// 17 cột (sau cột Dây chuyền) — đúng thứ tự tờ xưởng.
const COT_SO = [
  so('ton_dau'), so('nhan'), so('da_sua'), so('chua_sua'),
  so('kiem_ton_dau'), so('kiem_nhan'), so('kiem_dat'), so('kiem_huy'), so('chua_kiem'),
  so('ton_sua'),
  so('ng_phan'), so('ng_sl'), { width: 11, num: true, fmt: GIO, value: (x) => Number(x.ng_gio) || 0 },
  so('ng_phan_xong'), so('ng_sl_xong'), so('ng_phan_chua'), so('ng_sl_chua'),
];

// Tiêu đề 3 tầng gộp ô của sheet chính (cột 1 = Dây chuyền, 2..18 = COT_SO).
function tieuDeBaTang(ws) {
  const r1 = ws.rowCount + 1;
  const r2 = r1 + 1;
  const r3 = r1 + 2;
  const gop = (hang1, cot1, hang2, cot2, v) => {
    if (hang1 !== hang2 || cot1 !== cot2) ws.mergeCells(hang1, cot1, hang2, cot2);
    oTieuDe(ws.getCell(hang1, cot1), v);
  };
  gop(r1, 1, r3, 1, 'Dây chuyền');
  gop(r1, 2, r2, 5, 'Kết quả sửa');
  gop(r1, 6, r2, 10, 'Kết quả kiểm hàng sửa');
  gop(r1, 11, r3, 11, 'Tồn Sửa');
  gop(r1, 12, r1, 18, 'Nghẽn');
  gop(r2, 12, r2, 14, 'Hiện trạng');
  gop(r2, 15, r2, 18, 'Kết quả xử lý');
  ['Tồn đầu', 'Nhận', 'Đã sửa', 'Chưa sửa', 'Tồn đầu', 'Nhận', 'Đạt', 'Hủy', 'Chưa kiểm'].forEach((v, i) => oTieuDe(ws.getCell(r3, 2 + i), v));
  ['Phần', 'SL', 'Thời gian nghẽn (giờ)', 'Phần xong', 'SL xong', 'Phần chưa', 'SL chưa'].forEach((v, i) => oTieuDe(ws.getCell(r3, 12 + i), v));
  [r1, r2, r3].forEach((r) => { ws.getRow(r).height = 22; });
  ws.getRow(r3).height = 32;
}

const cotTem = (them) => [
  { header: 'STT', width: 6, value: (x) => x._i },
  ...them.dau,
  { header: 'Mã tem', width: 16, value: (x) => x.ma_tem || '' },
  { header: 'Dây chuyền', width: 11, value: (x) => x.ten_nhom || '' },
  { header: 'Chuyền', width: 12, value: (x) => x.ma_chuyen || '' },
  { header: 'Mã lệnh', width: 14, value: (x) => x.ma_lenh_san_xuat || '' },
  { header: 'Code phần', width: 26, value: (x) => x.ma_phan || '' },
  { header: 'Khách hàng', width: 14, value: (x) => x.khach || '' },
  { header: 'Đơn hàng', width: 18, value: (x) => x.po || '' },
  { header: 'Mã hàng', width: 18, value: (x) => x.ma_hang || '' },
  { header: 'Màu vải', width: 16, value: (x) => x.mau_vai || '' },
  ...them.cuoi,
];

export default async function exportBaoCaoSuaHang(data, { tems, luot, moTaLoc = '' } = {}) {
  const ExcelJS = (await import('exceljs')).default || (await import('exceljs'));
  const wb = new ExcelJS.Workbook();
  const khoang = data.tu_ngay === data.den_ngay
    ? `Ngày SX ${ngayVN(data.tu_ngay)}` : `Ngày SX ${ngayVN(data.tu_ngay)} → ${ngayVN(data.den_ngay)}`;
  const phuDe = `${khoang} (06:00 → 06:00)${data.sla_phut ? ` · SLA Sửa ${data.sla_phut} phút` : ''} · xuất lúc ${new Date().toLocaleString('vi-VN')}`;

  // ── Sheet 1: Báo cáo sửa hàng ─────────────────────────────────────────────
  const cot1 = [{ header: 'Dây chuyền', width: 22, value: (x) => x.ten }, ...COT_SO];
  const ws1 = wb.addWorksheet('Báo cáo sửa hàng');
  ws1.columns = cot1.map((c) => ({ width: c.width }));
  dauTrang(ws1, cot1.length, 'BÁO CÁO SỬA HÀNG', phuDe);
  tieuDeBaTang(ws1);
  ws1.views = [{ state: 'frozen', xSplit: 1, ySplit: ws1.rowCount }];
  (data.theo_day_chuyen || []).forEach((d) => {
    dong(ws1, cot1, d, { dam: true, nen: 'FFF1F5FB' });
    (d.chuyen || []).forEach((c) => dong(ws1, cot1, { ...c, ten: `${c.ma_chuyen || '—'}${c.ten_chuyen && c.ten_chuyen !== c.ma_chuyen ? ` · ${c.ten_chuyen}` : ''}` }, { thut: true }));
  });
  dong(ws1, cot1, { ...data.tong, ten: 'Tổng cộng' }, { dam: true, nen: 'FFDCE7F7' });
  ws1.addRow([]);
  [
    'Tồn đầu + Nhận − Đã sửa = Chưa sửa · Nhận = phần sửa của lượt KCS (theo phiếu Phân loại lỗi) + OQC trả về Sửa · Đã sửa = sửa đạt + sửa hủy (gồm hủy thẳng).',
    'MES ghi kết quả kiểm cùng lúc xác nhận sửa ⇒ Kiểm hàng sửa: Nhận = Đã sửa, không có tồn đầu / chưa kiểm; Tồn Sửa = Chưa sửa + Chưa kiểm.',
    'Nghẽn đo theo tem từ lúc vào Sửa (KCS đầu có hư) + SLA trạm Sửa · Phần = số phần in · Chưa = còn chờ sửa cuối kỳ đã quá SLA · Xong = sửa xong trong kỳ sau khi quá SLA.',
  ].forEach((g) => { ws1.addRow([g]).getCell(1).font = { italic: true, size: 10, color: { argb: 'FF6B7280' } }; });

  // ── Sheet 2: Chi tiết theo tem ─────────────────────────────────────────────
  const rows2 = tems || data.chi_tiet || [];
  const cot2 = cotTem({
    dau: [{ header: 'Vào sửa', width: 20, value: (x) => gioVN(x.tg_vao) }],
    cuoi: [
      { header: 'Tồn đầu', width: 10, num: true, fmt: SO, value: (x) => x.ton_dau },
      { header: 'Nhận', width: 10, num: true, fmt: SO, value: (x) => x.nhan },
      { header: 'Trong đó OQC trả về', width: 12, num: true, fmt: SO, value: (x) => x.nhan_tra_ve },
      { header: 'Đã sửa', width: 10, num: true, fmt: SO, value: (x) => x.da_sua },
      { header: 'Sửa đạt', width: 10, num: true, fmt: SO, value: (x) => x.kiem_dat },
      { header: 'Sửa hủy', width: 10, num: true, fmt: SO, value: (x) => x.kiem_huy },
      { header: 'Chưa sửa', width: 10, num: true, fmt: SO, value: (x) => x.chua_sua },
      { header: 'Nghẽn', width: 12, value: (x) => (x.nghen === 'CHUA' ? 'Chưa xử lý' : x.nghen === 'XONG' ? 'Đã xử lý' : '') },
      { header: 'Giờ nghẽn', width: 10, num: true, fmt: GIO, value: (x) => (x.nghen ? x.gio_nghen : null) },
    ],
  });
  const ws2 = wb.addWorksheet('Chi tiết theo tem');
  ws2.columns = cot2.map((c) => ({ width: c.width }));
  dauTrang(ws2, cot2.length, 'BÁO CÁO SỬA HÀNG — CHI TIẾT THEO TEM', `${rows2.length} tem · ${phuDe}${moTaLoc ? ` · lọc: ${moTaLoc}` : ''}`);
  tieuDeBang(ws2, cot2);
  ws2.views = [{ state: 'frozen', ySplit: ws2.rowCount }];
  rows2.forEach((x, i) => dong(ws2, cot2, { ...x, _i: i + 1 }, { nen: i % 2 ? 'FFF8F9FB' : null }));

  // ── Sheet 3: Lượt sửa ──────────────────────────────────────────────────────
  const rows3 = luot || data.chi_tiet_luot || [];
  const cot3 = cotTem({
    dau: [
      { header: 'Ngày SX', width: 12, value: (x) => ngayVN(x.ngay_sx) },
      { header: 'Lúc sửa', width: 20, value: (x) => gioVN(x.tg) },
    ],
    cuoi: [
      { header: 'Sửa đạt', width: 10, num: true, fmt: SO, value: (x) => x.dat },
      { header: 'Sửa hủy', width: 10, num: true, fmt: SO, value: (x) => x.huy },
      { header: 'Trong đó hủy thẳng', width: 12, num: true, fmt: SO, value: (x) => x.huy_thang },
      { header: 'Người sửa', width: 20, value: (x) => x.nguoi_sua || '' },
      { header: 'Người xác nhận', width: 20, value: (x) => x.nguoi_xac_nhan || '' },
      { header: 'Ghi chú', width: 28, value: (x) => x.ghi_chu || '' },
    ],
  });
  const ws3 = wb.addWorksheet('Lượt sửa');
  ws3.columns = cot3.map((c) => ({ width: c.width }));
  dauTrang(ws3, cot3.length, 'BÁO CÁO SỬA HÀNG — LƯỢT SỬA', `${rows3.length} lượt · ${phuDe}${moTaLoc ? ` · lọc: ${moTaLoc}` : ''}`);
  tieuDeBang(ws3, cot3);
  ws3.views = [{ state: 'frozen', ySplit: ws3.rowCount }];
  rows3.forEach((x, i) => dong(ws3, cot3, { ...x, _i: i + 1 }, { nen: i % 2 ? 'FFF8F9FB' : null }));

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `bao-cao-sua-hang-${data.tu_ngay}${data.den_ngay !== data.tu_ngay ? `_${data.den_ngay}` : ''}.xlsx`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
