// Xuất Excel BÁO CÁO BẤT THƯỜNG DỪNG CHUYỀN (02/10/2026) — 2 sheet:
//   · "Tổng hợp": dải số tổng + bảng THEO NGUYÊN NHÂN + bảng THEO CHUYỀN.
//   · "Chi tiết": 1 dòng / 1 lần dừng.
// Cùng kiểu trình bày với `components/common/exportPanelExcel` (header nền #0058BE chữ trắng, viền mảnh,
// zebra). Ghi SỐ THẬT (phút, giờ, %) + numFmt để người dùng cộng/lọc tiếp được trong Excel.
// ⚠ `exceljs` LAZY import (bundle chính không kéo theo).

const XANH = 'FF0058BE';
const vien = { style: 'thin', color: { argb: 'FFD0D5DD' } };
const VIEN = { top: vien, left: vien, bottom: vien, right: vien };

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

function dongDuLieu(ws, cols, rows) {
  rows.forEach((x, i) => {
    const r = ws.addRow(cols.map((c) => c.value(x, i)));
    r.eachCell({ includeEmpty: true }, (cell, j) => {
      const c = cols[j - 1];
      cell.border = VIEN;
      cell.alignment = { vertical: 'middle', horizontal: c.num ? 'right' : (c.center ? 'center' : 'left'), wrapText: !!c.wrap };
      if (c.fmt) cell.numFmt = c.fmt;
      if (c.red && c.red(x)) cell.font = { color: { argb: 'FFDC2626' }, bold: true };
      if (i % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F9FB' } };
    });
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
}

function nhanMuc(ws, chu) {
  ws.addRow([]);
  const r = ws.addRow([chu]);
  r.getCell(1).font = { bold: true, size: 12, color: { argb: 'FF111827' } };
}

const STT = { header: 'STT', width: 6, center: true, value: (_, i) => i + 1 };
const PHAN_TRAM = '0.0%';
const GIO = '#,##0.00';

export default async function exportBaoCaoDungChuyen(data, { moTaLoc = '' } = {}) {
  const ExcelJS = (await import('exceljs')).default || (await import('exceljs'));
  const wb = new ExcelJS.Workbook();
  const khoang = data.tu_ngay === data.den_ngay
    ? `ngày SX ${ngayVN(data.tu_ngay)}` : `ngày SX ${ngayVN(data.tu_ngay)} → ${ngayVN(data.den_ngay)}`;
  const phuDe = `${khoang} (06:00 → 06:00) · xuất lúc ${new Date().toLocaleString('vi-VN')}${moTaLoc ? ` · lọc: ${moTaLoc}` : ''}`;

  // ── Sheet 1: Tổng hợp ──────────────────────────────────────────────────────
  const cotLyDo = [
    STT,
    { header: 'Mã', width: 12, value: (x) => x.ma_ly_do || '' },
    { header: 'Nguyên nhân', width: 34, value: (x) => x.nguyen_nhan || '' },
    { header: 'Số lần', width: 10, num: true, value: (x) => x.so_lan },
    { header: 'Tổng phút', width: 12, num: true, fmt: '#,##0', value: (x) => x.so_phut },
    { header: 'Tổng giờ', width: 11, num: true, fmt: GIO, value: (x) => x.so_phut / 60 },
    { header: '% thời gian', width: 12, num: true, fmt: PHAN_TRAM, value: (x) => x.ty_le },
    { header: 'Chuyền', width: 30, wrap: true, value: (x) => x.chuyen || '' },
  ];
  const cotChuyen = [
    STT,
    { header: 'Chuyền', width: 12, value: (x) => x.ma_chuyen || '—' },
    { header: 'Tên chuyền', width: 34, value: (x) => x.ten_chuyen || '' },
    { header: 'Loại chuyền', width: 10, value: (x) => x.loai_chuyen || '' },
    { header: 'Số lần', width: 12, num: true, value: (x) => x.so_lan },
    { header: 'Tổng phút', width: 11, num: true, fmt: '#,##0', value: (x) => x.so_phut },
    { header: 'Tổng giờ', width: 12, num: true, fmt: GIO, value: (x) => x.so_phut / 60 },
    { header: 'Nguyên nhân chính', width: 30, value: (x) => x.nguyen_nhan_chinh || '' },
  ];
  const ws1 = wb.addWorksheet('Tổng hợp');
  ws1.columns = cotLyDo.map((c, i) => ({ width: Math.max(c.width, (cotChuyen[i] || {}).width || 0) }));
  dauTrang(ws1, cotLyDo.length, 'BÁO CÁO BẤT THƯỜNG DỪNG CHUYỀN — TỔNG HỢP', phuDe);
  ws1.addRow([]);
  [
    ['Số lần dừng', data.tong.so_lan, '#,##0'],
    ['Tổng thời gian dừng (phút)', data.tong.so_phut, '#,##0'],
    ['Tổng thời gian dừng (giờ)', data.tong.so_phut / 60, GIO],
    ['Số chuyền bị dừng', data.tong.so_chuyen, '#,##0'],
    ['Chưa bấm "Chuyền hoạt động lại"', data.tong.chua_ket_thuc, '#,##0'],
  ].forEach(([nhan, so, fmt]) => {
    const r = ws1.addRow([nhan, '', '', so]);
    ws1.mergeCells(r.number, 1, r.number, 3);
    r.getCell(1).font = { bold: true };
    r.getCell(4).numFmt = fmt;
    r.getCell(4).font = { bold: true, color: { argb: XANH } };
  });
  nhanMuc(ws1, 'Theo nguyên nhân');
  tieuDeBang(ws1, cotLyDo);
  dongDuLieu(ws1, cotLyDo, data.theo_ly_do || []);
  nhanMuc(ws1, 'Theo chuyền');
  tieuDeBang(ws1, cotChuyen);
  dongDuLieu(ws1, cotChuyen, data.theo_chuyen || []);

  // ── Sheet 2: Chi tiết ──────────────────────────────────────────────────────
  const cotCT = [
    STT,
    { header: 'Ngày SX', width: 12, center: true, value: (x) => ngayVN(x.ngay_sx) },
    { header: 'Ca', width: 12, center: true, value: (x) => x.ca || '' },
    { header: 'Chuyền', width: 12, value: (x) => x.ma_chuyen || '' },
    { header: 'Tổ in', width: 10, value: (x) => x.ma_to || '' },
    { header: 'Bắt đầu', width: 20, center: true, value: (x) => gioVN(x.tg_bd) },
    { header: 'Kết thúc', width: 20, center: true, value: (x) => (x.chua_ket_thuc ? 'Chưa hoạt động lại' : gioVN(x.tg_kt)),
      red: (x) => x.chua_ket_thuc },
    { header: 'Thời gian (phút)', width: 12, num: true, fmt: '#,##0', value: (x) => x.so_phut },
    { header: 'Mã nguyên nhân', width: 14, value: (x) => x.ma_ly_do || '' },
    { header: 'Nguyên nhân', width: 30, value: (x) => x.nguyen_nhan || '' },
    { header: 'Ghi chú', width: 36, wrap: true, value: (x) => x.ghi_chu || '' },
    { header: 'Mã lệnh', width: 14, value: (x) => x.ma_lenh_san_xuat || '' },
    { header: 'Code phần', width: 26, value: (x) => x.ma_phan || '' },
    { header: 'Khách hàng', width: 16, value: (x) => x.khach || '' },
    { header: 'Đơn hàng', width: 18, value: (x) => x.po || '' },
    { header: 'Mã hàng', width: 18, value: (x) => x.ma_hang || '' },
    { header: 'Màu vải', width: 16, value: (x) => x.mau_vai || '' },
    { header: 'Người ghi', width: 20, value: (x) => x.nguoi_ghi || '' },
    { header: 'Người cho hoạt động lại', width: 22, value: (x) => x.nguoi_ket_thuc || '' },
  ];
  const ws2 = wb.addWorksheet('Chi tiết');
  ws2.columns = cotCT.map((c) => ({ width: c.width }));
  dauTrang(ws2, cotCT.length, 'BÁO CÁO BẤT THƯỜNG DỪNG CHUYỀN — CHI TIẾT', `${(data.chi_tiet || []).length} lần dừng · ${phuDe}`);
  tieuDeBang(ws2, cotCT);
  ws2.views = [{ state: 'frozen', ySplit: ws2.rowCount }];
  dongDuLieu(ws2, cotCT, data.chi_tiet || []);

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `bao-cao-dung-chuyen-${data.tu_ngay}${data.den_ngay !== data.tu_ngay ? `_${data.den_ngay}` : ''}.xlsx`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
