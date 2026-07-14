// Xuất Excel màn "Danh sách phần in vải về" — chip "Tất cả".
// Bám ĐÚNG bố cục bảng trên màn: mỗi phần in tách max(đợt vải, đợt SX) hàng;
// khối định danh (Khách→SL đơn) GỘP Ô (rowspan); khối đợt vải & khối đợt SX theo từng hàng.
// Lazy import exceljs để không phình bundle chính.

const HEADERS = [
  'STT', 'Khách hàng', 'Đơn hàng', 'Mã hàng', 'Màu vải', 'Kích vải', 'Kích phim', 'SL đơn hàng',
  'SL vải về', 'Ngày vải về', 'Hạn giao',
  'Đợt SX', 'SL in', 'Kiểm đạt', 'Sửa', 'Sửa đạt', 'OQC xác nhận', 'TT OQC', 'SL giao',
];
const WIDTHS = [5, 22, 16, 14, 12, 11, 11, 11, 11, 13, 13, 16, 9, 10, 8, 9, 18, 12, 10];
const IDENTITY_COLS = 8; // 8 cột đầu gộp ô theo phần in

const pad = (n) => String(n).padStart(2, '0');
const fmtDate = (d) => { if (!d) return ''; const x = new Date(d); return Number.isNaN(x) ? '' : `${pad(x.getDate())}/${pad(x.getMonth() + 1)}/${x.getFullYear()}`; };
const fmtDateTime = (d) => { if (!d) return ''; const x = new Date(d); return Number.isNaN(x) ? '' : `${pad(x.getDate())}/${pad(x.getMonth() + 1)}/${x.getFullYear()} ${pad(x.getHours())}:${pad(x.getMinutes())}`; };
const ttOqc = (v) => (v === 'DAT' ? 'Đạt' : v === 'KHONG_DAT' ? 'Không đạt' : '');

export default async function exportPhanInVaiVeExcel(rows, fileName = 'danh-sach-phan-in-vai-ve') {
  const ExcelJS = (await import('exceljs')).default || (await import('exceljs'));
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Phần in vải về');
  ws.columns = WIDTHS.map((w) => ({ width: w }));

  const thin = { style: 'thin', color: { argb: 'FFD0D5DD' } };
  const border = { top: thin, left: thin, bottom: thin, right: thin };

  // Header
  const head = ws.addRow(HEADERS);
  head.height = 22;
  head.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FF111827' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF2F7' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = border;
  });

  let stt = 0;
  for (const g of rows) {
    stt += 1;
    const dv = (g.dot_vai && g.dot_vai.length) ? g.dot_vai : [];
    const sx = (g.dot_san_xuat && g.dot_san_xuat.length) ? g.dot_san_xuat : [];
    const R = Math.max(dv.length, sx.length, 1);
    const startRow = ws.rowCount + 1;

    for (let i = 0; i < R; i += 1) {
      const d = dv[i]; const s = sx[i];
      const donHang = g.ma_don_hang ? `${g.ma_don_hang}${g.so_po ? ` (${g.so_po})` : ''}` : '';
      const maDot = s ? `${s.ma_lenh_san_xuat || ''}${s.giai_doan === 'EP_UI' ? ' (Ép ủi)' : ''}` : '';
      const values = [
        i === 0 ? stt : '',
        i === 0 ? (g.ten_khach_hang || '') : '',
        i === 0 ? donHang : '',
        i === 0 ? (g.ma_hang || '') : '',
        i === 0 ? (g.mau_vai || '') : '',
        i === 0 ? (g.kich_vai || '') : '',
        i === 0 ? (g.kich_phim || '') : '',
        i === 0 ? (g.so_luong_don_hang ?? '') : '',
        d ? (d.so_luong_vai_ve ?? '') : '',
        d ? fmtDate(d.ngay_vai_ve) : '',
        d ? fmtDate(d.han_giao_hang) : '',
        maDot,
        s ? (s.sl_in ?? '') : '',
        s ? (s.sl_kcs_dat ?? '') : '',
        s ? (s.sl_sua ?? '') : '',
        s ? (s.sl_sua_dat ?? '') : '',
        s ? fmtDateTime(s.tg_oqc) : '',
        s ? ttOqc(s.tt_oqc) : '',
        s ? (s.sl_giao ?? '') : '',
      ];
      const row = ws.addRow(values);
      row.eachCell({ includeEmpty: true }, (cell, col) => {
        cell.border = border;
        const numCol = [1, 8, 9, 13, 14, 15, 16, 19].includes(col);
        cell.alignment = { vertical: 'middle', horizontal: numCol ? 'right' : 'left', wrapText: false };
      });
    }

    // Gộp ô khối định danh (8 cột đầu) theo phần in.
    if (R > 1) {
      for (let c = 1; c <= IDENTITY_COLS; c += 1) {
        try { ws.mergeCells(startRow, c, startRow + R - 1, c); } catch { /* bỏ qua vùng chồng */ }
      }
    }
  }

  ws.views = [{ state: 'frozen', ySplit: 1 }]; // ghim dòng tiêu đề

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url; a.download = `${fileName}-${stamp}.xlsx`; a.click();
  URL.revokeObjectURL(url);
}
