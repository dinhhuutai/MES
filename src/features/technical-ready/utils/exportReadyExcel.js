// Xuất Excel danh sách "CHUẨN BỊ KỸ THUẬT (READY)" — theo đúng danh sách ĐANG LỌC trên màn hình.
// Kèm NGƯỜI + GIỜ xác nhận từng mục (Film / Khuôn / Mực).
// Định dạng sẵn: tiêu đề, header tô nền + gộp nhóm, viền, zebra, ✓ xanh, hạn giao trễ tô đỏ. Lazy import exceljs.

import { khuonRequired } from '../constants';

const pad = (n) => String(n).padStart(2, '0');
const reqCount = (r) => (khuonRequired(r.ten_khach_hang) ? 3 : 2);
const fmtDMY = (s) => { if (!s) return ''; const x = new Date(s); return Number.isNaN(+x) ? '' : `${pad(x.getDate())}/${pad(x.getMonth() + 1)}/${x.getFullYear()}`; };
const fmtDT = (s) => {
  if (!s) return '';
  const x = new Date(s);
  return Number.isNaN(+x) ? '' : `${pad(x.getDate())}/${pad(x.getMonth() + 1)}/${x.getFullYear()} ${pad(x.getHours())}:${pad(x.getMinutes())}`;
};
const daysDiff = (s) => {
  if (!s) return null;
  const h = new Date(s); h.setHours(0, 0, 0, 0);
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.round((h - t) / 86400000);
};

const STATUS_LABEL = { CHUA: 'Chưa làm', DANG: 'Đang chuẩn bị', CHO_QC: 'Chờ QC', DONE: 'Hoàn thành' };
const STATUS_COLOR = { CHUA: 'FF9CA3AF', DANG: 'FFB45309', CHO_QC: 'FF0058BE', DONE: 'FF16A34A' };

// `grp` = nhãn nhóm ở hàng header trên (gộp ô cho Film/Khuôn/Mực).
const COLS = [
  { h: 'STT', w: 6, key: (r, i) => i + 1, center: true },
  { h: 'Code phần', w: 24, key: (r) => r.ma_phan || '' },
  { h: 'Khách hàng', w: 20, key: (r) => r.ten_khach_hang || '' },
  { h: 'Đơn hàng', w: 16, key: (r) => r.ma_don_hang || '' },
  { h: 'Mã hàng', w: 16, key: (r) => r.ma_hang || '' },
  { h: 'Màu vải', w: 16, key: (r) => r.mau_vai || '' },
  { h: 'Kích vải', w: 12, key: (r) => r.kich_vai || '' },
  { h: 'Kích phim', w: 12, key: (r) => r.kich_phim || '' },
  { h: 'Loại đợt vải', w: 14, key: (r) => r.loai_dot_vai || '' },
  // --- FILM ---
  { h: 'XN', w: 6, grp: 'FILM', center: true, key: (r) => (r.film_done ? '✓' : '–'), done: (r) => r.film_done },
  { h: 'Người xác nhận', w: 20, grp: 'FILM', key: (r) => r.film_nguoi || '' },
  { h: 'Giờ xác nhận', w: 17, grp: 'FILM', center: true, key: (r) => fmtDT(r.film_tg) },
  // --- KHUÔN (khách II/AD không cần) ---
  { h: 'XN', w: 6, grp: 'KHUÔN', center: true,
    key: (r) => (!khuonRequired(r.ten_khach_hang) ? '—' : r.khuon_done ? '✓' : '–'),
    done: (r) => khuonRequired(r.ten_khach_hang) && r.khuon_done },
  { h: 'Người xác nhận', w: 20, grp: 'KHUÔN', key: (r) => (khuonRequired(r.ten_khach_hang) ? r.khuon_nguoi || '' : '') },
  { h: 'Giờ xác nhận', w: 17, grp: 'KHUÔN', center: true, key: (r) => (khuonRequired(r.ten_khach_hang) ? fmtDT(r.khuon_tg) : '') },
  // --- MỰC ---
  { h: 'XN', w: 6, grp: 'MỰC', center: true, key: (r) => (r.muc_done ? '✓' : '–'), done: (r) => r.muc_done },
  { h: 'Người xác nhận', w: 20, grp: 'MỰC', key: (r) => r.muc_nguoi || '' },
  { h: 'Giờ xác nhận', w: 17, grp: 'MỰC', center: true, key: (r) => fmtDT(r.muc_tg) },
  // --- Kết ---
  { h: 'Tiến độ KT', w: 13, center: true, key: (r) => `${r.n_tech_done || 0}/${reqCount(r)} mục`, tienDo: true },
  { h: 'Trạng thái', w: 16, center: true, key: (r) => STATUS_LABEL[r.trang_thai_ready] || 'Chưa làm', tt: true },
  { h: 'Hạn giao', w: 14, center: true, key: (r) => fmtDMY(r.han_giao_hang), han: true },
  { h: 'Thời gian ERP (qua READY)', w: 22, center: true, key: (r) => fmtDT(r.tg_qua_ready) },
];

export default async function exportReadyExcel(rows, fileName = 'chuan-bi-ky-thuat-ready') {
  const ExcelJS = (await import('exceljs')).default || (await import('exceljs'));
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('READY');
  ws.columns = COLS.map((c) => ({ width: c.w }));
  const N = COLS.length;

  const thin = { style: 'thin', color: { argb: 'FFD0D5DD' } };
  const border = { top: thin, left: thin, bottom: thin, right: thin };

  // Tiêu đề
  ws.mergeCells(1, 1, 1, N);
  const t = ws.getCell(1, 1);
  t.value = 'DANH SÁCH CHUẨN BỊ KỸ THUẬT (READY)';
  t.font = { bold: true, size: 15, color: { argb: 'FF0058BE' } };
  t.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 26;

  // Phụ đề: ngày xuất + số dòng
  ws.mergeCells(2, 1, 2, N);
  const sub = ws.getCell(2, 1);
  sub.value = `Xuất ngày ${fmtDMY(new Date())} · ${rows.length} phần in`;
  sub.font = { italic: true, size: 10, color: { argb: 'FF6B7280' } };
  sub.alignment = { horizontal: 'center' };

  // Header 2 tầng. Cột KHÔNG thuộc nhóm sẽ GỘP DỌC 2 hàng → ô gộp chỉ hiện giá trị ô TRÊN CÙNG,
  // nên tiêu đề của chúng phải đặt ở HÀNG TRÊN (hàng dưới để rỗng). Cột thuộc nhóm: trên = tên nhóm, dưới = tên cột.
  const grpRow = ws.addRow(COLS.map((c) => (c.grp ? c.grp : c.h)));
  grpRow.height = 20;
  const head = ws.addRow(COLS.map((c) => (c.grp ? c.h : '')));
  head.height = 24;
  const grpIdx = grpRow.number;
  const headIdx = head.number;

  const styleHead = (cell, dark) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: dark ? 'FF00408C' : 'FF0058BE' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = border;
  };
  grpRow.eachCell({ includeEmpty: true }, (cell, col) => styleHead(cell, !!COLS[col - 1].grp));
  head.eachCell({ includeEmpty: true }, (cell) => styleHead(cell, false));

  // Gộp ô: cột KHÔNG thuộc nhóm → gộp dọc 2 hàng; cột cùng nhóm → gộp ngang ở hàng nhóm.
  let c = 1;
  while (c <= N) {
    const g = COLS[c - 1].grp;
    if (!g) { ws.mergeCells(grpIdx, c, headIdx, c); c += 1; continue; }
    let e = c;
    while (e < N && COLS[e].grp === g) e += 1;
    ws.mergeCells(grpIdx, c, grpIdx, e);
    c = e + 1;
  }

  rows.forEach((r, i) => {
    const row = ws.addRow(COLS.map((col) => col.key(r, i)));
    const zebra = i % 2 === 1;
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      const cd = COLS[col - 1];
      cell.border = border;
      cell.alignment = { vertical: 'middle', horizontal: cd.center ? 'center' : 'left', wrapText: false };
      if (zebra) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF6F8FB' } };
      if (cd.done) cell.font = { bold: true, color: { argb: cd.done(r) ? 'FF16A34A' : 'FF9CA3AF' } }; // ✓ xanh / – xám
      if (cd.tienDo) cell.font = { bold: true, color: { argb: r.tech_done ? 'FF16A34A' : 'FFB45309' } };
      if (cd.tt) cell.font = { bold: true, color: { argb: STATUS_COLOR[r.trang_thai_ready] || 'FF9CA3AF' } };
      if (cd.han) {
        const d = daysDiff(r.han_giao_hang);
        if (d != null && d < 0) cell.font = { bold: true, color: { argb: 'FFDC2626' } };      // trễ → đỏ
        else if (d != null && d <= 1) cell.font = { bold: true, color: { argb: 'FFB45309' } }; // gấp → cam
      }
    });
  });

  // Đóng băng 2 hàng header (không đặt autoFilter: header có ô GỘP DỌC nên Excel lọc/sắp xếp sẽ báo lỗi ô gộp).
  ws.views = [{ state: 'frozen', ySplit: headIdx }];

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = `${new Date().getFullYear()}${pad(new Date().getMonth() + 1)}${pad(new Date().getDate())}`;
  a.href = url; a.download = `${fileName}-${stamp}.xlsx`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
