// ─────────────────────────────────────────────────────────────────────────────
// BỘ CỘT "BẢNG CHECKLIST RELEASE" (06/10/2026 — người dùng gửi mẫu giấy, chốt "điền sẵn từ MES").
// NGUỒN DUY NHẤT cho bảng trong `ReleaseListModal` + file Excel (`exportReleaseListExcel`) ⇒ 2 nơi luôn cùng
// thứ tự / cùng nhãn / cùng giá trị. Thêm–bớt cột chỉ sửa mảng `COT_CHECKLIST`.
//
// Mỗi cột: `key` · `header` (dòng tiêu đề dưới) · `nhom` (dòng tiêu đề trên, gộp ngang; null ⇒ ô gộp dọc 2
//   dòng) · `width` (Excel) · `num` (căn phải, định dạng số) · `mucLenh` (ô MỨC LỆNH — chỉ ghi ở dòng ĐẦU của
//   đợt SX rồi gộp dọc, vì lệnh gom set cũ ra nhiều dòng phần in) · `value(r)` = giá trị THÔ.
// Cột để TRỐNG cho xưởng ghi tay (MES không có dữ liệu): Ưu tiên · Quyết định · Nhóm thợ · Vải · Nhập kho ·
//   Kết quả · Ghi chú.
// Cột checklist sau sản xuất (SL IN · Đạt · Sửa đạt · Hủy · OQC) để trống khi lệnh CHƯA in tem nào — chỗ
//   trống cho ghi tay, khỏi một hàng số 0 vô nghĩa.
// ─────────────────────────────────────────────────────────────────────────────
import { nhanChip } from '../../../utils/khuChuyen';

const pad = (n) => String(n).padStart(2, '0');
// Giờ 24h như mẫu ("7:30", "13:30").
export const gio24 = (ts) => {
  if (!ts) return '';
  const x = new Date(ts); if (Number.isNaN(+x)) return '';
  return `${x.getHours()}:${pad(x.getMinutes())}`;
};
export const ngayDMY = (s, sep = '/') => {
  if (!s) return '';
  const x = new Date(s); if (Number.isNaN(+x)) return '';
  return [pad(x.getDate()), pad(x.getMonth() + 1), x.getFullYear()].join(sep);
};

// Cột "Chuyền in" = MÃ CHUYỀN theo cách xưởng ghi trên tờ (08/10/2026, người dùng chốt): Máy / Ép / Logo giữ
//   nguyên mã (M1 … M8 · MEHTD1 · MECT01 · MEHENLG01); Bàn + Robot bỏ chữ "M" đầu và dấu "-" (M1A-1B → 1A1B ·
//   M10A → 10A · MRB1 → RB1). Mã không mở đầu bằng "M" (vd C03) giữ nguyên. Thiếu mã ⇒ lùi về tên chuyền.
export const maChuyenIn = (r) => {
  const ma = String((r && r.ma_chuyen) || '').trim();
  if (!ma) return (r && r.ten_chuyen) || '';
  const loai = String((r && r.ma_loai_chuyen) || '').toUpperCase();
  return loai === 'BAN' || loai === 'ROBOT' ? ma.replace(/^M(?=.)/i, '').replace(/-/g, '') : ma;
};

const daIn = (r) => Number(r.sl_da_in) > 0;
const soSauIn = (k) => (r) => (daIn(r) && r[k] != null ? Number(r[k]) || 0 : '');
const trong = () => '';

export const COT_CHECKLIST = [
  { key: 'tt', header: 'TT', width: 5, num: true, mucLenh: true, value: (r) => r._stt ?? '' },
  { key: 'chuyen', header: 'Chuyền in', width: 9, mucLenh: true, value: maChuyenIn },
  { key: 'khach', header: 'Khách hàng', width: 9, value: (r) => r.ten_khach_hang || '' },
  { key: 'po', header: 'PO', width: 15, value: (r) => r.ma_don_hang || '' },
  { key: 'ten_hang', header: 'Tên hàng', width: 26, value: (r) => r.ten_ma_hang || r.ma_hang || '' },
  { key: 'mau_vai', header: 'Màu vải', nhom: 'Phần in', width: 16, value: (r) => r.mau_vai || '' },
  { key: 'kich_vai', header: 'Kích vải', nhom: 'Phần in', width: 10, value: (r) => r.kich_vai || '' },
  { key: 'kich_phim', header: 'Kích film', nhom: 'Phần in', width: 12, value: (r) => r.kich_phim || '' },
  { key: 'tinh_chat_in', header: 'Tính chất in', width: 9, value: (r) => r.tinh_chat_in || '' },
  { key: 'sldh', header: 'SLĐH', width: 8, num: true, value: (r) => (r.so_luong_don_hang == null ? '' : Number(r.so_luong_don_hang)) },
  { key: 'slnv', header: 'SL nhận vải', width: 9, num: true, value: (r) => Number(r.slnv) || 0 },
  { key: 'sl_da_in', header: 'SL đã in', width: 8, num: true, mucLenh: true, value: (r) => (r.sl_da_in == null ? '' : Number(r.sl_da_in)) },
  { key: 'sl_giao', header: 'SL Giao', width: 8, num: true, mucLenh: true, value: (r) => (r.sl_da_giao == null ? '' : Number(r.sl_da_giao)) },
  { key: 'sl_release', header: 'SL Release', width: 10, num: true, value: (r) => Number(r.sl_release_phan ?? r.so_luong_release) || 0 },
  { key: 'gio_bd', header: 'Giờ BĐ', nhom: 'Hạn hoàn thành', width: 8, mucLenh: true, value: (r) => gio24(r.tg_bd_kh) },
  { key: 'gio_kt', header: 'Giờ KT', nhom: 'Hạn hoàn thành', width: 8, mucLenh: true, value: (r) => gio24(r.tg_kt_kh) },
  { key: 'han_ht', header: 'Hạn hoàn thành', nhom: 'Hạn hoàn thành', width: 11, value: (r) => ngayDMY(r.han_giao) },
  { key: 'uu_tien', header: 'Ưu tiên', width: 7, value: trong },
  { key: 'quyet_dinh', header: 'Quyết định', width: 9, value: trong },
  { key: 'nhom_tho', header: 'Nhóm thợ', width: 8, value: trong },
  // Phân công lúc chạy thắng; lệnh chưa chạy thì hiện thợ in KẾ HOẠCH chọn lúc Release 1 (mig 111).
  { key: 'tho_in', header: 'Thợ in', width: 14, mucLenh: true, value: (r) => r.tho_in || r.tho_in_kh || '' },
  { key: 'trang_thai', header: 'Trạng thái', width: 15, value: (r) => r.giai_doan_ten || '' },
  { key: 'kt_vai', header: 'Vải', nhom: 'DANH MỤC KIỂM TRA', width: 6, value: trong },
  { key: 'kt_khuon', header: 'Khuôn', nhom: 'DANH MỤC KIỂM TRA', width: 7, value: (r) => r.khuon_nhan || '' },
  { key: 'kt_muc', header: 'Mực', nhom: 'DANH MỤC KIỂM TRA', width: 6, value: (r) => r.muc_nhan || '' },
  { key: 'kt_test', header: 'Test', nhom: 'DANH MỤC KIỂM TRA', width: 10, mucLenh: true, value: (r) => r.test_nhan || '' },
  { key: 'sl_in', header: 'SL IN', width: 8, num: true, mucLenh: true, value: soSauIn('sl_da_in') },
  { key: 'dat', header: 'Đạt', nhom: 'Đạt', width: 8, num: true, mucLenh: true, value: soSauIn('sl_dat') },
  { key: 'sua_dat', header: 'Sửa đạt', nhom: 'Đạt', width: 8, num: true, mucLenh: true, value: soSauIn('sl_sua_dat') },
  { key: 'huy', header: 'Hủy', nhom: 'Đạt', width: 7, num: true, mucLenh: true, value: soSauIn('sl_huy') },
  { key: 'oqc', header: 'OQC', width: 8, num: true, mucLenh: true, value: soSauIn('sl_oqc') },
  { key: 'nhap_kho', header: 'Nhập kho', width: 8, value: trong },
  { key: 'ket_qua', header: 'Kết quả', width: 8, value: trong },
  { key: 'ghi_chu', header: 'Ghi chú', width: 18, value: trong },
];

// 2 dòng tiêu đề: dòng TRÊN = nhóm (gộp ngang) hoặc chính tên cột (gộp dọc 2 dòng); dòng DƯỚI = cột trong nhóm.
// Trả `tren`: [{ cot, nhan, colSpan, rowSpan, tuCot }] (tuCot = chỉ số cột đầu, 0-based) · `duoi`: cột thuộc nhóm.
export function dongTieuDe(cols = COT_CHECKLIST) {
  const tren = [];
  cols.forEach((c, i) => {
    if (!c.nhom) { tren.push({ cot: c, nhan: c.header, colSpan: 1, rowSpan: 2, tuCot: i }); return; }
    const truoc = tren[tren.length - 1];
    if (truoc && truoc.nhom === c.nhom) { truoc.colSpan += 1; return; }
    tren.push({ nhom: c.nhom, nhan: c.nhom, colSpan: 1, rowSpan: 1, tuCot: i });
  });
  return { tren, duoi: cols.filter((c) => c.nhom) };
}

// Phần tiêu đề theo chip chuyền: Bàn ⇒ "IN TAY", khu bàn ⇒ "IN TAY KHU A"; chip khác ⇒ tên chip viết HOA.
export function nhanTieuDeChip(chip) {
  if (!chip) return '';
  if (chip === 'BAN') return 'IN TAY';
  const nhan = nhanChip(chip) || '';
  if (chip.startsWith('KHU:BAN_')) return `IN TAY ${nhan.replace(/^Bàn\s*/i, '')}`.toUpperCase();
  return nhan.toUpperCase();
}

// Tiêu đề tách 2 phần để tô ĐỎ phần ngày như mẫu: "BẢNG CHECKLIST RELEASE IN TAY KHU A NGÀY " + "01-10-2026".
export function tieuDeChecklist(chip, ngay, mode) {
  const giua = nhanTieuDeChip(chip);
  return {
    truoc: `BẢNG CHECKLIST RELEASE${giua ? ` ${giua}` : ''} NGÀY${mode === 'RELEASE' ? ' RELEASE' : ''} `,
    ngay: ngayDMY(ngay, '-'),
  };
}
