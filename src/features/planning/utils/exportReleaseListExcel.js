// Xuất Excel "DANH SÁCH RELEASE" — bám ĐÚNG bố cục form giấy (tiêu đề + dòng tổng + bảng).
// Lazy import exceljs để không phình bundle chính.
//
// ⚠ SỐ DÒNG ĐẾM THEO ĐỢT SẢN XUẤT: lệnh gom set ra nhiều dòng (1 dòng/phần in) nhưng các ô ở MỨC LỆNH
//   (STT · CHUYỀN · SL ĐÃ IN · SL ĐÃ GIAO · OWNER · GIỜ BD · GIỜ KT · XÁC NHẬN) được **mergeCells**
//   trên các dòng của cùng 1 đợt ⇒ mở Excel ra nhìn giống hệt bảng trên màn hình và bản in giấy.
//   Dùng chung `gopTheoLenh` với modal + bản in.
import { gopTheoLenh, demLenh } from './gopDongRelease';

const HEADERS = [
  'STT', 'CHUYỀN', 'KH', 'PO', 'MÃ', 'CODE PHẦN', 'Màu vải', 'Kích vải', 'Kích phim',
  'SLĐH', 'SLNV', 'SL ĐÃ IN', 'SL ĐÃ GIAO', 'SL RELEASE',
  'OWNER', 'GIỜ BD', 'GIỜ KT', 'XÁC NHẬN RELEASE',
];
const WIDTHS = [5, 10, 8, 15, 22, 18, 20, 12, 14, 9, 9, 10, 11, 11, 12, 10, 10, 16];
const NUM_COLS = [1, 10, 11, 12, 13, 14]; // căn phải: STT + SLĐH..SL RELEASE
// Cột ở MỨC LỆNH (1-indexed theo HEADERS) — merge dọc trên các dòng của cùng 1 đợt SX.
const COT_GOP = [1, 2, 12, 13, 15, 16, 17, 18];

const pad = (n) => String(n).padStart(2, '0');
const fmtDMY = (s) => { if (!s) return ''; const x = new Date(s); return Number.isNaN(+x) ? '' : `${pad(x.getDate())}/${pad(x.getMonth() + 1)}/${x.getFullYear()}`; };
// Giờ 12h AM/PM giống form ("7:30 AM").
const fmtClock = (ts) => {
  if (!ts) return '';
  const x = new Date(ts); if (Number.isNaN(+x)) return '';
  let h = x.getHours(); const m = x.getMinutes(); const ap = h < 12 ? 'AM' : 'PM';
  h = h % 12; if (h === 0) h = 12;
  return `${h}:${pad(m)} ${ap}`;
};

export default async function exportReleaseListExcel(items, meta, fileName = 'danh-sach-release') {
  const ExcelJS = (await import('exceljs')).default || (await import('exceljs'));
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Danh sách release');
  ws.columns = WIDTHS.map((w) => ({ width: w }));
  const N = HEADERS.length;

  const thin = { style: 'thin', color: { argb: 'FFD0D5DD' } };
  const border = { top: thin, left: thin, bottom: thin, right: thin };

  // Tiêu đề
  ws.mergeCells(1, 1, 1, N);
  const t = ws.getCell(1, 1);
  t.value = `DANH SÁCH RELEASE ${meta?.mode === 'RELEASE' ? '— NGÀY RELEASE' : 'NGÀY'} ${fmtDMY(meta?.ngay)}`;
  t.font = { bold: true, size: 15 };
  t.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 24;

  // Dòng tổng
  const sum = ws.addRow([
    'TỔNG ĐƠN', meta?.tong_don ?? 0, 'TỔNG MÃ', meta?.tong_ma ?? 0,
    'TỔNG PHẦN', meta?.tong_phan ?? 0, 'ĐỢT SX', demLenh(items),
    'SL RELEASE', meta?.sl_release ?? 0,
  ]);
  sum.eachCell((c) => { c.font = { bold: true }; c.alignment = { vertical: 'middle' }; });

  ws.addRow([]); // spacer

  // Header bảng
  const head = ws.addRow(HEADERS);
  head.height = 26;
  head.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FF111827' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF2F7' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = border;
  });

  const ds = gopTheoLenh(items);
  const dongDau = [];   // [{ r, rowNumber }] của các dòng ĐẦU mỗi đợt SX → merge sau khi ghi hết
  for (const r of ds) {
    const row = ws.addRow([
      // STT + các ô mức LỆNH chỉ ghi giá trị ở DÒNG ĐẦU của đợt; dòng sau để trống rồi merge lên.
      r._dau ? r._stt : '', r._dau ? (r.ten_chuyen || '') : '',
      r.ten_khach_hang || '', r.ma_don_hang || '', r.ten_ma_hang || r.ma_hang || '',
      r.ma_phan || '', r.mau_vai || '', r.kich_vai || '', r.kich_phim || '',
      r.so_luong_don_hang ?? '', r.slnv ?? 0,
      // ⚠ SL ĐÃ IN / ĐÃ GIAO chỉ tính được ở mức LỆNH ⇒ ghi 1 lần rồi merge, KHÔNG lặp số ở từng dòng
      //   (lặp là sẽ có người cộng dồn cột này thành số sai).
      r._dau && r.sl_da_in != null ? r.sl_da_in : '',
      r._dau && r.sl_da_giao != null ? r.sl_da_giao : '',
      r.sl_release_phan ?? r.so_luong_release ?? 0,
      '', r._dau ? fmtClock(r.tg_bd_kh) : '', r._dau ? fmtClock(r.tg_kt_kh) : '', '',
    ]);
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.border = border;
      cell.alignment = { vertical: 'middle', horizontal: NUM_COLS.includes(col) ? 'right' : 'left', wrapText: false };
    });
    if (r._dau) dongDau.push({ r, rowNumber: row.number });
  }

  // Merge dọc các cột mức LỆNH cho đợt SX có >1 phần in.
  // ⚠ `_span` đã được `gopTheoLenh` tính trên tập ĐANG XUẤT (sau bộ lọc) nên không merge lố sang đợt kế.
  for (const { r, rowNumber } of dongDau) {
    if (r._span <= 1) continue;
    for (const col of COT_GOP) ws.mergeCells(rowNumber, col, rowNumber + r._span - 1, col);
  }

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${fileName}-${(meta?.ngay || '').replace(/-/g, '')}.xlsx`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
