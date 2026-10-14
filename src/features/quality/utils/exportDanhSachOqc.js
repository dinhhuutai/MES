// ─────────────────────────────────────────────────────────────────────────────
// XUẤT EXCEL "DANH SÁCH KIỂM TRA CHẤT LƯỢNG ĐẦU RA QCO" — đúng khuôn tờ người dùng gửi (14/10/2026), cho sidebar
// "Đã hoàn thành" của màn OQC (1 dòng / lượt OQC đang lọc).
//   Dòng 1 tên công ty · dòng 2 tiêu đề (nền xanh lá, gộp ngang) · dòng 3 "Từ ngày … Đến ngày …" ·
//   dòng 5 nhóm cột (Hàng hóa · In · Kết quả kiểm bốc mẫu · Phân loại · Chi tiết lỗi · Thông tin hàng in) ·
//   dòng 6 tên cột · dòng 7 hàng tiêu đề có NÚT LỌC (như tờ mẫu) · dữ liệu từ dòng 8.
// Nghĩa cột (tự chốt — chờ người dùng xác nhận):
//   · Số CT  = IDMES lượt OQC đã gửi ERP (khóa `soctcu` bên ERP); lượt chưa gửi được ⇒ trống.
//   · Barcode = mã tem ĐÚNG NHƯ NHÃN (15/17/13) · Lô sản xuất = mã lô tem (mig 114; tem 17 lấy lô tem gốc).
//   · In = SL in của tem (tem 17 = SL lô sửa) · Kiểm = lô qua OQC của lượt (`sl_qua_giao`; lượt không đạt nằm lại ⇒ trống)
//     · Còn lại = In − Kiểm (khi > 0).
//   · Kết quả kiểm bốc mẫu: Số lượng = SL bốc mẫu · SL Đạt = mẫu đạt · SL lỗi = mẫu lỗi. "Kiểu" + "Phân loại (lỗi nặng ·
//     lỗi nhẹ · hủy)" + "Chi tiết lỗi" MES CHƯA GHI NHẬN ở màn OQC ⇒ để trống (ghi tay được).
//   · Đánh giá = Đạt / Không đạt / Không đạt — giao ngoại lệ.
//   · Thông tin hàng in: Tổ (tổ in phiếu) · Chuyền in (mã ERP) · Dây chuyền (MTD/Banin/RB/MT/LG/MEP) · Ngày in (ngày ca
//     tem) · Loại ca (đuôi mã ngày ca) · Chuyền trưởng · KCS (người kiểm KCS gần nhất của tem) · Ghi chú = "giờ OQC LẦN n"
//     + ghi chú OQC (tờ mẫu ghi "10:50 LẦN 2").
// Lazy import exceljs để không phình bundle chính.
// ─────────────────────────────────────────────────────────────────────────────
import { chuanMaChuyen } from '../../../utils/maChuyen';
import { ngayLocalISO } from '../../../utils/format';

const so = (v) => (v == null || v === '' ? null : Number(v));
const soKhac0 = (v) => { const n = so(v); return n ? n : null; };
// Ngày (chuỗi ISO có giờ / Date / 'YYYY-MM-DD') ⇒ Date 00:00 UTC theo NGÀY giờ trình duyệt (exceljs ghi đúng ngày).
const ngayExcel = (v) => {
  if (!v) return null;
  const s = typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : ngayLocalISO(v);
  const [y, m, d] = String(s || '').split('-').map(Number);
  return y && m && d ? new Date(Date.UTC(y, m - 1, d)) : null;
};
const gioPhut = (v) => {
  if (!v) return '';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '' : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const dmy = (s) => (s ? String(s).slice(0, 10).split('-').reverse().join('/') : '');
const loaiCa = (maNgayCa) => {
  const m = /^\d{6}(.+)$/.exec(String(maNgayCa || '').trim());
  return m ? m[1] : '';
};
const danhGia = (r) => {
  if (r.ket_qua === 'DAT') return 'Đạt';
  if (r.cho_giao) return 'Không đạt — giao ngoại lệ';
  return r.ket_qua ? 'Không đạt' : '';
};
const slIn = (r) => (r.la_tem_sua ? so(r.sl_kcs_dat_tem) : so(r.sl_in_tem));

// Nhóm cột (dòng 5) — `n` = số cột của nhóm; nhóm 1 cột thì tiêu đề gộp DỌC 2 dòng 5–6.
const COT = [
  { h: 'Mục', w: 5, v: (r, i) => i + 1, so: true },
  { h: 'Số CT', w: 12, v: (r) => (r.id_mes ? String(r.id_mes) : '') },
  { h: 'Ngày', w: 11, v: (r) => ngayExcel(r.tg), ngay: true },
  { h: 'Khách hàng', w: 8, v: (r) => r.ten_khach_hang },
  { h: 'Đơn hàng', w: 16, v: (r) => r.ma_don_hang },
  { h: 'Mã hàng', w: 20, v: (r) => r.ma_hang, nhom: 'Hàng hóa' },
  { h: 'Màu vải', w: 14, v: (r) => r.mau_vai, nhom: 'Hàng hóa' },
  { h: 'Kích vải', w: 10, v: (r) => r.kich_vai, nhom: 'Hàng hóa' },
  { h: 'Kích phim', w: 12, v: (r) => r.kich_phim, nhom: 'Hàng hóa' },
  { h: 'Màu in', w: 12, v: (r) => r.mau_in, nhom: 'Hàng hóa' },
  { h: 'Độ in', w: 6, v: (r) => r.do_in, nhom: 'Hàng hóa' },
  { h: 'TCI', w: 6, v: (r) => r.tinh_chat_in, nhom: 'Hàng hóa' },
  { h: 'Barcode', w: 14, v: (r, i, ma) => ma(r) },
  { h: 'Lô sản xuất', w: 14, v: (r) => r.ma_lo },
  { h: 'SLĐH', w: 8, v: (r) => so(r.so_luong_don_hang), so: true },
  { h: 'In', w: 7, v: (r) => slIn(r), so: true, nhom: 'In' },
  { h: 'Kiểm', w: 7, v: (r) => soKhac0(r.sl_qua_giao), so: true, nhom: 'In' },
  { h: 'Còn lại', w: 7, v: (r) => { const a = slIn(r); const b = soKhac0(r.sl_qua_giao); return a != null && b != null && a - b > 0 ? a - b : null; }, so: true, nhom: 'In' },
  { h: 'Kiểu', w: 6, v: () => '', nhom: 'Kết quả kiểm bốc mẫu' },
  { h: 'Số lượng', w: 8, v: (r) => so(r.so_luong_kiem), so: true, nhom: 'Kết quả kiểm bốc mẫu' },
  { h: 'SL Đạt', w: 7, v: (r) => so(r.so_luong ?? r.sl_mau_dat), so: true, nhom: 'Kết quả kiểm bốc mẫu' },
  { h: 'SL lỗi', w: 7, v: (r) => soKhac0(r.sl_mau_loi), so: true, nhom: 'Kết quả kiểm bốc mẫu' },
  { h: 'SL lỗi nặng', w: 7, v: () => null, so: true, nhom: 'Phân loại' },
  { h: 'SL lỗi nhẹ', w: 7, v: () => null, so: true, nhom: 'Phân loại' },
  { h: 'SL hủy', w: 7, v: () => null, so: true, nhom: 'Phân loại' },
  { h: 'Đánh giá', w: 10, v: (r) => danhGia(r), nhom: 'Phân loại' },
  { h: 'Mã lỗi', w: 8, v: () => '', nhom: 'Chi tiết lỗi' },
  { h: 'Tên lỗi', w: 12, v: () => '', nhom: 'Chi tiết lỗi' },
  { h: 'Số lượng', w: 8, v: () => null, so: true, nhom: 'Chi tiết lỗi' },
  { h: 'Nhân viên kiểm', w: 20, v: (r) => r.nguoi },
  { h: 'Tổ', w: 6, v: (r) => r.ma_to, nhom: 'Thông tin hàng in' },
  { h: 'Chuyền in', w: 8, v: (r) => (r.ma_chuyen ? chuanMaChuyen(r.ma_chuyen) : ''), nhom: 'Thông tin hàng in' },
  { h: 'Dây chuyền', w: 8, v: (r) => r.day_chuyen, nhom: 'Thông tin hàng in' },
  { h: 'Ngày in', w: 11, v: (r) => ngayExcel(r.ngay_ca || r.ngay_in_tem), ngay: true, nhom: 'Thông tin hàng in' },
  { h: 'Loại ca', w: 6, v: (r) => loaiCa(r.ma_ngay_ca), nhom: 'Thông tin hàng in' },
  { h: 'Chuyền trưởng', w: 16, v: (r) => r.chuyen_truong, nhom: 'Thông tin hàng in' },
  { h: 'KCS', w: 16, v: (r) => r.nguoi_kcs, nhom: 'Thông tin hàng in' },
  {
    h: 'Ghi chú', w: 22, nhom: 'Thông tin hàng in',
    v: (r) => [gioPhut(r.tg), Number(r.lan_kiem_cua_phan) > 0 ? `LẦN ${r.lan_kiem_cua_phan}` : '', r.ghi_chu_oqc || '']
      .filter(Boolean).join(' '),
  },
];
export const SO_COT_OQC = COT.length;

/**
 * @param {Array} rows   dòng "Đã hoàn thành" của màn OQC (đang lọc)
 * @param {{tuNgay: string, denNgay?: string, maTem: (r) => string}} o  `maTem` = hàm hiện mã tem như nhãn (của trang)
 */
export default async function exportDanhSachOqc(rows, { tuNgay, denNgay, maTem }, fileName = 'danh-sach-kiem-tra-oqc') {
  const ExcelJS = (await import('exceljs')).default || (await import('exceljs'));
  const ma = maTem || ((r) => r.ma || '');
  // Tờ mẫu xếp theo thời gian tăng dần (panel đang mới → cũ).
  const ds = [...(rows || [])].sort((a, b) => new Date(a.tg) - new Date(b.tg));
  const N = COT.length;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('QCO', { views: [{ state: 'frozen', ySplit: 7, xSplit: 0 }] });
  ws.columns = COT.map((c) => ({ width: c.w }));
  const thin = { style: 'thin', color: { argb: 'FF808080' } };
  const border = { top: thin, left: thin, bottom: thin, right: thin };
  const giua = { horizontal: 'center', vertical: 'middle', wrapText: true };

  ws.getCell(1, 1).value = 'CÔNG TY TNHH THUẬN HƯNG LONG AN';
  ws.getCell(1, 1).font = { bold: true, size: 11 };
  ws.mergeCells(2, 1, 2, N);
  ws.getCell(2, 1).value = 'DANH SÁCH KIỂM TRA CHẤT LƯỢNG ĐẦU RA QCO';
  ws.getCell(2, 1).font = { bold: true, size: 14, color: { argb: 'FFC00000' } };
  ws.getCell(2, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF92D050' } };
  ws.getCell(2, 1).alignment = giua;
  ws.getRow(2).height = 26;
  ws.mergeCells(3, 1, 3, N);
  ws.getCell(3, 1).value = `Từ ngày ${dmy(tuNgay)} Đến ngày ${dmy(denNgay || tuNgay)}`;
  ws.getCell(3, 1).alignment = giua;

  // Dòng 5–6: nhóm cột + tên cột. Cột không nhóm gộp dọc 5–6.
  let i = 0;
  while (i < N) {
    const c = COT[i];
    if (!c.nhom) {
      ws.mergeCells(5, i + 1, 6, i + 1);
      ws.getCell(5, i + 1).value = c.h;
      i += 1;
    } else {
      let j = i;
      while (j + 1 < N && COT[j + 1].nhom === c.nhom) j += 1;
      if (j > i) ws.mergeCells(5, i + 1, 5, j + 1);
      ws.getCell(5, i + 1).value = c.nhom;
      for (let k = i; k <= j; k += 1) ws.getCell(6, k + 1).value = COT[k].h;
      i = j + 1;
    }
  }
  for (let r = 5; r <= 7; r += 1) {
    for (let c = 1; c <= N; c += 1) {
      const cell = ws.getCell(r, c);
      cell.font = { bold: true, size: 9 };
      cell.alignment = giua;
      cell.border = border;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: r === 7 ? 'FFFFFFFF' : 'FFF2F2F2' } };
    }
  }
  ws.getRow(5).height = 18;
  ws.getRow(6).height = 30;
  // Dòng 7: hàng tiêu đề có nút lọc (như tờ mẫu — tên cột lặp lại).
  COT.forEach((c, k) => { ws.getCell(7, k + 1).value = c.h; });
  ws.autoFilter = { from: { row: 7, column: 1 }, to: { row: 7, column: N } };

  ds.forEach((r, idx) => {
    const row = ws.addRow(COT.map((c) => {
      const v = c.v(r, idx, ma);
      if (c.ngay) return v || null;
      if (c.so) return v == null || v === '' ? null : Number(v);
      return v == null ? '' : String(v);
    }));
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      const c = COT[col - 1];
      if (!c) return;
      cell.border = border;
      cell.font = { size: 9 };
      cell.alignment = { vertical: 'middle', horizontal: c.so || c.ngay ? 'right' : 'left', wrapText: !c.so && !c.ngay };
      if (c.ngay) cell.numFmt = 'dd/mm/yyyy';
      if (c.so) cell.numFmt = '#,##0';
    });
  });

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${fileName}-${String(tuNgay || '').replace(/-/g, '')}.xlsx`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
