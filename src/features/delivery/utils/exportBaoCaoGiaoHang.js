// ─────────────────────────────────────────────────────────────────────────────
// XUẤT EXCEL "BÁO CÁO GIAO HÀNG" — đúng khuôn tờ người dùng gửi (14/10/2026), cho TEM ĐANG CHỜ GIAO của màn
// *Giao hàng › Danh sách tem giao* (tab "Tem chờ giao", đúng tập đang hiện sau bộ lọc).
//   Dòng 1: "BÁO CÁO GIAO HÀNG" · "BÁO CÁO (TEM ĐANG CHỜ GIAO)" · "Từ ngày … đến ngày …"
//   Dòng 3: 16 cột có nút lọc — Muc · Soct · Maquet · Soluong · Giatri · KhachHang · PO · Mahang · Nhanvien ·
//           Sochitiet · Soma · Tuan · Thang · Thu · Ngay · sophu; dữ liệu từ dòng 4.
// Nghĩa từng cột với tem CHỜ GIAO (tự chốt — chờ người dùng xác nhận):
//   · Muc      = nhóm theo SỐ LƯỢNG (`MUC_SL` — tờ mẫu chỉ có "1.Rất Nhỏ <300" · "2.Nhỏ <600"; các mức trên tự đặt).
//   · Soct     = TRỐNG — tem chưa vào phiếu giao nên chưa có số chứng từ (giữ cột cho đúng khuôn).
//   · Maquet   = mã tem ĐÚNG NHƯ NHÃN (15… / 17… / 13…), ghi kiểu SỐ (như tờ mẫu) + định dạng "0" để không ra 1,52E+11.
//   · Soluong  = SL còn chờ giao của dòng (tem tách 2 dòng nguồn KCS/Sửa như bảng).
//   · Giatri   = Soluong × đơn giá phần in (ERP `Dongia`, mig 113) — phần in chưa có giá ⇒ trống.
//   · Nhanvien = người bán hàng đã TÍCH tem.
//   · Sochitiet / Soma = 1 (để Pivot đếm) · sophu = trống.
//   · Ngay     = NGÀY GIAO = hạn giao sớm nhất của lệnh; Tuan = tuần ISO, Thang = tháng, Thu = thứ kiểu Excel WEEKDAY
//                (CN = 1, Thứ 2 = 2 … Thứ 7 = 7 — tờ mẫu: 12/10/2026 thứ Hai = 2, 13/10 thứ Ba = 3).
// Lazy import exceljs để không phình bundle chính.
// ─────────────────────────────────────────────────────────────────────────────

import { ngayLocalISO } from '../../../utils/format';

export const MUC_SL = [
  { max: 300, ten: '1.Rất Nhỏ <300' },
  { max: 600, ten: '2.Nhỏ <600' },
  { max: 1000, ten: '3.Vừa <1000' },
  { max: 2000, ten: '4.Lớn <2000' },
  { max: Infinity, ten: '5.Rất Lớn >=2000' },
];
export const mucTheoSoLuong = (sl) => {
  const n = Number(sl) || 0;
  return (MUC_SL.find((m) => n < m.max) || MUC_SL[MUC_SL.length - 1]).ten;
};

// Ngày ⇒ { d: Date 00:00 UTC (exceljs ghi đúng ngày), y, m, dd } | null.
// ⚠ Cột DATE (vd `han_giao_hang`) về FE dạng ISO có giờ ("2026-10-12T17:00:00.000Z" = 13/10 giờ VN — node-pg trả Date
//   00:00 giờ máy chủ) ⇒ KHÔNG cắt 10 ký tự đầu; chuỗi có giờ đi qua `ngayLocalISO` (lấy ngày theo giờ trình duyệt).
const tachNgay = (v) => {
  if (!v) return null;
  const s = typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : ngayLocalISO(v);
  const [y, m, d] = String(s || '').slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return { d: new Date(Date.UTC(y, m - 1, d)), y, m, dd: d };
};
// Tuần ISO (thứ Hai đầu tuần, tuần chứa thứ Năm đầu năm là tuần 1).
export const tuanIso = (y, m, d) => {
  const t = new Date(Date.UTC(y, m - 1, d));
  const thu = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - thu);
  const dauNam = Date.UTC(t.getUTCFullYear(), 0, 1);
  return Math.ceil(((t.getTime() - dauNam) / 86400000 + 1) / 7);
};
// Thứ kiểu Excel WEEKDAY mặc định: Chủ nhật = 1 … Thứ Bảy = 7.
export const thuExcel = (y, m, d) => new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 1;
const dmy = (s) => { const t = tachNgay(s); return t ? `${String(t.dd).padStart(2, '0')}/${String(t.m).padStart(2, '0')}/${t.y}` : ''; };

// Dựng các dòng dữ liệu (hàm thuần — dùng lại để kiểm thử).
export function dongBaoCaoGiaoHang(rows) {
  return (rows || []).map((r) => {
    const sl = Number(r.con_src ?? r.con_giao) || 0;
    const gia = r.don_gia == null || r.don_gia === '' ? null : Number(r.don_gia);
    const ma = String(r.ma_tem_display || r.ma_tem || '');
    const t = tachNgay(r.han_giao_hang);
    return {
      Muc: mucTheoSoLuong(sl),
      Soct: '',
      Maquet: /^\d{12}$/.test(ma) ? Number(ma) : ma,
      Soluong: sl,
      Giatri: gia != null && Number.isFinite(gia) ? Math.round(sl * gia * 100) / 100 : null,
      KhachHang: r.ten_khach_hang || r.khach_list || '',
      PO: r.ma_don_hang || r.don_list || '',
      Mahang: r.ma_hang || '',
      Nhanvien: r.nguoi_tich_giao || '',
      Sochitiet: 1,
      Soma: 1,
      Tuan: t ? tuanIso(t.y, t.m, t.dd) : null,
      Thang: t ? t.m : null,
      Thu: t ? thuExcel(t.y, t.m, t.dd) : null,
      Ngay: t ? t.d : null,
      sophu: '',
    };
  });
}

const COT = [
  { k: 'Muc', w: 16 }, { k: 'Soct', w: 16 }, { k: 'Maquet', w: 15, fmt: '0' }, { k: 'Soluong', w: 9, fmt: '#,##0' },
  { k: 'Giatri', w: 13, fmt: '#,##0' }, { k: 'KhachHang', w: 12 }, { k: 'PO', w: 18 }, { k: 'Mahang', w: 24 },
  { k: 'Nhanvien', w: 22 }, { k: 'Sochitiet', w: 9 }, { k: 'Soma', w: 7 }, { k: 'Tuan', w: 6 }, { k: 'Thang', w: 7 },
  { k: 'Thu', w: 5 }, { k: 'Ngay', w: 11, fmt: 'mm/dd/yyyy' }, { k: 'sophu', w: 8 },
];

/**
 * @param {Array} rows  dòng đang hiện của tab "Tem chờ giao" (`displayRows`)
 * @param {{tuNgay?: string, denNgay?: string}} khoang  khoảng "Ngày giao" đang lọc ('YYYY-MM-DD'); trống ⇒ suy từ dữ liệu
 */
export default async function exportBaoCaoGiaoHang(rows, { tuNgay = '', denNgay = '' } = {}, fileName = 'bao-cao-giao-hang') {
  const ExcelJS = (await import('exceljs')).default || (await import('exceljs'));
  const dong = dongBaoCaoGiaoHang(rows);
  // Khoảng ngày trên tiêu đề: theo bộ lọc "Ngày giao"; không lọc ⇒ ngày sớm nhất → muộn nhất của dữ liệu.
  const ngayCo = dong.map((d) => d.Ngay).filter(Boolean).sort((a, b) => a - b);
  const isoCua = (d) => (d ? d.toISOString().slice(0, 10) : '');
  const tu = tuNgay || isoCua(ngayCo[0]);
  const den = denNgay || isoCua(ngayCo[ngayCo.length - 1]);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('BaoCaoGiaoHang', { views: [{ state: 'frozen', ySplit: 3 }] });
  ws.columns = COT.map((c) => ({ width: c.w }));
  ws.getCell(1, 1).value = 'BÁO CÁO GIAO HÀNG';
  ws.getCell(1, 2).value = 'BÁO CÁO (TEM ĐANG CHỜ GIAO)';
  ws.getCell(1, 3).value = tu || den ? `Từ ngày ${dmy(tu)} đến ngày ${dmy(den)}` : 'Tất cả ngày giao';
  ws.getCell(1, 1).font = { bold: true, size: 12 };
  ws.getCell(1, 2).font = { size: 12 };
  ws.getCell(1, 3).font = { size: 12 };

  const thin = { style: 'thin', color: { argb: 'FFBFBFBF' } };
  const border = { top: thin, left: thin, bottom: thin, right: thin };
  const head = ws.getRow(3);
  COT.forEach((c, i) => {
    const cell = head.getCell(i + 1);
    cell.value = c.k;
    cell.font = { bold: true };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = border;
  });
  ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: COT.length } };

  dong.forEach((d) => {
    const row = ws.addRow(COT.map((c) => (d[c.k] == null ? null : d[c.k])));
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      const c = COT[col - 1];
      if (!c) return;
      cell.border = border;
      if (c.fmt) cell.numFmt = c.fmt;
      if (typeof cell.value === 'number' || cell.value instanceof Date) cell.alignment = { horizontal: 'right' };
    });
  });

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileName}-${(tu || '').replace(/-/g, '')}${den && den !== tu ? `-${den.replace(/-/g, '')}` : ''}.xlsx`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
