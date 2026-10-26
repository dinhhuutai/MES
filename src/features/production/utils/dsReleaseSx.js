// DANH SÁCH RELEASE CỦA SẢN XUẤT (26/10/2026, mẫu xưởng "DANH SÁCH RELEASE BÀN 10/26/2026") — bộ cột NGUỒN DUY NHẤT
// cho bảng trong modal (`DsReleaseSxModal`) và file Excel (`exportDsReleaseSx`). Dữ liệu: `GET /production/ds-release`
// (backend `production/dsReleaseSx.js`). Cách hiện chuyền · PO · tên hàng · giờ · thợ in dùng lại bộ cột Danh sách
// release của Kế hoạch (`cotChecklistRelease`) — không chép luật.
import { COT_CHECKLIST, maChuyenIn, slReleaseDong } from '../../planning/utils/cotChecklistRelease';
import { hopChipChuyen, demChip, LOAI_TABS, nhanChip } from '../../../utils/khuChuyen';
import { chuanMaChuyen } from '../../../utils/maChuyen';

// ─── CHIP RIÊNG CHO 1 CHUYỀN (26/10/2026, người dùng: "cho RB1 ra 1 toggle riêng") ────────────────────────────────
// Chỉ modal này: chip `CHUYEN:<mã ERP>` lọc đúng 1 chuyền và chuyền đó TÁCH khỏi chip khu chứa nó (RB1 thuộc Bàn khu A)
//   — xưởng in danh sách RB1 riêng, để cả hai là đếm đôi. Thêm chuyền tách riêng = thêm vào `CHUYEN_RIENG`.
const CHUYEN_RIENG = [{ ma: 'RB1', label: 'RB1', khu: 'KHU:BAN_A' }];
export const TABS_DS_RELEASE = (() => {
  const iMay = LOAI_TABS.findIndex((t) => t.v === 'MAY');
  return [...LOAI_TABS.slice(0, iMay), ...CHUYEN_RIENG.map((c) => ({ v: `CHUYEN:${c.ma}`, label: c.label })), ...LOAI_TABS.slice(iMay)];
})();
const laChuyenRieng = (r, khu) => CHUYEN_RIENG.some((c) => c.khu === khu && chuanMaChuyen(r.ma_chuyen) === c.ma);
export const hopChipDs = (r, chip) => {
  if (chip && chip.startsWith('CHUYEN:')) return chuanMaChuyen(r.ma_chuyen) === chip.slice(7);
  return hopChipChuyen(r, chip) && !(chip && laChuyenRieng(r, chip));
};
export const nhanChipDs = (chip) => (TABS_DS_RELEASE.find((t) => t.v === chip) || {}).label || nhanChip(chip);
// Số trên chip: như `demChip` (đếm DÒNG) + chip chuyền riêng, trừ các dòng đó khỏi chip khu chứa nó.
export function demChipDs(rows) {
  const c = demChip(rows);
  CHUYEN_RIENG.forEach((x) => {
    const n = (rows || []).filter((r) => chuanMaChuyen(r.ma_chuyen) === x.ma).length;
    c[`CHUYEN:${x.ma}`] = n;
    if (c[x.khu] != null) c[x.khu] = Math.max(0, c[x.khu] - n);
  });
  return c;
}

const tuChecklist = (key) => (COT_CHECKLIST.find((c) => c.key === key) || { value: () => '' }).value;
const so = (v) => (v == null || v === '' ? 0 : Number(v) || 0);

// TỔNG = SL IN + vải hư + vải thiếu + DM+TEST · CL = Tổng − SL release (đúng công thức tờ mẫu: 481 + 10 + 10 + 3 = 504).
// ⚠ 26/10/2026 danh sách theo NGÀY IN TEM ⇒ SL IN chỉ là tem in TRONG kỳ; lệnh đã in một phần TRƯỚC kỳ thì CL cộng thêm
//   phần đó (`sl_in_truoc_lenh`, backend) ⇒ CL vẫn là "còn thiếu / dư của lệnh". Lệnh in trọn trong kỳ = công thức tờ mẫu.
export const tongDong = (r) => so(r.sl_in) + so(r.vai_hu) + so(r.vai_thieu) + so(r.dm_test);
export const clDong = (r) => tongDong(r) + so(r.sl_in_truoc_lenh) - slReleaseDong(r);

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
  // SLNV = vải nhận của CẢ phần in (mọi đợt sống) — cùng phạm vi Đã in / Đã giao (26/10/2026, ca 8A8B). `tip` = chú thích
  //   ô (title trên bảng); `ht` = phần số do script hệ thống "chạy đến giao" tạo (tem `HT-`) ⇒ bảng đánh dấu `*`.
  { key: 'slnv', header: 'SLNV', width: 8, num: true, value: (r) => so(r.slnv_pin ?? r.slnv),
    tip: (r) => `Vải nhận cả phần in: ${so(r.slnv_pin ?? r.slnv)} · đợt trong lệnh này: ${so(r.slnv)}` },
  // "Đã in" = tem của phần in in TRƯỚC kỳ đang xem (mọi lệnh) — backend `dsReleaseSx`.
  { key: 'sl_da_in', header: 'SL ĐÃ IN', width: 8, num: true, value: (r) => so(r.sl_da_in_truoc), ht: (r) => so(r.sl_da_in_ht) },
  { key: 'sl_da_giao', header: 'SL ĐÃ GIAO', width: 8, num: true, value: (r) => so(r.sl_da_giao_pin), ht: (r) => so(r.sl_da_giao_ht) },
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
// `locThem(r)` (26/10/2026) = ô tìm + bộ lọc trường của modal — áp SAU chip, STT đánh lại trên tập còn lại.
export function locDsRelease(items, chip, themMa = [], locThem = null) {
  const them = new Set(themMa);
  return (items || []).filter((r) => (hopChipDs(r, chip) || them.has(r.ma_chuyen)) && (!locThem || locThem(r)))
    .map((r, i) => ({ ...r, _stt: i + 1 }));
}

// ─── BỘ LỌC (26/10/2026, người dùng: "cho thêm bộ lọc, lọc theo code phần") ─────────────────────────────────────
// Dùng chung 2 chế độ (Danh sách release · Nhật ký in) — `col` = tên thuộc tính hàng của CẢ HAI nguồn (`filterRows`).
export const LOC_DS_RELEASE = [
  { key: 'ma_phan', label: 'Code phần', col: 'ma_phan' },
  { key: 'khach', label: 'Khách hàng', col: 'ten_khach_hang' },
  { key: 'don', label: 'Đơn hàng / PO', col: '_don_po' },
  { key: 'ma_hang', label: 'Mã hàng', col: 'ma_hang' },
  { key: 'mau_vai', label: 'Màu vải', col: 'mau_vai' },
  { key: 'chuyen', label: 'Chuyền', col: '_chuyen' },
  { key: 'tho_in', label: 'Thợ in', col: '_tho' },
  { key: 'lenh', label: 'Mã lệnh SX', col: 'ma_lenh_san_xuat' },
];
// Trường gộp cho bộ lọc + ô tìm (gắn 1 lần lúc tải).
export const ganTruongLoc = (r) => ({
  ...r,
  _don_po: [r.ma_don_hang, r.so_po].filter(Boolean).join(' '),
  _chuyen: [maChuyenIn(r), r.ma_chuyen, r.ten_chuyen].filter(Boolean).join(' '),
  _tho: [r.tho_in, r.tho_in_kh].filter(Boolean).join(' '),
});
// Chuỗi cho ô tìm chung (code phần · mã tem · mã lệnh · khách · đơn · mã hàng · màu · kích).
export const chuoiTim = (r) => [r.ma_phan, r.ma_tem, r.ma_lenh_san_xuat, r.ten_khach_hang, r._don_po, r.ma_hang,
  r.mau_vai, r.kich_vai, r.kich_phim, r._chuyen, r.barcode_phan_in].filter(Boolean).join(' ');

// ─── NHẬT KÝ IN (26/10/2026, mẫu ERP "DANH SÁCH NHẬT KÝ IN") — 1 dòng / tem gốc in trong kỳ (`GET …/nhat-ky-in`). ──
const ngayVn = (v) => {
  if (!v) return '';
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.split('-').reverse().join('/');
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};
const gioVn = (v) => {
  if (!v) return '';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
};
const ngayGioVn = (v) => (v ? `${ngayVn(v)} ${gioVn(v)}` : '');
export const COT_NHAT_KY_IN = [
  { key: 'stt', header: 'STT', width: 5, num: true, value: (r) => r._stt },
  { key: 'so_ct', header: 'Số CT', width: 12, value: (r) => r.id_mes || '' },
  { key: 'kh', header: 'Khách hàng', width: 14, value: (r) => r.ten_khach_hang || '' },
  { key: 'don', header: 'Đơn hàng', width: 16, value: (r) => r.so_po || r.ma_don_hang || '' },
  { key: 'ma_hang', header: 'Mã hàng', nhom: 'Hàng hóa', width: 22, value: (r) => r.ma_hang || '' },
  { key: 'mau_vai', header: 'Màu vải', nhom: 'Hàng hóa', width: 16, value: (r) => r.mau_vai || '' },
  { key: 'kich_vai', header: 'Kích vải', nhom: 'Hàng hóa', width: 10, value: (r) => r.kich_vai || '' },
  { key: 'kich_phim', header: 'Kích phim', nhom: 'Hàng hóa', width: 10, value: (r) => r.kich_phim || '' },
  { key: 'mau_in', header: 'Màu in', nhom: 'Hàng hóa', width: 14, value: (r) => r.mau_in || '' },
  { key: 'tinh_chat_in', header: 'Tính chất in', nhom: 'Hàng hóa', width: 8, value: (r) => r.tinh_chat_in || '' },
  { key: 'do_in', header: 'Độ in', nhom: 'Hàng hóa', width: 6, value: (r) => r.do_in || '' },
  { key: 'barcode', header: 'Barcode', width: 15, value: (r) => r.ma_tem || '' },
  { key: 'ngc', header: 'NGC', width: 8, value: (r) => r.nha_gia_cong || '' },
  { key: 'sl_in', header: 'In', nhom: 'Số lượng', width: 8, num: true, value: (r) => so(r.so_luong) },
  { key: 'vai_hu', header: 'Vải hư', nhom: 'Số lượng', width: 7, num: true, value: (r) => (so(r.vai_hu) || '') },
  { key: 'vai_thieu', header: 'Vải thiếu', nhom: 'Số lượng', width: 7, num: true, value: (r) => (so(r.vai_thieu) || '') },
  { key: 'so_phut', header: 'Số phút', width: 7, num: true, value: (r) => (r.so_phut == null ? '' : so(r.so_phut)) },
  { key: 'to', header: 'Tổ', nhom: 'Thông tin hàng in', width: 6, value: (r) => r.ma_to || '' },
  { key: 'chuyen', header: 'Máy/Bàn', nhom: 'Thông tin hàng in', width: 8, value: maChuyenIn },
  { key: 'tho', header: 'Thợ', nhom: 'Thông tin hàng in', width: 18, value: (r) => r.tho_in || '' },
  { key: 'ca', header: 'Ca', nhom: 'Thông tin hàng in', width: 10, value: (r) => r.ma_ngay_ca || '' },
  { key: 'ngay', header: 'Ngày', nhom: 'Thông tin hàng in', width: 11, value: (r) => ngayVn(r.ngay_ct) },
  { key: 'gio', header: 'Giờ', nhom: 'Thông tin hàng in', width: 7, value: (r) => gioVn(r.created_date) },
  { key: 'gio_sx', header: 'Giờ SX', nhom: 'Thông tin hàng in', width: 12, value: (r) => [r.gio_sx_bd, r.gio_sx_kt].filter(Boolean).join(' – ') },
  { key: 'tg_kiem', header: 'Thời gian kiểm', nhom: 'Thông tin hàng in', width: 16, value: (r) => ngayGioVn(r.tg_kiem_dau) },
  { key: 'ngay_giao', header: 'Ngày giao', nhom: 'Thông tin hàng in', width: 11, value: (r) => ngayVn(r.han_giao_hang) },
  { key: 'ngay_xn_kiem', header: 'Ngày XN Kiểm', nhom: 'Thông tin hàng in', width: 11, value: (r) => ngayVn(r.tg_kiem_cuoi) },
  { key: 'so_ct_kiem', header: 'Số CT Xn Kiểm', nhom: 'Thông tin hàng in', width: 12, value: (r) => r.id_mes_kiem || '' },
  { key: 'btp', header: 'BTP', nhom: 'Thông tin hàng in', width: 5, value: (r) => (r.btp_truoc ? 'x' : '') },
  { key: 'btp2', header: 'BTP 2', nhom: 'Thông tin hàng in', width: 5, value: (r) => (r.btp_cuoi ? 'x' : '') },
  { key: 'ddhid', header: 'ddhid', nhom: 'Thông tin hàng in', width: 16, value: (r) => r.ddh_id || '' },
  { key: 'ddhsubid', header: 'ddhsubid', nhom: 'Thông tin hàng in', width: 7, value: (r) => r.ddh_sub_id || '' },
  { key: 'lenh', header: 'Lệnh SX', nhom: 'Thông tin hàng in', width: 10, value: (r) => r.ma_lenh_san_xuat || '' },
  { key: 'ma_phan', header: 'Mã phần', nhom: 'Thông tin hàng in', width: 26, value: (r) => r.ma_phan || '' },
  { key: 'slbs_cty', header: 'SLBS cty', nhom: 'Thông tin hàng in', width: 7, num: true, value: (r) => (so(r.sl_bo_sung_cty) || '') },
  { key: 'slbs_khach', header: 'SLBS khách', nhom: 'Thông tin hàng in', width: 7, num: true, value: (r) => (so(r.sl_bo_sung_khach) || '') },
  { key: 'gom', header: 'gom', nhom: 'Thông tin hàng in', width: 9, value: (r) => r.ma_set || (r.so_phan_in_lenh > 1 ? `${r.so_phan_in_lenh} phần` : '') },
  { key: 'ma_lo', header: 'Mã lô', nhom: 'Thông tin hàng in', width: 20, value: (r) => r.ma_lo || '' },
  { key: 'day_chuyen', header: 'Dây chuyền', width: 9, value: (r) => r.day_chuyen || '' },
];

// Số tổng của Nhật ký in: số tem · Σ in · Σ vải hư / thiếu · số code phần.
export function tongNhatKy(rows) {
  const ds = rows || [];
  return {
    so_tem: ds.length,
    sl_in: ds.reduce((a, r) => a + so(r.so_luong), 0),
    vai_hu: ds.reduce((a, r) => a + so(r.vai_hu), 0),
    vai_thieu: ds.reduce((a, r) => a + so(r.vai_thieu), 0),
    so_phan: new Set(ds.map((r) => r.ma_phan).filter(Boolean)).size,
  };
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
