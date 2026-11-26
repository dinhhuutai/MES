// DANH SÁCH RELEASE CỦA SẢN XUẤT (26/10/2026, mẫu xưởng "DANH SÁCH RELEASE BÀN 10/26/2026") — bộ cột NGUỒN DUY NHẤT
// cho bảng trong modal (`DsReleaseSxModal`) và file Excel (`exportDsReleaseSx`). Dữ liệu: `GET /production/ds-release`
// (backend `production/dsReleaseSx.js`). Cách hiện chuyền · PO · tên hàng · giờ · thợ in dùng lại bộ cột Danh sách
// release của Kế hoạch (`cotChecklistRelease`) — không chép luật.
import { COT_CHECKLIST, maChuyenIn, slReleaseDong } from '../../planning/utils/cotChecklistRelease';
import { hopChipChuyen } from '../../../utils/khuChuyen';

const tuChecklist = (key) => (COT_CHECKLIST.find((c) => c.key === key) || { value: () => '' }).value;
const so = (v) => (v == null || v === '' ? 0 : Number(v) || 0);

// TỔNG = SL IN + vải hư + vải thiếu + DM+TEST · CL = Tổng − SL release (đúng công thức tờ mẫu: 481 + 10 + 10 + 3 = 504).
// ⚠ Danh sách theo NGÀY CA của tem (ca trước / ca sau) ⇒ SL IN chỉ là tem TRONG kỳ; lệnh đã in một phần TRƯỚC kỳ thì CL cộng thêm
//   phần đó (`sl_in_truoc_lenh`, backend) ⇒ CL vẫn là "còn thiếu / dư của lệnh". Lệnh in trọn trong kỳ = công thức tờ mẫu.
export const tongDong = (r) => so(r.sl_in) + so(r.vai_hu) + so(r.vai_thieu) + so(r.dm_test);
export const clDong = (r) => tongDong(r) + so(r.sl_in_truoc_lenh) - slReleaseDong(r);

// `nhom` = tiêu đề nhóm (dòng trên). `nhap` = ô nhập tay (DM+TEST / Ghi chú).
export const COT_DS_RELEASE_SX = [
  { key: 'stt', header: 'STT', width: 5, num: true, value: (r) => r._stt },
  // Chuyền IN THẬT của tem trong kỳ (backend `dsReleaseSx` — 26/11/2026); khác kế hoạch ⇒ rê chuột thấy chuyền kế hoạch.
  {
    key: 'chuyen', header: 'Chuyền', width: 9, value: maChuyenIn,
    tip: (r) => (r.ma_chuyen_kh
      ? `In ở ${maChuyenIn(r)} — kế hoạch ${maChuyenKhDong(r)} (đổi chuyền khi chạy)` : maChuyenIn(r)),
  },
  { key: 'kh', header: 'KH', width: 12, value: (r) => r.ten_khach_hang || '' },
  { key: 'po', header: 'PO', width: 16, value: tuChecklist('po') },
  { key: 'ma', header: 'Mã', width: 28, value: tuChecklist('ten_hang') },
  // CÔNG ĐOẠN của lệnh (19/11/2026, người dùng: "tách dòng theo công đoạn, 2 công đoạn thì 2 dòng") — mỗi công đoạn là 1 lệnh
  //   riêng ⇒ 1 dòng; BE (`production/dsReleaseSx`) trả nhãn `cong_doan` (In · In kiếng · Ép · Logo) và tính SL đã in / đã
  //   giao / SLNV theo ĐÚNG công đoạn của dòng với phần in 2 công đoạn (`hai_cong_doan`).
  { key: 'cong_doan', header: 'CÔNG ĐOẠN', width: 10, value: (r) => r.cong_doan || '' },
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
  return (items || []).filter((r) => (hopChipChuyen(r, chip) || them.has(r.ma_chuyen)) && (!locThem || locThem(r)))
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
  r.mau_vai, r.kich_vai, r.kich_phim, r._chuyen, r.barcode_phan_in, r.cong_doan].filter(Boolean).join(' ');

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
  { key: 'sl_in', header: 'In', nhom: 'Số lượng', width: 8, num: true, cong: (r) => so(r.so_luong), value: (r) => so(r.so_luong) },
  { key: 'vai_hu', header: 'Vải hư', nhom: 'Số lượng', width: 7, num: true, cong: (r) => so(r.vai_hu), value: (r) => (so(r.vai_hu) || '') },
  { key: 'vai_thieu', header: 'Vải thiếu', nhom: 'Số lượng', width: 7, num: true, cong: (r) => so(r.vai_thieu), value: (r) => (so(r.vai_thieu) || '') },
  { key: 'so_phut', header: 'Số phút', width: 7, num: true, cong: (r) => so(r.so_phut), value: (r) => (r.so_phut == null ? '' : so(r.so_phut)) },
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
  { key: 'slbs_cty', header: 'SLBS cty', nhom: 'Thông tin hàng in', width: 7, num: true, cong: (r) => so(r.sl_bo_sung_cty), value: (r) => (so(r.sl_bo_sung_cty) || '') },
  { key: 'slbs_khach', header: 'SLBS khách', nhom: 'Thông tin hàng in', width: 7, num: true, cong: (r) => so(r.sl_bo_sung_khach), value: (r) => (so(r.sl_bo_sung_khach) || '') },
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

// DÒNG TỔNG CUỐI BẢNG Nhật ký in (19/11/2026, người dùng: "cho thêm dòng ở cuối là dòng tổng, cả xuất Excel") — NGUỒN DUY NHẤT
//   cho bảng (`DsReleaseSxModal`) và Excel (`exportDsReleaseSx`): { key cột: giá trị } — cột có `cong` = Σ các dòng đang hiện;
//   STT = "TỔNG", Barcode = số tem, Mã phần = số code phần; cột khác để trống.
export function dongTongNhatKy(rows) {
  const ds = rows || [];
  const t = tongNhatKy(ds);
  const out = { stt: 'TỔNG', barcode: `${ds.length} tem`, ma_phan: `${t.so_phan} code phần` };
  COT_NHAT_KY_IN.filter((c) => c.cong).forEach((c) => { out[c.key] = ds.reduce((a, r) => a + c.cong(r), 0); });
  return out;
}

// ─── RELEASE / IN THEO BỔ SUNG (25/11/2026, người dùng gửi mẫu ô vàng "TỔNG SL IN · IN SL · IN BS · CTY · KH" + sheet tổng
//   theo chuyền) — backend `production/dsReleaseSx` trả:
//   · `sl_release_bs` (mỗi dòng) = phần SL release thuộc đợt loại Bổ sung ⇒ Release BS; Release SL = SL release − Release BS.
//   · `sl_in_bs_cty` / `sl_in_bs_khach` (mức LỆNH, dòng đầu như `sl_in`) = Σ SL bổ sung do công ty / khách CỦA TEM in trong kỳ
//     ⇒ In BS = cty + khách; In SL = SL IN − In BS.
export const releaseBsDong = (r) => Math.min(so(r.sl_release_bs), slReleaseDong(r));
export const releaseSlDong = (r) => slReleaseDong(r) - releaseBsDong(r);
const congSo = (rows) => {
  const ds = rows || [];
  const t = {
    sl_release: ds.reduce((a, r) => a + slReleaseDong(r), 0),
    release_bs: ds.reduce((a, r) => a + releaseBsDong(r), 0),
    sl_in: ds.reduce((a, r) => a + so(r.sl_in), 0),
    bs_cty: ds.reduce((a, r) => a + so(r.sl_in_bs_cty), 0),
    bs_khach: ds.reduce((a, r) => a + so(r.sl_in_bs_khach), 0),
  };
  t.release_sl = t.sl_release - t.release_bs;
  t.in_bs = t.bs_cty + t.bs_khach;
  t.in_sl = t.sl_in - t.in_bs;
  return t;
};

// Số tổng đầu trang (đếm như Danh sách release: đơn / mã / phần in khác nhau · Σ SL release · Σ SL IN) + phần bổ sung.
export function tongDsRelease(rows) {
  const dem = (k) => new Set((rows || []).map((r) => r[k]).filter(Boolean)).size;
  return { tong_don: dem('ma_don_hang'), tong_ma: dem('ma_hang'), tong_phan: dem('ma_phan'), ...congSo(rows) };
}

// Bảng TỔNG THEO CHUYỀN (sheet thứ 2 của Excel — mẫu người dùng 25/11/2026): 1 dòng / chuyền (mã chuyền in như cột
//   "Chuyền" — chuyền KẾ HOẠCH của lệnh), xếp mã tự nhiên; cột theo `COT_TONG_CHUYEN`; dòng cuối "Tổng cộng".
export const COT_TONG_CHUYEN = [
  { key: 'chuyen', header: 'Chuyền', width: 12 },
  { key: 'sl_release', header: 'Tổng SL Release', width: 13, num: true },
  { key: 'release_sl', header: 'Release SL', width: 12, num: true },
  { key: 'release_bs', header: 'Release BS', width: 12, num: true },
  { key: 'sl_in', header: 'Tổng in', width: 12, num: true },
  { key: 'in_sl', header: 'In SL', width: 12, num: true },
  { key: 'in_bs', header: 'Tổng in BS', width: 12, num: true },
  { key: 'bs_khach', header: 'BS do KH', width: 12, num: true }, // KH trước Cty (người dùng chốt)
  { key: 'bs_cty', header: 'BS do cty', width: 12, num: true },
];
// ⚠ Chuyền của dòng = chuyền IN THẬT của tem trong kỳ (backend, 26/11/2026 — ca bổ sung cộng vào lệnh M3 / M7 rồi đổi chuyền
//   in ở 1A1B). Lệnh in ở NHIỀU chuyền trong kỳ ⇒ dòng đầu mang `in_theo_chuyen` ⇒ số IN / BS chia về đúng từng chuyền (phần
//   lệch còn lại về chuyền của dòng); số RELEASE vẫn theo chuyền của dòng.
export function tongTheoChuyen(rows) {
  const nhom = new Map();
  const lay = (k) => {
    if (!nhom.has(k)) nhom.set(k, { sl_release: 0, release_bs: 0, sl_in: 0, bs_cty: 0, bs_khach: 0 });
    return nhom.get(k);
  };
  (rows || []).forEach((r) => {
    const k = maChuyenIn(r) || '(Chưa có chuyền)';
    const g = lay(k);
    g.sl_release += slReleaseDong(r);
    g.release_bs += releaseBsDong(r);
    let sl = so(r.sl_in); let cty = so(r.sl_in_bs_cty); let kh = so(r.sl_in_bs_khach);
    (Array.isArray(r.in_theo_chuyen) ? r.in_theo_chuyen : []).forEach((x) => {
      const gx = lay(maChuyenIn(x) || k);
      gx.sl_in += so(x.sl_in); gx.bs_cty += so(x.bs_cty); gx.bs_khach += so(x.bs_khach);
      sl -= so(x.sl_in); cty -= so(x.bs_cty); kh -= so(x.bs_khach);
    });
    g.sl_in += sl; g.bs_cty += cty; g.bs_khach += kh;
  });
  const xong = (t) => ({ ...t, release_sl: t.sl_release - t.release_bs, in_bs: t.bs_cty + t.bs_khach, in_sl: t.sl_in - t.bs_cty - t.bs_khach });
  const dong = [...nhom.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'vi', { numeric: true }))
    .map(([chuyen, t]) => ({ chuyen, ...xong(t) }));
  return { dong, tong: { chuyen: 'Tổng cộng', ...congSo(rows) } };
}

// Mã chuyền KẾ HOẠCH của dòng khi lệnh in ở chuyền khác ('' nếu trùng) — hiện nhỏ dưới ô Chuyền.
export const maChuyenKhDong = (r) => (r && r.ma_chuyen_kh
  ? maChuyenIn({ ma_chuyen: r.ma_chuyen_kh, ten_chuyen: r.ten_chuyen_kh, ma_loai_chuyen: r.ma_loai_chuyen_kh }) : '');
