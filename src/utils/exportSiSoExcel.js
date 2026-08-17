import exportPanelExcel from '../components/common/exportPanelExcel';
import { PHUONG_AN_IN } from '../components/common/PhuongAnInBadge';

// Xuất Excel danh sách SĨ SỐ CHECKPOINT — tái dùng `exportPanelExcel` (header nền xanh, zebra,
// STT tự thêm, cột ngày tô đỏ/cam khi trễ/gấp) để mọi file Excel trong app nhìn giống nhau.
//
// ⚠ Xuất theo ĐÚNG bộ lọc đang xem, LẤY HẾT mọi trang (caller gọi API với `limit: 0`) — không
//   phải chỉ trang hiện tại.

const pad = (n) => String(n).padStart(2, '0');
const gio = (v) => {
  if (!v) return '';
  const d = new Date(v);
  return Number.isNaN(+d) ? String(v)
    : `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const COLS = [
  { header: 'Khách hàng', width: 22, value: (r) => r.ten_khach_hang || '' },
  { header: 'Đơn hàng', width: 16, value: (r) => r.ma_don_hang || '' },
  { header: 'Mã hàng', width: 20, value: (r) => r.ma_hang || '' },
  { header: 'Code phần', width: 26, value: (r) => r.ma_phan || '' },
  { header: 'Gom set', width: 9, center: true, value: (r) => (Number(r.so_phan_in) > 1 ? r.so_phan_in : '') },
  { header: 'Màu vải', width: 18, value: (r) => r.mau_vai || '' },
  { header: 'Kích vải', width: 12, value: (r) => r.kich_vai || '' },
  { header: 'Kích phim', width: 12, value: (r) => r.kich_phim || '' },
  { header: 'Tính chất in', width: 16, value: (r) => r.tinh_chat_in || '' },
  { header: 'Loại đợt vải', width: 14, value: (r) => r.ten_loai_dot_vai || '' },
  // ⚠ Xuất NHÃN (Bàn/Máy/Robot/Chưa xác định), không xuất số trần — người đọc Excel không tra được số.
  { header: 'Phương án in', width: 14, value: (r) => (r.phuong_an_in == null ? '' : (PHUONG_AN_IN[Number(r.phuong_an_in)] || r.phuong_an_in)) },
  { header: 'Nhà gia công', width: 14, value: (r) => r.nha_gia_cong || '' },
  { header: 'Mã đợt vải', width: 20, value: (r) => r.ma_dot_vai || '' },
  { header: 'Mã đợt SX', width: 14, value: (r) => r.ma_lenh_san_xuat || '' },
  { header: 'Mã tem', width: 16, value: (r) => r.ma_tem || '' },
  { header: 'Chuyền', width: 14, value: (r) => r.ten_chuyen || '' },
  { header: 'SLĐH', width: 10, num: true, value: (r) => (r.so_luong_don_hang ?? '') },
  { header: 'SLNV', width: 10, num: true, value: (r) => (r.so_luong_vai_ve ?? '') },
  { header: 'Ngày nhận vải', width: 14, type: 'date', value: (r) => r.ngay_vai_ve || '' },
  { header: 'Ngày lên MES', width: 14, type: 'date', value: (r) => r.tg_len_mes || '' },
  { header: 'Ngày KH SX', width: 14, type: 'date', value: (r) => r.ngay_ke_hoach || '' },
  { header: 'Hạn giao', width: 14, type: 'date', value: (r) => r.han_giao_hang || '' },
  { header: 'Vào trạm', width: 18, value: (r) => gio(r.tg_vao) },
  { header: 'Rời trạm', width: 18, value: (r) => gio(r.tg_ra) },
];

export async function xuatSiSoExcel(rows, { tenMan, tenO, ky, donViNhan, moTaLoc } = {}) {
  const kyTxt = ky ? (ky.tu === ky.den ? ky.tu : `${ky.tu} → ${ky.den}`) : '';
  const phu = [
    `Kỳ (mốc vào/rời trạm): ${kyTxt}`,
    `${rows.length} ${donViNhan || 'mục'}`,
    moTaLoc ? `Lọc: ${moTaLoc}` : '',
  ].filter(Boolean).join('  ·  ');

  await exportPanelExcel({
    cols: COLS,
    rows,
    title: `${tenMan || 'Checkpoint'} — ${tenO || ''}`,
    subtitle: phu,
    fileName: `si-so-${(tenMan || 'checkpoint').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${kyTxt.replace(/[^0-9]+/g, '')}`,
  });
}

export default xuatSiSoExcel;
