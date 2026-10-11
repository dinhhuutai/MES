// Xuất Excel BÁO CÁO PHÂN LOẠI LỖI (11/10/2026) — 2 sheet:
//   · "Báo cáo PLL": đúng khuôn tờ xưởng — Mã lỗi × (từng cột của chiều đang xem: Sửa · Hủy) + Tổng lỗi (Sửa · Hủy ·
//     Sửa + Hủy · % S+H) + 3 dòng cuối Tổng lỗi · % lỗi · SL kiểm (ô SL kiểm gộp 2 cột Sửa/Hủy như tờ mẫu).
//   · "Chi tiết": 1 dòng / (tem × mã lỗi) — đúng danh sách đang lọc trên trang.
// Ghi SỐ THẬT + numFmt. `exceljs` LAZY import. Ma trận dựng bằng CHÍNH hàm của trang (`maTranPhanLoaiLoi.dungMaTran`).

const XANH = 'FF0058BE';
const XAM = 'FFF2F2F2';
const vien = { style: 'thin', color: { argb: 'FF9CA3AF' } };
const VIEN = { top: vien, left: vien, bottom: vien, right: vien };
const PT = '0.00%';
const SO = '#,##0';

const ngayVN = (iso) => String(iso || '').split('-').reverse().join('/');
const gioVN = (t) => (t ? new Date(t).toLocaleString('vi-VN') : '');

function oTieuDe(cell, value, nen = XANH, chu = 'FFFFFFFF') {
  cell.value = value;
  cell.font = { bold: true, color: { argb: chu } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: nen } };
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  cell.border = VIEN;
}

export default async function exportBaoCaoPhanLoaiLoi(data, { maTran, chiTiet = [], moTaLoc = '' } = {}) {
  const ExcelJS = (await import('exceljs')).default || (await import('exceljs'));
  const wb = new ExcelJS.Workbook();
  const khoang = data.tu_ngay === data.den_ngay
    ? `Ngày SX ${ngayVN(data.tu_ngay)}` : `Ngày SX ${ngayVN(data.tu_ngay)} → ${ngayVN(data.den_ngay)}`;
  const phuDe = `${khoang} (06:00 → 06:00) · theo ${maTran.ten_chieu.toLowerCase()}${moTaLoc ? ` · lọc: ${moTaLoc}` : ''} · xuất lúc ${new Date().toLocaleString('vi-VN')}`;

  // ── Sheet 1: Báo cáo PLL ───────────────────────────────────────────────────
  const ws = wb.addWorksheet('Báo cáo PLL');
  const { cot, dong, tongCot, tong } = maTran;
  const soCot = 1 + cot.length * 2 + 4;
  ws.columns = [{ width: 30 }, ...cot.flatMap(() => [{ width: 10 }, { width: 10 }]), { width: 11 }, { width: 11 }, { width: 12 }, { width: 11 }];
  ws.mergeCells(1, 1, 1, soCot);
  ws.getCell(1, 1).value = 'BÁO CÁO PHÂN LOẠI LỖI (PLL)';
  ws.getCell(1, 1).font = { bold: true, size: 14, color: { argb: XANH } };
  ws.getCell(1, 1).alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 24;
  ws.mergeCells(2, 1, 2, soCot);
  ws.getCell(2, 1).value = phuDe;
  ws.getCell(2, 1).font = { italic: true, size: 10, color: { argb: 'FF6B7280' } };
  ws.getCell(2, 1).alignment = { horizontal: 'center' };

  // Tiêu đề 2 tầng.
  const R1 = 4; const R2 = 5;
  ws.mergeCells(R1, 1, R2, 1); oTieuDe(ws.getCell(R1, 1), 'Mã lỗi');
  cot.forEach((c, i) => {
    const c1 = 2 + i * 2;
    ws.mergeCells(R1, c1, R1, c1 + 1); oTieuDe(ws.getCell(R1, c1), c.nhan);
    oTieuDe(ws.getCell(R2, c1), 'Sửa'); oTieuDe(ws.getCell(R2, c1 + 1), 'Hủy');
  });
  const cT = 2 + cot.length * 2;
  ws.mergeCells(R1, cT, R1, cT + 3); oTieuDe(ws.getCell(R1, cT), 'Tổng lỗi', XAM, 'FF111827');
  ['Sửa', 'Hủy', 'Sửa + Hủy', '% S+H'].forEach((v, i) => oTieuDe(ws.getCell(R2, cT + i), v, XAM, 'FF111827'));
  ws.getRow(R1).height = 22; ws.getRow(R2).height = 22;
  ws.views = [{ state: 'frozen', xSplit: 1, ySplit: R2 }];

  const ghi = (rowIdx, colIdx, v, { fmt = SO, dam = false, nen = null, trai = false } = {}) => {
    const cell = ws.getCell(rowIdx, colIdx);
    cell.value = v;
    cell.border = VIEN;
    cell.alignment = { vertical: 'middle', horizontal: trai ? 'left' : 'right', wrapText: trai };
    if (typeof v === 'number') cell.numFmt = fmt;
    cell.font = { bold: dam };
    if (nen) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: nen } };
  };
  const soHoacTrong = (n) => (n ? n : null);
  let r = R2;
  dong.forEach((d) => {
    r += 1;
    ghi(r, 1, d.ten_loi ? `${d.ma_loi} — ${d.ten_loi}` : d.ma_loi, { trai: true });
    cot.forEach((c, i) => {
      ghi(r, 2 + i * 2, soHoacTrong(d.o[c.key].sua));
      ghi(r, 3 + i * 2, soHoacTrong(d.o[c.key].huy));
    });
    ghi(r, cT, d.sua, { nen: XAM }); ghi(r, cT + 1, d.huy, { nen: XAM }); ghi(r, cT + 2, d.tong, { nen: XAM });
    ghi(r, cT + 3, d.ty_trong, { fmt: PT, nen: XAM });
  });
  // Tổng lỗi
  r += 1;
  ghi(r, 1, 'Tổng lỗi', { dam: true, trai: true });
  cot.forEach((c, i) => { ghi(r, 2 + i * 2, tongCot[c.key].sua, { dam: true }); ghi(r, 3 + i * 2, tongCot[c.key].huy, { dam: true }); });
  ghi(r, cT, tong.sua, { dam: true, nen: XAM }); ghi(r, cT + 1, tong.huy, { dam: true, nen: XAM });
  ghi(r, cT + 2, tong.tong, { dam: true, nen: XAM }); ghi(r, cT + 3, tong.ty_le, { fmt: PT, dam: true, nen: XAM });
  // % lỗi
  r += 1;
  ghi(r, 1, '% lỗi', { trai: true });
  cot.forEach((c, i) => { ghi(r, 2 + i * 2, tongCot[c.key].ty_le_sua, { fmt: PT }); ghi(r, 3 + i * 2, tongCot[c.key].ty_le_huy, { fmt: PT }); });
  ghi(r, cT, tong.ty_le_sua, { fmt: PT, nen: XAM }); ghi(r, cT + 1, tong.ty_le_huy, { fmt: PT, nen: XAM });
  ghi(r, cT + 2, tong.ty_le, { fmt: PT, nen: XAM }); ghi(r, cT + 3, null, { nen: XAM });
  // SL kiểm — gộp 2 cột Sửa/Hủy của từng nhóm; khối tổng gộp 3 cột.
  r += 1;
  ghi(r, 1, 'SL kiểm', { trai: true });
  cot.forEach((c, i) => {
    ws.mergeCells(r, 2 + i * 2, r, 3 + i * 2);
    ghi(r, 2 + i * 2, tongCot[c.key].kiem);
    ws.getCell(r, 2 + i * 2).alignment = { horizontal: 'center', vertical: 'middle' };
  });
  ws.mergeCells(r, cT, r, cT + 2);
  ghi(r, cT, tong.kiem, { nen: XAM });
  ws.getCell(r, cT).alignment = { horizontal: 'center', vertical: 'middle' };
  ghi(r, cT + 3, null, { nen: XAM });
  r += 2;
  ws.getCell(r, 1).value = '% S+H của mã lỗi = tỷ trọng trong tổng lỗi · % lỗi = lỗi ÷ SL kiểm của cột · SL kiểm = đạt + sửa + hủy của các lượt KCS trong kỳ '
    + '(cùng số Báo cáo kiểm hàng) · Sửa/Hủy theo phiếu Phân loại lỗi của tem.';
  ws.getCell(r, 1).font = { italic: true, size: 10, color: { argb: 'FF6B7280' } };

  // ── Sheet 2: Chi tiết ──────────────────────────────────────────────────────
  const cot2 = [
    ['STT', 6, (x, i) => i + 1], ['Ngày SX', 12, (x) => ngayVN(x.ngay_sx)], ['Lúc kiểm', 20, (x) => gioVN(x.tg_kiem)],
    ['Mã tem', 16, (x) => x.ma_tem || ''], ['Dây chuyền', 11, (x) => (x.nhom === 'BANIN' ? 'Bàn in' : x.nhom || '')],
    ['Chuyền', 12, (x) => x.ma_chuyen || ''], ['Mã lệnh', 14, (x) => x.ma_lenh_san_xuat || ''],
    ['Khách hàng', 14, (x) => x.khach || ''], ['Đơn hàng', 18, (x) => x.po || ''], ['Mã hàng', 20, (x) => x.ma_hang || ''],
    ['Code phần', 26, (x) => x.ma_phan || ''], ['Màu vải', 16, (x) => x.mau_vai || ''],
    ['Kích vải', 12, (x) => x.kich_vai || ''], ['Kích phim', 12, (x) => x.kich_phim || ''], ['Thợ in', 26, (x) => x.tho_ds || ''],
    ['Mã lỗi', 16, (x) => x.ma_loi || ''], ['Tên lỗi', 28, (x) => x.ten_loi || ''], ['Biện pháp', 22, (x) => x.bien_phap || ''],
    ['SL sửa', 10, (x) => x.sl_sua, true], ['SL hủy', 10, (x) => x.sl_huy, true],
    ['Người phân loại', 20, (x) => x.nguoi_phan_loai || ''], ['Phân loại lúc', 20, (x) => gioVN(x.tg_phan_loai)],
    ['Ghi chú', 26, (x) => x.ghi_chu || ''],
  ];
  const ws2 = wb.addWorksheet('Chi tiết');
  ws2.columns = cot2.map(([, w]) => ({ width: w }));
  ws2.mergeCells(1, 1, 1, cot2.length);
  ws2.getCell(1, 1).value = 'BÁO CÁO PHÂN LOẠI LỖI — CHI TIẾT';
  ws2.getCell(1, 1).font = { bold: true, size: 14, color: { argb: XANH } };
  ws2.getCell(1, 1).alignment = { horizontal: 'center' };
  ws2.mergeCells(2, 1, 2, cot2.length);
  ws2.getCell(2, 1).value = `${chiTiet.length} dòng · ${phuDe}`;
  ws2.getCell(2, 1).font = { italic: true, size: 10, color: { argb: 'FF6B7280' } };
  ws2.getCell(2, 1).alignment = { horizontal: 'center' };
  cot2.forEach(([h], i) => oTieuDe(ws2.getCell(4, i + 1), h));
  ws2.views = [{ state: 'frozen', ySplit: 4 }];
  chiTiet.forEach((x, i) => {
    cot2.forEach(([, , lay, laSo], j) => {
      const cell = ws2.getCell(5 + i, j + 1);
      cell.value = lay(x, i);
      cell.border = VIEN;
      cell.alignment = { vertical: 'middle', horizontal: laSo ? 'right' : 'left' };
      if (laSo) cell.numFmt = SO;
      if (i % 2) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F9FB' } };
    });
  });

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `bao-cao-phan-loai-loi-${data.tu_ngay}${data.den_ngay !== data.tu_ngay ? `_${data.den_ngay}` : ''}.xlsx`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
