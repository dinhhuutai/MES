// ─────────────────────────────────────────────────────────────────────────────
// XUẤT EXCEL "DANH SÁCH PHIẾU NHẬT KÝ KIỂM PHẨM CHƯA KIỂM" — đúng khuôn tờ ERP người dùng gửi (10/11/2026) cho nút Excel
// màn KCS ("danh sách hàng tồn"). Nguồn: `GET /quality/kcs/ton-chua-kiem` (tem còn phần chưa kiểm theo bộ lọc màn KCS,
// tùy chọn gồm tem đang phơi).
//   Dòng 1 tên công ty · dòng 2 tiêu đề · dòng 3 "Từ ngày … Đến ngày …" · dòng 4 "Giờ dự kiến …" · dòng 5 nhóm cột
//   (Hàng hóa · Số lượng · Thông tin hàng in) · dòng 6 tên cột · dòng 7 tên trường như tờ ERP + NÚT LỌC · dữ liệu từ dòng 8.
// Nghĩa cột (tự chốt — chờ người dùng xác nhận):
//   · Số CT   = IDMES phiếu in tem SF0 đã gửi ERP (ERP lưu ở `soctcu`); tem chưa gửi được ⇒ trống.
//   · Barcode = mã tem 15 · In = SL in · Đã kiểm = đạt + hư + hủy đã KCS · Còn lại = còn phải kiểm (sổ cái `con_kcs`).
//   · Đạt · Không đạt · Thiếu · Dư · Vải hư · Mẫu · Nhân viên kiểm · Ghi chú = ĐỂ TRỐNG (người kiểm ghi tay).
//   · Số phút = Đến giờ − Từ giờ (giờ SX nhập lúc in tem) · Tổ = tổ in · Máy / Bàn = mã chuyền ERP của tem · Thợ = thợ in ·
//     Ca = mã ngày ca · Ngày = ngày ca · GC MV = GC màu vải · Tu Gio / Den Gio = giờ SX ĐÚNG như đã gửi ERP SF0.
//   · Tg Phơi (Phút) = phút của phiên phơi mới nhất · Giờ Tháo = giờ kết thúc phơi (đã khô / dự kiến khô).
//   · Cần tháo = 2 khi tem đã khô hoặc giờ tháo ≤ "Giờ dự kiến"; 1 = chưa khô tới giờ dự kiến. Xếp 2 trước, rồi giờ tháo.
//   · Độ in: ERP chưa gửi sang MES ⇒ đang trống.
// Lazy import exceljs để không phình bundle chính.
// ─────────────────────────────────────────────────────────────────────────────
import { chuanMaChuyen } from '../../../utils/maChuyen';
import { ngayLocalISO } from '../../../utils/format';

const so = (v) => (v == null || v === '' ? null : Number(v));
const soKhac0 = (v) => { const n = so(v); return n ? n : null; };
const p2 = (n) => String(n).padStart(2, '0');

// Mốc (Date / ISO) ⇒ Date mang GIỜ MÁY (VN) dán nhãn UTC — exceljs ghi đúng ngày giờ đang thấy.
const gioExcel = (v) => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()));
};
// Chuỗi giờ VN 'YYYY/MM/DD HH:MM:SS' (BE `duLieuGhiInTem`) ⇒ Date dán nhãn UTC.
const gioVnExcel = (s) => {
  const m = /^(\d{4})[/-](\d{2})[/-](\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(String(s || ''));
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0))) : null;
};
// 'YYYY-MM-DD' ⇒ Date 00:00 UTC.
const ngayExcel = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ''));
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
};
const dmy = (s) => (s ? String(s).slice(0, 10).split('-').reverse().join('/') : '');
const dmyHm = (d) => (d ? `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}` : '');

const daKiem = (r) => (Number(r.sl_kcs_dat) || 0) + (Number(r.sl_kcs_sua) || 0) + (Number(r.sl_kcs_huy) || 0);
const soPhut = (r) => {
  const a = gioVnExcel(r.tu_gio); const b = gioVnExcel(r.den_gio);
  return a && b && b > a ? Math.round((b - a) / 60000) : null;
};
const fmtVn = (n) => Number(n || 0).toLocaleString('vi-VN');
// Tổng tồn: số tem + Σ còn phải kiểm (`con_kcs`), tách tem đã khô (DA_KHO) / còn đang phơi.
export const tongTon = (rows = []) => rows.reduce((t, r) => {
  const con = Number(r.con_kcs) || 0;
  const kho = r.trang_thai === 'DA_KHO';
  t.soTem += 1; t.sl += con; t.slIn += Number(r.so_luong) || 0; t.daKiem += daKiem(r);
  if (kho) { t.khoTem += 1; t.khoSl += con; } else { t.phoiTem += 1; t.phoiSl += con; }
  return t;
}, { soTem: 0, sl: 0, slIn: 0, daKiem: 0, khoTem: 0, khoSl: 0, phoiTem: 0, phoiSl: 0 });

// 2 = đã khô / khô trước giờ dự kiến (tháo xuống kiểm được) · 1 = chưa.
export const canThao = (r, gioDuKien) => {
  if (r.trang_thai === 'DA_KHO' || r.phoi_trang_thai === 'XONG') return 2;
  const t = r.tg_kt_phoi ? new Date(r.tg_kt_phoi).getTime() : null;
  return t != null && gioDuKien && t <= gioDuKien.getTime() ? 2 : 1;
};

// `nhom` = nhóm cột dòng 5 (cột không nhóm gộp dọc 5–6) · `t` = tên trường dòng 7 (như tờ ERP) · kiểu: so / ngay / gio.
const COT = [
  { h: 'Số CT', t: 'Số CT', w: 12, v: (r) => (r.id_mes ? String(r.id_mes) : '') },
  { h: 'Khách hàng', t: 'Khách hàng', w: 11, v: (r) => r.ten_khach_hang },
  { h: 'Đơn hàng', t: 'Đơn hàng', w: 16, v: (r) => r.ma_don_hang },
  { h: 'Mã hàng', t: 'Mã hàng', w: 20, v: (r) => r.ma_hang, nhom: 'Hàng hóa' },
  { h: 'Màu vải', t: 'Màu vải', w: 14, v: (r) => r.mau_vai, nhom: 'Hàng hóa' },
  { h: 'Kích vải', t: 'Kích vải', w: 10, v: (r) => r.kich_vai, nhom: 'Hàng hóa' },
  { h: 'Kích phim', t: 'Kích phim', w: 11, v: (r) => r.kich_phim, nhom: 'Hàng hóa' },
  { h: 'Màu in', t: 'Màu in', w: 16, v: (r) => r.mau_in, nhom: 'Hàng hóa' },
  { h: 'Tính chất in', t: 'Tính chất in', w: 9, v: (r) => r.tinh_chat_in, nhom: 'Hàng hóa' },
  { h: 'Độ in', t: 'Độ in', w: 6, v: (r) => r.do_in, nhom: 'Hàng hóa' },
  { h: 'Barcode', t: 'Barcode', w: 15, v: (r) => r.ma_tem },
  { h: 'In', t: 'SL IN', w: 8, v: (r) => so(r.so_luong), kieu: 'so', nhom: 'Số lượng' },
  { h: 'Đã kiểm', t: 'SLDKiem', w: 8, v: (r) => soKhac0(daKiem(r)), kieu: 'so', nhom: 'Số lượng' },
  { h: 'Còn lại', t: 'SlCLai', w: 8, v: (r) => so(r.con_kcs), kieu: 'so', nhom: 'Số lượng' },
  { h: 'Đạt', t: 'SLD', w: 7, v: () => null, kieu: 'so', nhom: 'Số lượng' },
  { h: 'Không đạt', t: 'SLKD', w: 7, v: () => null, kieu: 'so', nhom: 'Số lượng' },
  { h: 'Thiếu', t: 'SLThieu', w: 7, v: () => null, kieu: 'so', nhom: 'Số lượng' },
  { h: 'Dư', t: 'SLDu', w: 7, v: () => null, kieu: 'so', nhom: 'Số lượng' },
  { h: 'Vải hư', t: 'SLVH', w: 7, v: () => null, kieu: 'so', nhom: 'Số lượng' },
  { h: 'Mẫu', t: 'SLMau', w: 7, v: () => null, kieu: 'so', nhom: 'Số lượng' },
  { h: 'Số phút', t: 'Phút', w: 7, v: (r) => soPhut(r), kieu: 'so' },
  { h: 'Nhân viên kiểm', t: 'Nhân viên kiểm', w: 18, v: () => '' },
  { h: 'Tổ', t: 'Tổ in', w: 7, v: (r) => r.ma_to, nhom: 'Thông tin hàng in' },
  { h: 'Máy / Bàn', t: 'Máy/bàn', w: 9, v: (r) => (r.ma_chuyen ? chuanMaChuyen(r.ma_chuyen) : ''), nhom: 'Thông tin hàng in' },
  { h: 'Thợ', t: 'Thợ', w: 18, v: (r) => r.tho_in, nhom: 'Thông tin hàng in' },
  { h: 'Ca', t: 'Ca', w: 10, v: (r) => r.ma_ngay_ca, nhom: 'Thông tin hàng in' },
  { h: 'Ngày', t: 'Ngày', w: 11, v: (r) => ngayExcel(r.ngay_ca), kieu: 'ngay', nhom: 'Thông tin hàng in' },
  { h: 'Ghi chú', t: 'Ghi chú', w: 12, v: () => '' },
  { h: 'GC MV', t: 'GCMV', w: 8, v: (r) => r.gc_mau_vai },
  { h: 'Tu Gio', t: 'Tu Gio', w: 15, v: (r) => gioVnExcel(r.tu_gio), kieu: 'gio' },
  { h: 'Den Gio', t: 'Den Gio', w: 15, v: (r) => gioVnExcel(r.den_gio), kieu: 'gio' },
  { h: 'Tg Phơi (Phút)', t: 'TgPhoi', w: 9, v: (r) => so(r.so_phut_phoi), kieu: 'so2' },
  { h: 'Giờ Tháo', t: 'Gio Thao', w: 15, v: (r) => gioExcel(r.tg_kt_phoi), kieu: 'gio' },
  { h: 'Cần tháo', t: 'Cần tháo', w: 8, v: (r, g) => canThao(r, g), kieu: 'so2' },
];
const FMT = { so: '#,##0', so2: '#,##0.00', ngay: 'dd/mm/yyyy', gio: 'dd/mm/yyyy hh:mm' };

/**
 * @param {Array} rows  dòng từ `GET /quality/kcs/ton-chua-kiem` (đã lọc như màn KCS)
 * @param {{tuNgay?: string, denNgay?: string, gioDuKien: Date}} o  tuNgay/denNgay = khoảng NGÀY CHỨNG TỪ chọn ở hộp xuất (trống ⇒
 *   lấy ngày CT sớm / muộn nhất của danh sách; tem chưa có ngày CT ⇒ ngày in tem).
 */
export default async function exportPhieuChuaKiem(rows, { tuNgay, denNgay, tuGio, denGio, gioDuKien }) {
  const ExcelJS = (await import('exceljs')).default || (await import('exceljs'));
  const gdk = gioDuKien instanceof Date && !Number.isNaN(gioDuKien.getTime()) ? gioDuKien : new Date();
  const ds = [...(rows || [])].sort((a, b) => (canThao(b, gdk) - canThao(a, gdk))
    || ((a.tg_kt_phoi ? new Date(a.tg_kt_phoi).getTime() : Infinity) - (b.tg_kt_phoi ? new Date(b.tg_kt_phoi).getTime() : Infinity))
    || String(a.ma_tem || '').localeCompare(String(b.ma_tem || '')));
  const ngayIn = ds.map((r) => r.ngay_ct || (r.ngay_in_tem ? ngayLocalISO(r.ngay_in_tem) : '')).filter(Boolean).sort();
  const tu = tuNgay || ngayIn[0] || ngayLocalISO(new Date());
  const den = denNgay || ngayIn[ngayIn.length - 1] || tu;

  const N = COT.length;
  const DONG_DAU = 8;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Chua kiem', { views: [{ state: 'frozen', ySplit: 7, xSplit: 0 }] });
  ws.columns = COT.map((c) => ({ width: c.w }));
  const FONT = 'Times New Roman';
  const thin = { style: 'thin', color: { argb: 'FF808080' } };
  const border = { top: thin, left: thin, bottom: thin, right: thin };
  const giua = { horizontal: 'center', vertical: 'middle', wrapText: true };

  ws.getCell(1, 1).value = 'CÔNG TY TNHH THUẬN HƯNG LONG AN';
  ws.getCell(1, 1).font = { name: FONT, bold: true, size: 11 };
  ws.mergeCells(2, 1, 2, N);
  ws.getCell(2, 1).value = 'DANH SÁCH PHIẾU NHẬT KÝ KIỂM PHẨM CHƯA KIỂM';
  ws.getCell(2, 1).font = { name: FONT, bold: true, size: 16 };
  ws.getCell(2, 1).alignment = giua;
  ws.getRow(2).height = 30;
  ws.mergeCells(3, 1, 3, N);
  // Có chọn giờ (giờ in tem) ⇒ ghi kèm sau ngày.
  ws.getCell(3, 1).value = `Từ ngày ${dmy(tu)}${tuNgay && tuGio ? ` ${tuGio}` : ''}  Đến ngày ${dmy(den)}${denNgay && denGio ? ` ${denGio}` : ''}`;
  ws.mergeCells(4, 1, 4, N);
  ws.getCell(4, 1).value = `Giờ dự kiến   ${dmyHm(gdk)}`;
  [3, 4].forEach((r) => { ws.getCell(r, 1).alignment = giua; ws.getCell(r, 1).font = { name: FONT, size: 11 }; });

  // THÔNG TIN TỔNG (14/11/2026): số tem chưa kiểm + tổng SL chưa kiểm (Σ `con_kcs`), tách đã khô / đang phơi — ghi ở
  //   ô A1 phía phải (dòng tên công ty) để mở file là thấy, và lặp lại ở dòng TỔNG CỘNG cuối bảng.
  const tg = tongTon(ds);
  ws.mergeCells(1, 12, 1, N);
  ws.getCell(1, 12).value = `Tổng: ${fmtVn(tg.soTem)} tem chưa kiểm · SL chưa kiểm ${fmtVn(tg.sl)}`
    + (tg.phoiTem ? `  (đã khô ${fmtVn(tg.khoTem)} tem / ${fmtVn(tg.khoSl)} · đang phơi ${fmtVn(tg.phoiTem)} tem / ${fmtVn(tg.phoiSl)})` : '');
  ws.getCell(1, 12).font = { name: FONT, bold: true, size: 11, color: { argb: 'FFC00000' } };
  ws.getCell(1, 12).alignment = { horizontal: 'right', vertical: 'middle' };

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
  // Dòng 7: tên trường như tờ ERP — hàng có NÚT LỌC.
  COT.forEach((c, k) => { ws.getCell(7, k + 1).value = c.t; });
  for (let r = 5; r <= 7; r += 1) {
    for (let c = 1; c <= N; c += 1) {
      const cell = ws.getCell(r, c);
      cell.font = { name: FONT, bold: r < 7, size: 10 };
      cell.alignment = giua;
      cell.border = border;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: r === 7 ? 'FFFFFFFF' : 'FFF2F2F2' } };
    }
  }
  ws.getRow(5).height = 18;
  ws.getRow(6).height = 30;
  ws.getRow(7).height = 28;
  ws.autoFilter = { from: { row: 7, column: 1 }, to: { row: 7, column: N } };

  ds.forEach((r) => {
    const row = ws.addRow(COT.map((c) => {
      const v = c.v(r, gdk);
      if (c.kieu) return v == null || v === '' ? null : v;
      return v == null ? '' : String(v);
    }));
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      const c = COT[col - 1];
      if (!c) return;
      cell.border = border;
      cell.font = { name: FONT, size: 10 };
      const laSo = c.kieu === 'so' || c.kieu === 'so2';
      cell.alignment = { vertical: 'middle', horizontal: laSo ? 'right' : (c.kieu ? 'center' : 'left'), wrapText: !c.kieu };
      if (c.kieu) cell.numFmt = FMT[c.kieu];
    });
  });
  if (!ds.length) ws.getCell(DONG_DAU, 1).value = 'Không có tem nào chưa kiểm theo bộ lọc đang chọn';
  else {
    // Dòng TỔNG CỘNG — cách bảng 1 dòng trống để nút lọc (dòng 7) không gộp dòng tổng vào vùng lọc.
    const r = ws.rowCount + 2;
    const cot = (khoa) => COT.findIndex((c) => c.t === khoa) + 1;
    const cIn = cot('SL IN');
    ws.mergeCells(r, 1, r, cIn - 1);
    ws.getCell(r, 1).value = `TỔNG CỘNG: ${fmtVn(tg.soTem)} tem chưa kiểm`;
    ws.getCell(r, cIn).value = tg.slIn;
    ws.getCell(r, cot('SLDKiem')).value = tg.daKiem || null;
    ws.getCell(r, cot('SlCLai')).value = tg.sl;
    for (let c = 1; c <= N; c += 1) {
      const cell = ws.getCell(r, c);
      cell.font = { name: FONT, bold: true, size: 10 };
      cell.border = border;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
      if (c >= cIn) { cell.numFmt = FMT.so; cell.alignment = { horizontal: 'right', vertical: 'middle' }; }
    }
    ws.getCell(r, 1).alignment = { horizontal: 'right', vertical: 'middle' };
    ws.getRow(r).height = 20;
  }

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const nhan = `${gdk.getFullYear()}${p2(gdk.getMonth() + 1)}${p2(gdk.getDate())}-${p2(gdk.getHours())}${p2(gdk.getMinutes())}`;
  a.href = url; a.download = `phieu-chua-kiem-${nhan}.xlsx`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  return ds.length;
}
