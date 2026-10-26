// DANH SÁCH RELEASE CỦA SẢN XUẤT (26/10/2026, mẫu xưởng "DANH SÁCH RELEASE BÀN 10/26/2026") — bộ cột NGUỒN DUY NHẤT
// cho bảng trong modal (`DsReleaseSxModal`) và file Excel (`exportDsReleaseSx`). Dữ liệu: `GET /production/ds-release`
// (backend `production/dsReleaseSx.js`). Cách hiện chuyền · PO · tên hàng · giờ · thợ in dùng lại bộ cột Danh sách
// release của Kế hoạch (`cotChecklistRelease`) — không chép luật.
import { COT_CHECKLIST, maChuyenIn, slReleaseDong } from '../../planning/utils/cotChecklistRelease';
import { hopChipChuyen } from '../../../utils/khuChuyen';

const tuChecklist = (key) => (COT_CHECKLIST.find((c) => c.key === key) || { value: () => '' }).value;
const so = (v) => (v == null || v === '' ? 0 : Number(v) || 0);

// TỔNG = SL IN + vải hư + vải thiếu + DM+TEST · CL = Tổng − SL release (đúng công thức tờ mẫu: 481 + 10 + 10 + 3 = 504).
export const tongDong = (r) => so(r.sl_in) + so(r.vai_hu) + so(r.vai_thieu) + so(r.dm_test);
export const clDong = (r) => tongDong(r) - slReleaseDong(r);

// `nhom` = tiêu đề nhóm (dòng trên). `nhap` = ô nhập tay (DM+TEST / Ghi chú).
export const COT_DS_RELEASE_SX = [
  { key: 'stt', header: 'STT', width: 5, num: true, value: (r) => r._stt },
  { key: 'chuyen', header: 'Chuyền', width: 9, value: maChuyenIn },
  { key: 'kh', header: 'KH', width: 12, value: (r) => r.ten_khach_hang || '' },
  { key: 'po', header: 'PO', width: 16, value: tuChecklist('po') },
  { key: 'ma', header: 'Mã', width: 28, value: tuChecklist('ten_hang') },
  { key: 'mau_vai', header: 'Màu vải', nhom: 'PHẦN IN', width: 16, value: (r) => r.mau_vai || '' },
  { key: 'kich_vai', header: 'Kích vải', nhom: 'PHẦN IN', width: 11, value: (r) => r.kich_vai || '' },
  { key: 'kich_phim', header: 'Kích phim', nhom: 'PHẦN IN', width: 11, value: (r) => r.kich_phim || '' },
  { key: 'sldh', header: 'SLĐH', width: 8, num: true, value: (r) => (r.so_luong_don_hang == null ? '' : so(r.so_luong_don_hang)) },
  { key: 'slnv', header: 'SLNV', width: 8, num: true, value: (r) => so(r.slnv) },
  { key: 'sl_da_in', header: 'SL ĐÃ IN', width: 8, num: true, value: (r) => so(r.sl_da_in_truoc) },
  { key: 'sl_da_giao', header: 'SL ĐÃ GIAO', width: 8, num: true, value: (r) => so(r.sl_da_giao_pin) },
  { key: 'sl_release', header: 'SL RELEASE', width: 9, num: true, value: slReleaseDong },
  { key: 'gio_bd', header: 'GIỜ BD', nhom: 'HẠN HOÀN THÀNH', width: 8, value: tuChecklist('gio_bd') },
  { key: 'gio_kt', header: 'GIỜ KT', nhom: 'HẠN HOÀN THÀNH', width: 8, value: tuChecklist('gio_kt') },
  { key: 'tho_in', header: 'THỢ IN', width: 14, value: tuChecklist('tho_in') },
  { key: 'trang_thai', header: 'TRẠNG THÁI', width: 13, value: (r) => r.giai_doan_ten || '' },
  { key: 'sl_in', header: 'SL IN', nhom: 'SL IN', width: 8, num: true, value: (r) => (r.sl_in == null ? '' : so(r.sl_in)) },
  { key: 'vai_hu', header: 'Vải hư', nhom: 'SL IN', width: 7, num: true, value: (r) => (so(r.vai_hu) || '') },
  { key: 'vai_thieu', header: 'Vải thiếu', nhom: 'SL IN', width: 8, num: true, value: (r) => (so(r.vai_thieu) || '') },
  { key: 'dm_test', header: 'DM + TEST', nhom: 'SL IN', width: 9, num: true, nhap: true, value: (r) => (r.dm_test == null ? '' : so(r.dm_test)) },
  { key: 'tong', header: 'TỔNG', nhom: 'SL IN', width: 9, num: true, value: tongDong },
  { key: 'cl', header: 'CL', nhom: 'SL IN', width: 7, num: true, value: (r) => clDong(r) || '-' },
  { key: 'ghi_chu', header: 'GHI CHÚ', width: 30, nhap: true, value: (r) => r.ghi_chu_sx || '' },
];

// 2 dòng tiêu đề: [{ nhan, tuCot, colSpan, rowSpan }].
export function tieuDeNhom(cols = COT_DS_RELEASE_SX) {
  const out = [];
  cols.forEach((c, i) => {
    const cuoi = out[out.length - 1];
    if (c.nhom && cuoi && cuoi.nhan === c.nhom && cuoi.rowSpan === 1) cuoi.colSpan += 1;
    else out.push(c.nhom ? { nhan: c.nhom, tuCot: i, colSpan: 1, rowSpan: 1 } : { nhan: c.header, tuCot: i, colSpan: 1, rowSpan: 2 });
  });
  return out;
}

// Dòng hiện = chip khu (`hopChipChuyen`) HOẶC chuyền được thêm (`themMa` = mã chuyền gốc) · xếp theo chuyền như BE.
export function locDsRelease(items, chip, themMa = []) {
  const them = new Set(themMa);
  return (items || []).filter((r) => hopChipChuyen(r, chip) || them.has(r.ma_chuyen))
    .map((r, i) => ({ ...r, _stt: i + 1 }));
}

// Số tổng đầu trang (đếm như Danh sách release: đơn / mã / phần in khác nhau · Σ SL release · Σ SL IN).
export function tongDsRelease(rows) {
  const dem = (k) => new Set((rows || []).map((r) => r[k]).filter(Boolean)).size;
  return {
    tong_don: dem('ma_don_hang'), tong_ma: dem('ma_hang'), tong_phan: dem('ma_phan'),
    sl_release: (rows || []).reduce((a, r) => a + slReleaseDong(r), 0),
    sl_in: (rows || []).reduce((a, r) => a + so(r.sl_in), 0),
  };
}
