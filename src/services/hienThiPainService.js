import client from './axiosClient';

// Hệ thống > Hiển thị theo phương án in (mig 067 + 069): mỗi trang có dòng chảy phần in là 1 dòng,
// bật/tắt theo 2 CHIỀU — **Phương án in** (4 nhóm Máy/Bàn/Robot/Khác) và **Loại chuyền** (danh mục
// động từ bảng `loai_chuyen` + "Khác"). 2 chiều độc lập, khi lọc thì kết hợp AND.
// `list` trả `{ items, nhom_loai_chuyen: [{key,label}] }`; mỗi item có `co_loai_chuyen` (trang mức
// lệnh/phiếu mới áp được) + `loai_chuyen` = { ma_loai: bool } (THIẾU khóa = bật).
export const listHienThiPain = () => client.get('/hien-thi-pain');
export const saveHienThiPain = (items) => client.put('/hien-thi-pain', { items });

// Nhãn 4 nhóm — khớp `TRANG_PAIN` / `dieuKienPain` ở backend.
export const NHOM_PAIN = [
  { key: 'may', label: 'Máy' },
  { key: 'ban', label: 'Bàn' },
  { key: 'robot', label: 'Robot' },
  { key: 'khac', label: 'Khác' },
];
