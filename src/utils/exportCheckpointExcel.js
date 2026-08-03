// Xuất Excel danh sách phần in ĐANG Ở 1 CHECKPOINT (Release 1 · Release 2 · Test Run · Đang chờ chạy ·
// Đang sản xuất). Dùng chung `components/common/exportPanelExcel` để định dạng giống hệt các sidebar
// (header nền xanh #0058BE, zebra, đóng băng header, cột ngày tô đỏ khi trễ / cam khi gấp, STT tự thêm).
//
// ⚠ Xuất theo **MẢNG ĐÃ LỌC Ở TRANG**, không phải trang đang xem: các màn này đều tải-hết rồi phân trang
// client, nên truyền `rows` = danh sách sau bộ lọc là đã đủ "hết mọi trang, vẫn theo bộ lọc".

import exportPanelExcel from '../components/common/exportPanelExcel';

const txt = (v) => (v == null || v === '' ? '' : String(v));
const num = (v) => (v == null || v === '' ? null : Number(v));

// Bộ cột dùng chung cho danh sách theo ĐỢT VẢI (màn Release 1).
export const COT_DOT_VAI = [
  { header: 'Code phần', width: 24, value: (r) => txt(r.ma_phan) },
  { header: 'Khách hàng', width: 18, value: (r) => txt(r.ten_khach_hang) },
  { header: 'Đơn hàng', width: 18, value: (r) => txt(r.ma_don_hang) },
  { header: 'Mã hàng', width: 18, value: (r) => txt(r.ma_hang) },
  { header: 'Màu vải', width: 18, value: (r) => txt(r.mau_vai) },
  { header: 'Kích vải', width: 14, value: (r) => txt(r.kich_vai) },
  { header: 'Kích phim', width: 14, value: (r) => txt(r.kich_phim) },
  { header: 'Tính chất in', width: 16, value: (r) => txt(r.tinh_chat_in) },
  { header: 'Loại đợt vải', width: 14, value: (r) => txt(r.loai_dot_vai) },
  { header: 'SL đơn hàng', width: 13, num: true, value: (r) => num(r.so_luong_don_hang) },
  { header: 'SL vải về', width: 12, num: true, value: (r) => num(r.so_luong_vai_ve) },
  { header: 'Còn release', width: 12, num: true, value: (r) => num(r.con_release) },
  { header: 'Tình trạng', width: 14, value: (r) => (r.qc_done ? 'Đã Ready' : 'Chờ Ready') },
  { header: 'Hạn giao', width: 13, type: 'date', center: true, value: (r) => r.han_giao_hang },
];

// Bộ cột dùng chung cho danh sách theo LỆNH SẢN XUẤT (Release 2 · Test Run · Chờ chạy · Đang sản xuất).
export const COT_LENH = [
  { header: 'Mã đợt SX', width: 16, value: (r) => txt(r.ma_lenh_san_xuat) },
  { header: 'Chuyền', width: 16, value: (r) => txt(r.ten_chuyen || r.ma_chuyen) },
  { header: 'Code phần', width: 24, value: (r) => txt(r.ma_phan || r.phan_list) },
  { header: 'Khách hàng', width: 18, value: (r) => txt(r.ten_khach_hang) },
  { header: 'Đơn hàng', width: 18, value: (r) => txt(r.ma_don_hang) },
  { header: 'Mã hàng', width: 18, value: (r) => txt(r.ma_hang) },
  { header: 'Màu vải', width: 18, value: (r) => txt(r.mau_vai) },
  { header: 'Kích vải', width: 14, value: (r) => txt(r.kich_vai) },
  { header: 'Kích phim', width: 14, value: (r) => txt(r.kich_phim) },
  { header: 'Tính chất in', width: 16, value: (r) => txt(r.tinh_chat_in) },
  { header: 'Loại đợt vải', width: 14, value: (r) => txt(r.loai_dot_vai) },
  { header: 'SL đơn hàng', width: 13, num: true, value: (r) => num(r.so_luong_don_hang) },
  { header: 'SL release', width: 12, num: true, value: (r) => num(r.so_luong_release) },
  { header: 'Số đợt vải', width: 11, num: true, value: (r) => num(r.so_dot_vai) },
  { header: 'Hạn giao', width: 13, type: 'date', center: true, value: (r) => r.han_giao_hang },
  { header: 'Ngày SX kế hoạch', width: 15, type: 'date', center: true, value: (r) => r.ngay_ke_hoach },
];

// cols: mảng cột (COT_DOT_VAI / COT_LENH, có thể nối thêm cột riêng của màn).
// moTaLoc: chuỗi mô tả bộ lọc đang bật → in vào dòng phụ đề để người đọc biết file lọc theo gì.
export default function exportCheckpointExcel({ cols, rows = [], title, fileName, moTaLoc }) {
  const ngay = new Date().toLocaleString('vi-VN');
  const sub = `${rows.length} dòng · xuất lúc ${ngay}${moTaLoc ? ` · lọc: ${moTaLoc}` : ' · không lọc'}`;
  return exportPanelExcel({ cols, rows, title, subtitle: sub, fileName });
}

// Gom mô tả bộ lọc đang bật thành 1 chuỗi ngắn cho phụ đề file.
export const moTaBoLoc = (parts = {}) => Object.entries(parts)
  .filter(([, v]) => v != null && v !== '' && v !== false)
  .map(([k, v]) => `${k}=${v}`)
  .join(', ');
